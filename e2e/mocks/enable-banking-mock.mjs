// Fake Enable Banking API (https://enablebanking.com/docs/api/reference/) for the e2e server, served by fetch-mock.mjs.
// - writes an RSA private key to ENABLE_BANKING_KEY_PATH (once) and checks every JWT against it (kid, signature, exp)
// - POST /auth sends the browser straight back to the redirect_url with a code: no bank page in the tests
// - one "Mock Bank" with a checking account (FR76 3000 1007 9412 3456 7890 185) holding 3 booked transactions,
//   dated relative to today, split over 2 pages; and a savings account without transactions
import { createPublicKey, createVerify, generateKeyPairSync, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const ENABLE_BANKING_MOCK_HOST = "api.enablebanking.mock";

const APP_ID = process.env.ENABLE_BANKING_APP_ID;
const KEY_PATH = process.env.ENABLE_BANKING_KEY_PATH;

// reuse the key file when present: this module may be evaluated more than once (loader threads), every copy must
// verify with the key the server signs with
function loadPublicKey() {
	if (KEY_PATH && existsSync(KEY_PATH)) {
		return createPublicKey(readFileSync(KEY_PATH, "utf8"));
	}
	const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
	if (KEY_PATH) {
		mkdirSync(dirname(KEY_PATH), { recursive: true });
		writeFileSync(KEY_PATH, privateKey.export({ type: "pkcs8", format: "pem" }));
	}
	return publicKey;
}
const publicKey = loadPublicKey();

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days) => new Date(Date.now() - days * DAY).toISOString().slice(0, 10);

const ACCOUNTS = [
	{
		uid: "e2e-uid-checking",
		identification_hash: "e2e-hash-checking",
		account_id: { iban: "FR7630001007941234567890185" },
		name: "Compte courant",
		currency: "EUR",
	},
	{
		uid: "e2e-uid-savings",
		identification_hash: "e2e-hash-savings",
		account_id: { iban: "FR7630001007940000000000999" },
		name: "Livret",
		currency: "EUR",
	},
];

// [page 1, page 2] of the checking account
const transactionPages = () => [
	[
		{
			entry_reference: "REF-1",
			transaction_amount: { currency: "EUR", amount: "42.10" },
			credit_debit_indicator: "DBIT",
			status: "BOOK",
			booking_date: daysAgo(2),
			value_date: daysAgo(2),
			transaction_date: daysAgo(3),
			remittance_information: ["CB CARREFOUR MARKET"],
		},
	],
	[
		{
			entry_reference: "REF-2",
			transaction_amount: { currency: "EUR", amount: "60.00" },
			credit_debit_indicator: "DBIT",
			status: "BOOK",
			booking_date: daysAgo(5),
			value_date: daysAgo(5),
			remittance_information: ["PRLV EDF"],
		},
		{
			entry_reference: "REF-3",
			transaction_amount: { currency: "EUR", amount: "2000.00" },
			credit_debit_indicator: "CRDT",
			status: "BOOK",
			booking_date: daysAgo(6),
			value_date: daysAgo(6),
			remittance_information: ["VIR SALAIRE"],
			debtor: { name: "EMPLOYEUR SA" },
		},
	],
];

const sessions = new Set();

const json = (status, body) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const error = (status, code, message) => json(status, { error: code, message });

function checkJwt(init) {
	const auth = new Headers(init?.headers).get("authorization") ?? "";
	const [header, payload, signature] = auth.replace(/^Bearer /, "").split(".");
	if (!header || !payload || !signature) return "missing JWT";
	const { kid, alg } = JSON.parse(Buffer.from(header, "base64url").toString());
	const { iss, aud, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
	if (alg !== "RS256" || kid !== APP_ID) return `wrong header ${alg} ${kid}`;
	if (iss !== "enablebanking.com" || aud !== "api.enablebanking.com") return "wrong claims";
	if (exp * 1000 < Date.now()) return "expired JWT";
	const valid = createVerify("RSA-SHA256")
		.update(`${header}.${payload}`)
		.verify(publicKey, Buffer.from(signature, "base64url"));
	return valid ? null : "bad signature";
}

export async function enableBankingMock(url, init) {
	const jwtError = checkJwt(init);
	if (jwtError) return error(401, "UNAUTHORIZED_ACCESS", jwtError);

	const method = (init?.method ?? "GET").toUpperCase();
	const body = init?.body ? JSON.parse(init.body) : {};
	const path = url.pathname;

	if (method === "GET" && path === "/aspsps") {
		const aspsps =
			url.searchParams.get("country") === "FR"
				? [{ name: "Mock Bank", country: "FR", maximum_consent_validity: 90 * 24 * 60 * 60 }]
				: [];
		return json(200, { aspsps });
	}

	if (method === "POST" && path === "/auth") {
		const redirect = new URL(body.redirect_url);
		redirect.searchParams.set("code", "e2e-code");
		redirect.searchParams.set("state", body.state);
		return json(200, { url: redirect.href, authorization_id: randomUUID() });
	}

	if (method === "POST" && path === "/sessions") {
		if (body.code !== "e2e-code") return error(400, "WRONG_AUTHORIZATION_CODE", "Wrong authorization code");
		const sessionId = randomUUID();
		sessions.add(sessionId);
		return json(200, {
			session_id: sessionId,
			accounts: ACCOUNTS,
			access: { valid_until: new Date(Date.now() + 90 * DAY).toISOString() },
		});
	}

	const session = path.match(/^\/sessions\/([^/]+)$/);
	if (method === "DELETE" && session) {
		sessions.delete(session[1]);
		return json(200, { message: "OK" });
	}

	const transactions = path.match(/^\/accounts\/([^/]+)\/transactions$/);
	if (method === "GET" && transactions) {
		if (transactions[1] !== "e2e-uid-checking") return json(200, { transactions: [], continuation_key: null });
		const pages = transactionPages();
		const page = url.searchParams.get("continuation_key") === "page-2" ? 1 : 0;
		const dateFrom = url.searchParams.get("date_from") ?? "";
		return json(200, {
			transactions: pages[page].filter((t) => t.booking_date >= dateFrom),
			continuation_key: page === 0 ? "page-2" : null,
		});
	}

	return error(404, "NOT_FOUND", `Enable Banking mock: no route for ${method} ${path}`);
}
