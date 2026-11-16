import type { AcceptBankTransactionBody, UpdateBankConnectionAccountBody } from "@personal-tracker/shared/money";
import type { FastifyBaseLogger } from "fastify";

import { httpErrors } from "@fastify/sensible";
import { randomBytes } from "node:crypto";

import type { TransactionBody } from "../transactions/transaction.entity";
import type { CreateTransactionUseCase } from "../transactions/transaction.useCases";
import type { BankingRepository } from "./banking.repository";
import type { EnableBankingClient } from "./enable-banking.client";

import {
	addDays,
	computeDateFrom,
	connectionStatus,
	IGNORED_RETENTION_DAYS,
	isMatchCandidate,
	isSyncDue,
	MATCH_WINDOW_DAYS,
	normalizeIban,
	statusAfterError,
	suggestPaymentType,
	toBankLines,
} from "./banking.entity";
import { EnableBankingError } from "./enable-banking.client";

// default consent duration when the bank does not tell its maximum (PSD2: 180 days)
const DEFAULT_CONSENT_SECONDS = 180 * 24 * 60 * 60;
// first sync of a new bank account
const DEFAULT_SYNC_FROM_DAYS = 30;

const today = () => new Date().toISOString().slice(0, 10);

export class ListAspspsUseCase {
	constructor(private client: EnableBankingClient) {}

	async execute(country: string, log: FastifyBaseLogger) {
		log.info({ country }, "ListAspspsUseCase.execute");
		const aspsps = await this.client.listAspsps(country);
		return aspsps.map((a) => ({ name: a.name, country: a.country, logo: a.logo ?? null }));
	}
}

export class ListConnectionsUseCase {
	constructor(private repo: BankingRepository) {}

	async execute(log: FastifyBaseLogger) {
		log.info("ListConnectionsUseCase.execute");
		const now = new Date();
		const connections = await this.repo.listConnections();
		// authState stays on the server
		return connections.map(({ authState: _, ...c }) => ({ ...c, status: connectionStatus(c, now) }));
	}
}

export class StartConnectionUseCase {
	constructor(
		private repo: BankingRepository,
		private client: EnableBankingClient,
		private redirectUrl: string,
	) {}

	/** new connection, or renewal of `connectionId` (same bank, accounts re-attached on the callback) */
	async execute(
		params: { aspspName: string; aspspCountry: string } | { connectionId: number },
		log: FastifyBaseLogger,
	) {
		log.info(params, "StartConnectionUseCase.execute");
		let aspsp: { name: string; country: string };
		let connectionId: number;
		const authState = randomBytes(24).toString("hex");

		if ("connectionId" in params) {
			const connection = await this.repo.findConnection(params.connectionId);
			if (!connection) throw httpErrors.notFound("Connexion introuvable");
			aspsp = { name: connection.aspspName, country: connection.aspspCountry };
			connectionId = connection.id;
			await this.repo.updateConnection(connectionId, { authState });
		} else {
			aspsp = { name: params.aspspName, country: params.aspspCountry };
			const created = await this.repo.createConnection({
				aspspName: aspsp.name,
				aspspCountry: aspsp.country,
				status: "pending",
				authState,
			});
			connectionId = created.id;
		}

		const details = (await this.client.listAspsps(aspsp.country)).find((a) => a.name === aspsp.name);
		const validitySeconds = details?.maximum_consent_validity ?? DEFAULT_CONSENT_SECONDS;
		const validUntil = new Date(Date.now() + validitySeconds * 1000).toISOString();

		const { url } = await this.client.startAuth({
			aspsp,
			validUntil,
			state: authState,
			redirectUrl: this.redirectUrl,
		});
		return { connectionId, url };
	}
}

export class CompleteConnectionUseCase {
	constructor(
		private repo: BankingRepository,
		private client: EnableBankingClient,
	) {}

