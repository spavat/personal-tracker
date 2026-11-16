import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

// Subset of the Enable Banking API used by the bank sync (https://enablebanking.com/docs/api/reference/)

export interface EbAmount {
	currency: string;
	amount: string;
}

export interface EbAspsp {
	name: string;
	country: string;
	logo?: string;
	maximum_consent_validity?: number; // seconds
}

export interface EbAccount {
	uid?: string;
	identification_hash: string;
	account_id?: { iban?: string } | null;
	name?: string | null;
	currency?: string | null;
}

export interface EbSession {
	session_id: string;
	accounts: EbAccount[];
	access: { valid_until: string };
}

export interface EbTransaction {
	entry_reference?: string | null;
	transaction_amount: EbAmount;
	credit_debit_indicator: "CRDT" | "DBIT";
	status: string;
	booking_date?: string | null;
	value_date?: string | null;
	transaction_date?: string | null;
	remittance_information?: string[] | null;
	creditor?: { name?: string | null } | null;
	debtor?: { name?: string | null } | null;
	bank_transaction_code?: { description?: string | null; code?: string | null; sub_code?: string | null } | null;
}

export class EnableBankingError extends Error {
	constructor(
		public status: number,
		public code: string | undefined,
		message: string,
	) {
		super(message);
	}
}

export interface EnableBankingConfig {
	appId: string;
	keyPath: string;
	apiUrl: string;
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

export class EnableBankingClient {
	private token: { value: string; expiresAt: number } | null = null;
	private privateKey: string | null = null;

	constructor(private config: EnableBankingConfig) {}

	// JWT RS256, `kid` = application id, max TTL 24h (we use 1h)
	private getToken() {
		const now = Math.floor(Date.now() / 1000);
		if (this.token && this.token.expiresAt - 60 > now) return this.token.value;
		if (!this.config.appId || !this.config.keyPath) {
			throw new Error("Enable Banking non configuré (ENABLE_BANKING_APP_ID / ENABLE_BANKING_KEY_PATH)");
		}
		this.privateKey ??= readFileSync(this.config.keyPath, "utf8");
		const header = base64url(JSON.stringify({ typ: "JWT", alg: "RS256", kid: this.config.appId }));
		const payload = base64url(
			JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: now, exp: now + 3600 }),
		);
		const signature = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(this.privateKey);
		this.token = { value: `${header}.${payload}.${base64url(signature)}`, expiresAt: now + 3600 };
		return this.token.value;
	}

	private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		const response = await fetch(`${this.config.apiUrl}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${this.getToken()}`,
				...(body ? { "Content-Type": "application/json" } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
		});
		const text = await response.text();
		const data = text ? JSON.parse(text) : {};
		if (!response.ok) {
			throw new EnableBankingError(response.status, data.error, data.message ?? response.statusText);
		}
		return data as T;
	}

	async listAspsps(country: string) {
		const data = await this.request<{ aspsps: EbAspsp[] }>(
			"GET",
			`/aspsps?country=${encodeURIComponent(country)}&psu_type=personal&service=AIS`,
		);
		return data.aspsps;
	}

	startAuth(params: {
		aspsp: { name: string; country: string };
		validUntil: string;
		state: string;
		redirectUrl: string;
	}) {
		return this.request<{ url: string; authorization_id: string }>("POST", "/auth", {
			access: { valid_until: params.validUntil },
			aspsp: params.aspsp,
			state: params.state,
			redirect_url: params.redirectUrl,
			psu_type: "personal",
		});
	}

	createSession(code: string) {
		return this.request<EbSession>("POST", "/sessions", { code });
	}

	deleteSession(sessionId: string) {
		return this.request<unknown>("DELETE", `/sessions/${encodeURIComponent(sessionId)}`);
	}

	// booked transactions only: pending ones may change (or lose their entry_reference) once booked
	async listTransactions(accountUid: string, dateFrom: string) {
		const transactions: EbTransaction[] = [];
		let continuationKey: string | undefined;
		do {
			const query = new URLSearchParams({ date_from: dateFrom, transaction_status: "BOOK" });
			if (continuationKey) query.set("continuation_key", continuationKey);
			const page = await this.request<{ transactions: EbTransaction[]; continuation_key?: string | null }>(
				"GET",
				`/accounts/${encodeURIComponent(accountUid)}/transactions?${query}`,
			);
			console.log(">>>>", `/accounts/${encodeURIComponent(accountUid)}/transactions?${query}`);
			transactions.push(...page.transactions);
			continuationKey = page.continuation_key ?? undefined;
		} while (continuationKey);
		console.log("transactions", transactions.length, transactions);
		return transactions;
	}
}
