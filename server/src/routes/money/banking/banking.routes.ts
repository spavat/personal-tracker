import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	AcceptBankTransactionBodyRequestSchema,
	AspspsQuerystringRequestSchema,
	CompleteBankConnectionBodyRequestSchema,
	IdParamsRequestSchema,
	MatchBankTransactionBodyRequestSchema,
	StartBankConnectionBodyRequestSchema,
	UpdateBankConnectionAccountBodyRequestSchema,
} from "@personal-tracker/shared/money";

import {
	ENABLE_BANKING_API_URL,
	ENABLE_BANKING_APP_ID,
	ENABLE_BANKING_KEY_PATH,
	ENABLE_BANKING_REDIRECT_URL,
} from "../../../config/enable-banking";
import { TransactionRepository } from "../transactions/transaction.repository";
import { CreateTransactionUseCase } from "../transactions/transaction.useCases";
import { BankingRepository } from "./banking.repository";
import {
	AcceptBankTransactionUseCase,
	CompleteConnectionUseCase,
	CountInboxUseCase,
	DeleteConnectionUseCase,
	IgnoreBankTransactionUseCase,
	ListAspspsUseCase,
	ListConnectionsUseCase,
	ListInboxUseCase,
	MatchBankTransactionUseCase,
	StartConnectionUseCase,
	SyncUseCase,
	UpdateConnectionAccountUseCase,
} from "./banking.useCases";
import { EnableBankingClient } from "./enable-banking.client";

export interface BankingRoutesOptions {
	client?: EnableBankingClient;
}

const bankingRoutes: FastifyPluginAsync<BankingRoutesOptions> = async (fastify, opts): Promise<void> => {
	const repository = new BankingRepository(fastify.db);
	const client =
		opts.client ??
		new EnableBankingClient({
			appId: ENABLE_BANKING_APP_ID,
			keyPath: ENABLE_BANKING_KEY_PATH,
			apiUrl: ENABLE_BANKING_API_URL,
		});
	const createTransaction = new CreateTransactionUseCase(new TransactionRepository(fastify.db));

	const listAspsps = new ListAspspsUseCase(client);
	const listConnections = new ListConnectionsUseCase(repository);
	const startConnection = new StartConnectionUseCase(repository, client, ENABLE_BANKING_REDIRECT_URL);
	const completeConnection = new CompleteConnectionUseCase(repository, client);
	const deleteConnection = new DeleteConnectionUseCase(repository, client);
	const updateConnectionAccount = new UpdateConnectionAccountUseCase(repository);
	const sync = new SyncUseCase(repository, client);
	const listInbox = new ListInboxUseCase(repository);
	const countInbox = new CountInboxUseCase(repository);
	const acceptBankTransaction = new AcceptBankTransactionUseCase(repository, createTransaction);
	const matchBankTransaction = new MatchBankTransactionUseCase(repository);
	const ignoreBankTransaction = new IgnoreBankTransactionUseCase(repository);

	const app = fastify.withTypeProvider<ZodTypeProvider>();

	app.get("/aspsps", { schema: { querystring: AspspsQuerystringRequestSchema } }, async (request) =>
		listAspsps.execute(request.query.country, request.log),
	);

	app.get("/connections", async (request) => listConnections.execute(request.log));

	app.post("/connections", { schema: { body: StartBankConnectionBodyRequestSchema } }, async (request) =>
		startConnection.execute(request.body, request.log),
	);

	app.post("/connections/callback", { schema: { body: CompleteBankConnectionBodyRequestSchema } }, async (request) =>
		completeConnection.execute(request.body, request.log),
	);

	app.post("/connections/:id/renew", { schema: { params: IdParamsRequestSchema } }, async (request) =>
		startConnection.execute({ connectionId: request.params.id }, request.log),
	);

	app.delete("/connections/:id", { schema: { params: IdParamsRequestSchema } }, async (request, reply) => {
		await deleteConnection.execute(request.params.id, request.log);
		return reply.code(204).send();
	});

	app.post(
		"/accounts/:id",
		{ schema: { params: IdParamsRequestSchema, body: UpdateBankConnectionAccountBodyRequestSchema } },
		async (request) => updateConnectionAccount.execute(request.params.id, request.body, request.log),
	);

	app.post("/sync", async (request) => sync.execute({ force: true }, request.log));

	app.get("/inbox", async (request) => listInbox.execute(request.log));

	app.get("/inbox/count", async (request) => countInbox.execute(request.log));

	app.post(
		"/inbox/:id/accept",
		{ schema: { params: IdParamsRequestSchema, body: AcceptBankTransactionBodyRequestSchema } },
		async (request, reply) =>
			reply.code(201).send(await acceptBankTransaction.execute(request.params.id, request.body, request.log)),
	);

	app.post(
		"/inbox/:id/match",
		{ schema: { params: IdParamsRequestSchema, body: MatchBankTransactionBodyRequestSchema } },
		async (request, reply) => {
			await matchBankTransaction.execute(request.params.id, request.body.transactionId, request.log);
			return reply.code(204).send();
		},
	);

	app.post("/inbox/:id/ignore", { schema: { params: IdParamsRequestSchema } }, async (request, reply) => {
		await ignoreBankTransaction.execute(request.params.id, request.log);
		return reply.code(204).send();
	});
};

export default bankingRoutes;