	async execute({ code, state }: { code: string; state: string }, log: FastifyBaseLogger) {
		log.info("CompleteConnectionUseCase.execute");
		const connection = await this.repo.findConnectionByState(state);
		if (!connection) throw httpErrors.badRequest("Autorisation inconnue ou déjà utilisée");

		const session = await this.client.createSession(code);
		const previousSessionId = connection.sessionId;

		const existing = await this.repo.findConnection(connection.id);
		const byHash = new Map(existing?.accounts.map((a) => [a.identificationHash, a]) ?? []);
		for (const account of session.accounts) {
			const iban = normalizeIban(account.account_id?.iban);
			const data = {
				uid: account.uid ?? null,
				iban,
				name: account.name ?? null,
				currency: account.currency ?? null,
			};
			const known = byHash.get(account.identification_hash);
			if (known) {
				await this.repo.updateConnectionAccount(known.id, data);
			} else {
				const local = iban ? await this.repo.findAccountByIban(iban) : undefined;
				await this.repo.createConnectionAccount({
					...data,
					connectionId: connection.id,
					identificationHash: account.identification_hash,
					accountId: local?.id ?? null,
					syncFrom: addDays(today(), -DEFAULT_SYNC_FROM_DAYS),
				});
			}
		}

		await this.repo.updateConnection(connection.id, {
			sessionId: session.session_id,
			status: "authorized",
			validUntil: session.access.valid_until,
			authState: null,
			lastError: null,
		});

		// renewal: the old session is no longer needed
		if (previousSessionId && previousSessionId !== session.session_id) {
			await this.client
				.deleteSession(previousSessionId)
				.catch((err) => log.warn({ err }, "old session not deleted"));
		}
		return { connectionId: connection.id };
	}
}

export class DeleteConnectionUseCase {
	constructor(
		private repo: BankingRepository,
		private client: EnableBankingClient,
	) {}

	async execute(id: number, log: FastifyBaseLogger) {
		log.info({ id }, "DeleteConnectionUseCase.execute");
		const connection = await this.repo.findConnection(id);
		if (!connection) throw httpErrors.notFound("Connexion introuvable");
		if (connection.sessionId) {
			// the consent may already be expired or revoked at the bank: still delete it here
			await this.client
				.deleteSession(connection.sessionId)
				.catch((err) => log.warn({ err }, "session not deleted"));
		}
		await this.repo.deleteConnection(id);
	}
}

export class UpdateConnectionAccountUseCase {
	constructor(private repo: BankingRepository) {}

	async execute(id: number, data: UpdateBankConnectionAccountBody, log: FastifyBaseLogger) {
		log.info({ id, data }, "UpdateConnectionAccountUseCase.execute");
		const account = await this.repo.findConnectionAccount(id);
		if (!account) throw httpErrors.notFound("Compte bancaire introuvable");
		if (data.accountId && !(await this.repo.findAccount(data.accountId))) {
			throw httpErrors.badRequest("Compte introuvable");
		}
		await this.repo.updateConnectionAccount(id, data);
		return this.repo.findConnectionAccount(id);
	}
}

export class SyncUseCase {
	// shared by the scheduler plugin and the route instances: one sync at a time
	private static running: Promise<{ imported: number }> | null = null;

	constructor(
		private repo: BankingRepository,
		private client: EnableBankingClient,
	) {}

	/** `force`: manual sync (button), otherwise only connections not synced for 24h. Never runs twice at once. */
	execute({ force }: { force: boolean }, log: FastifyBaseLogger) {
		SyncUseCase.running ??= this.run(force, log).finally(() => {
			SyncUseCase.running = null;
		});
		return SyncUseCase.running;
	}

	private async run(force: boolean, log: FastifyBaseLogger) {
		log.info({ force }, "SyncUseCase.execute");
		const now = new Date();
		let imported = 0;
		const connections = await this.repo.listConnections();
		for (const connection of connections) {
			if (connectionStatus(connection, now) !== "authorized") continue;
			if (!force && !isSyncDue(connection.lastSyncSuccessAt, now)) continue;
			try {
				for (const account of connection.accounts) {
					if (!account.enabled || !account.accountId || !account.uid) continue;
					const dateFrom = computeDateFrom(account.syncFrom, connection.lastSyncSuccessAt);
					const transactions = await this.client.listTransactions(account.uid, dateFrom);
					const lines = toBankLines(account.identificationHash, transactions).filter(
						(l) => l.bookingDate >= account.syncFrom,
					);
					const known = await this.repo.findKnownExternalIds(lines.map((l) => l.externalId));
					const fresh = lines.filter((l) => !known.has(l.externalId));
					await this.repo.insertBankTransactions(
						fresh.map((l) => ({ ...l, connectionAccountId: account.id })),
					);
					imported += fresh.length;
					log.info(
						{ account: account.id, fetched: lines.length, imported: fresh.length },
						"bank account synced",
					);
				}
				const at = new Date().toISOString();
				await this.repo.updateConnection(connection.id, {
					lastSyncAt: at,
					lastSyncSuccessAt: at,
					lastError: null,
				});
			} catch (err) {
				log.error({ err, connection: connection.id }, "bank sync failed");
				const code = err instanceof EnableBankingError ? err.code : undefined;
				const status = statusAfterError(code);
				await this.repo.updateConnection(connection.id, {
					lastSyncAt: new Date().toISOString(),
					lastError: err instanceof Error ? err.message : String(err),
					...(status ? { status } : {}),
				});
			}
		}
		await this.repo.purgeIgnored(addDays(today(), -IGNORED_RETENTION_DAYS));
		return { imported };
	}
}

