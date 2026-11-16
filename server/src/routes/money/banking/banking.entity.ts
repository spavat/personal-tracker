import { createHash } from "node:crypto";

import type { EbTransaction } from "./enable-banking.client";

export type ConnectionStatus = "pending" | "authorized" | "expired" | "revoked" | "error";

export interface BankLine {
	externalId: string;
	transactionDate: string | null;
	bookingDate: string;
	valueDate: string | null;
	amount: number;
	currency: string | null;
	label: string;
	counterparty: string | null;
	bankTransactionCode: string | null;
	raw: EbTransaction;
}

const DAY = 24 * 60 * 60 * 1000;
// late-booked lines can appear with a booking date a few days in the past
export const SYNC_OVERLAP_DAYS = 10;
// ignored lines older than that can no longer be fetched again (overlap window)
export const IGNORED_RETENTION_DAYS = 30;
export const SYNC_INTERVAL_MS = DAY;
export const MATCH_WINDOW_DAYS = 3;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (date: string, days: number) => isoDate(new Date(new Date(date).getTime() + days * DAY));

function sha256(value: string) {
	return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function amountOf(tx: EbTransaction) {
	const amount = Number(tx.transaction_amount.amount);
	return tx.credit_debit_indicator === "DBIT" ? -Math.abs(amount) : Math.abs(amount);
}

function bookingDateOf(tx: EbTransaction) {
	return tx.booking_date ?? tx.value_date ?? tx.transaction_date ?? "";
}

function labelOf(tx: EbTransaction) {
	const remittance = (tx.remittance_information ?? []).join(" ").replace(/\s+/g, " ").trim();
	const counterparty = counterpartyOf(tx);
	return (remittance || counterparty || tx.bank_transaction_code?.description || "").slice(0, 255);
}

function counterpartyOf(tx: EbTransaction) {
	const party = tx.credit_debit_indicator === "DBIT" ? tx.creditor : tx.debtor;
	return party?.name?.trim() || null;
}

function contentHash(tx: EbTransaction) {
	return sha256(`${bookingDateOf(tx)}|${amountOf(tx)}|${labelOf(tx)}`);
}

/**
 * Turns the transactions of one fetch of one bank account into inbox lines with a stable externalId.
 * entry_reference is only unique per bank account, so it is prefixed with the account identification hash:
 * - `${hash}:${ref}` normally,
 * - `${hash}:${ref}:${contentHash}` when the bank sends the same ref for lines with different content,
 * - `${hash}:h:${contentHash}#${n}` without ref, n = occurrence among identical lines (two identical coffees).
 */
export function toBankLines(identificationHash: string, transactions: EbTransaction[]): BankLine[] {
	const contentsByRef = new Map<string, Set<string>>();
	for (const tx of transactions) {
		if (!tx.entry_reference) continue;
		const contents = contentsByRef.get(tx.entry_reference) ?? new Set();
		contents.add(contentHash(tx));
		contentsByRef.set(tx.entry_reference, contents);
	}

	const twins = new Map<string, number>();
	return transactions.map((tx) => {
		const hash = contentHash(tx);
		let externalId: string;
		if (tx.entry_reference) {
			const shared = (contentsByRef.get(tx.entry_reference)?.size ?? 0) > 1;
			externalId = `${identificationHash}:${tx.entry_reference}${shared ? `:${hash}` : ""}`;
		} else {
			const n = (twins.get(hash) ?? 0) + 1;
			twins.set(hash, n);
			externalId = `${identificationHash}:h:${hash}#${n}`;
		}
		const code = tx.bank_transaction_code;
		return {
			externalId: externalId.slice(0, 255),
			transactionDate: tx.transaction_date ?? null,
			bookingDate: bookingDateOf(tx),
			valueDate: tx.value_date ?? null,
			amount: amountOf(tx),
			currency: tx.transaction_amount.currency ?? null,
			label: labelOf(tx),
			counterparty: counterpartyOf(tx),
			bankTransactionCode: code
				? [code.code, code.sub_code, code.description].filter(Boolean).join(" ") || null
				: null,
			raw: tx,
		};
	});
}

/** First day to fetch: a few days before the last successful sync, never before the account's syncFrom */
export function computeDateFrom(syncFrom: string, lastSyncSuccessAt: string | null) {
	if (!lastSyncSuccessAt) return syncFrom;
	const overlapStart = addDays(lastSyncSuccessAt.slice(0, 10), -SYNC_OVERLAP_DAYS);
	return overlapStart > syncFrom ? overlapStart : syncFrom;
}

export function isSyncDue(lastSyncSuccessAt: string | null, now: Date) {
	return !lastSyncSuccessAt || now.getTime() - new Date(lastSyncSuccessAt).getTime() >= SYNC_INTERVAL_MS;
}

/** Stored status, with an authorized connection past its validity reported as expired */
export function connectionStatus(
	connection: { status: string; validUntil: string | null },
	now: Date,
): ConnectionStatus {
	if (connection.status === "authorized" && connection.validUntil && new Date(connection.validUntil) <= now) {
		return "expired";
	}
	return connection.status as ConnectionStatus;
}

/** Enable Banking error code → connection status after a failed sync */
export function statusAfterError(code: string | undefined): ConnectionStatus | null {
	switch (code) {
		case "EXPIRED_SESSION":
			return "expired";
		case "REVOKED_SESSION":
		case "CLOSED_SESSION":
			return "revoked";
		case "ASPSP_RATE_LIMIT_EXCEEDED":
			// keep the connection as is, next run retries
			return null;
		default:
			return "error";
	}
}

/** Manual transaction that may be the same operation as a bank line */
export function isMatchCandidate(
	line: { amount: number; transactionDate: string | null; bookingDate: string },
	transaction: { amount: number | null; date: string | null; externalId: string | null },
) {
	if (transaction.externalId || transaction.amount === null || !transaction.date) return false;
	if (Math.round(transaction.amount * 100) !== Math.round(line.amount * 100)) return false;
	const reference = line.transactionDate ?? line.bookingDate;
	return (
		transaction.date >= addDays(reference, -MATCH_WINDOW_DAYS) &&
		transaction.date <= addDays(line.bookingDate, MATCH_WINDOW_DAYS)
	);
}

const PAYMENT_TYPE_RULES: Array<{ line: RegExp; paymentType: RegExp }> = [
	{ line: /\b(CB|CARTE|CARD|PAIEMENT PAR CARTE)\b/i, paymentType: /\b(CB|carte|card)\b/i },
	{ line: /\b(PRLV|PRELEVEMENT|PRÉLÈVEMENT|DIRECT DEBIT)\b/i, paymentType: /pr[ée]l[èe]vement|prlv/i },
	{ line: /\b(VIR|VIREMENT|TRANSFER|SEPA CREDIT)\b/i, paymentType: /virement|vir\b|transfer/i },
	{ line: /\b(CHQ|CHEQUE|CHÈQUE)\b/i, paymentType: /ch[èe]que|chq/i },
	{ line: /\b(RETRAIT|DAB|ATM)\b/i, paymentType: /retrait|esp[èe]ces|liquide/i },
];

/** Pre-selected payment type for a bank line among the payment types of its account (the user always confirms) */
export function suggestPaymentType<P extends { id: number; name: string | null }>(
	line: { label: string; bankTransactionCode: string | null },
	paymentTypes: P[],
): number | null {
	const text = `${line.label} ${line.bankTransactionCode ?? ""}`;
	for (const rule of PAYMENT_TYPE_RULES) {
		if (!rule.line.test(text)) continue;
		const match = paymentTypes.find((p) => p.name && rule.paymentType.test(p.name));
		if (match) return match.id;
	}
	return paymentTypes.length === 1 ? paymentTypes[0].id : null;
}

export function normalizeIban(iban: string | null | undefined) {
	return iban ? iban.replace(/\s+/g, "").toUpperCase() : null;
}