export class ListInboxUseCase {
	constructor(private repo: BankingRepository) {}

	async execute(log: FastifyBaseLogger) {
		log.info("ListInboxUseCase.execute");
		const lines = await this.repo.listInbox();
		return Promise.all(
			lines.map(async ({ raw: _, connectionAccount, ...line }) => {
				const account = connectionAccount?.account;
				const paymentTypes = account?.paymentTypes ?? [];
				const candidates = account
					? (
							await this.repo.findMatchCandidates(
								account.id,
								addDays(line.transactionDate ?? line.bookingDate, -MATCH_WINDOW_DAYS),
								addDays(line.bookingDate, MATCH_WINDOW_DAYS),
							)
						).filter((t) => isMatchCandidate(line, t))
					: [];
				return {
					...line,
					account: account ? { id: account.id, name: account.name } : null,
					paymentTypeIds: paymentTypes.map((p) => p.id),
					suggestedPaymentTypeId: suggestPaymentType(line, paymentTypes),
					candidates: candidates.map((t) => ({
						id: t.id,
						name: t.name,
						date: t.date,
						amount: t.amount,
						paymentType: t.paymentType?.name ?? null,
					})),
				};
			}),
		);
	}
}

export class CountInboxUseCase {
	constructor(private repo: BankingRepository) {}

	async execute(log: FastifyBaseLogger) {
		log.info("CountInboxUseCase.execute");
		return { count: await this.repo.countInbox() };
	}
}

async function findLineWithAccount(repo: BankingRepository, id: number) {
	const line = await repo.findBankTransaction(id);
	if (!line || line.ignored) throw httpErrors.notFound("Opération bancaire introuvable");
	const account = line.connectionAccount?.account;
	if (!account) throw httpErrors.badRequest("Le compte bancaire n'est lié à aucun compte");
	return { line, account };
}

export class AcceptBankTransactionUseCase {
	constructor(
		private repo: BankingRepository,
		private createTransaction: CreateTransactionUseCase,
	) {}

	async execute(id: number, body: AcceptBankTransactionBody, log: FastifyBaseLogger) {
		log.info({ id }, "AcceptBankTransactionUseCase.execute");
		const { line, account } = await findLineWithAccount(this.repo, id);
		const accountPaymentTypes = new Set(account.paymentTypes.map((p) => p.id));
		const used = body.children.length ? body.children.map((c) => c.paymentTypeId) : [body.paymentTypeId];
		if (used.some((p) => !accountPaymentTypes.has(p))) {
			throw httpErrors.badRequest(`Le moyen de paiement doit appartenir au compte ${account.name}`);
		}

		// amount, externalId and bankLabel come from the bank line, never from the client
		const transaction = {
			...body,
			amount: line.amount,
			externalId: line.externalId,
			bankLabel: line.label,
		} as unknown as TransactionBody;
		return this.repo.runInTransaction(async (t) => {
			const created = await this.createTransaction.execute(transaction, log, { transaction: t });
			await this.repo.deleteBankTransaction(id, { transaction: t });
			return created;
		});
	}
}

export class MatchBankTransactionUseCase {
	constructor(private repo: BankingRepository) {}

	async execute(id: number, transactionId: number, log: FastifyBaseLogger) {
		log.info({ id, transactionId }, "MatchBankTransactionUseCase.execute");
		const { line, account } = await findLineWithAccount(this.repo, id);
		const transaction = await this.repo.findTransaction(transactionId);
		if (!transaction || transaction.paymentType?.accountId !== account.id || !isMatchCandidate(line, transaction)) {
			throw httpErrors.badRequest("Cette transaction ne correspond pas à l'opération bancaire");
		}
		await this.repo.runInTransaction(async (t) => {
			await this.repo.linkTransaction(
				transactionId,
				{ externalId: line.externalId, bankLabel: line.label },
				{ transaction: t },
			);
			await this.repo.deleteBankTransaction(id, { transaction: t });
		});
	}
}

export class IgnoreBankTransactionUseCase {
	constructor(private repo: BankingRepository) {}

	async execute(id: number, log: FastifyBaseLogger) {
		log.info({ id }, "IgnoreBankTransactionUseCase.execute");
		const line = await this.repo.findBankTransaction(id);
		if (!line || line.ignored) throw httpErrors.notFound("Opération bancaire introuvable");
		await this.repo.ignoreBankTransaction(id);
	}
}
