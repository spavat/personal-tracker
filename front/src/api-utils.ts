import { type ErrorBody, ErrorBodySchema } from "@personal-tracker/shared/errors";

import { errorText } from "./error-messages";

// An API error: `message` is its French text, `code` / `params` / `issues` the server's (ErrorBodySchema)
export class ApiError extends Error {
	override name = "ApiError";
	constructor(readonly body: ErrorBody) {
		super(errorText(body));
	}
	get status() {
		return this.body.statusCode;
	}
	get code() {
		return this.body.code;
	}
}

// fetch doesn't reject on HTTP errors: throw so queries reach the route errorComponent and mutations their error state
export async function checkResponse(response: Response) {
	if (!response.ok) {
		// the server answers errors with ErrorBodySchema, but a proxy or a crash may not
		const parsed = ErrorBodySchema.safeParse(await response.json().catch(() => null));
		throw new ApiError(
			parsed.success
				? parsed.data
				: { statusCode: response.status, code: "http_error", message: response.statusText },
		);
	}
}

// credentials: sends the session cookie, the server denies writes and private reads without it
export async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, { ...init, credentials: "include" });
	await checkResponse(response);
	// 204 No Content: nothing to parse
	return response.status === 204 ? (undefined as T) : response.json();
}

// no Content-Type without a body: fastify rejects an empty body announced as JSON
export async function sendJson<T = any>(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown) {
	return fetchJson<T>(
		url,
		body === undefined
			? { method }
			: { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
	);
}

// a resource without an id is created (POST url), with one it's updated (PUT url/:id)
export async function saveJson<T = any>(url: string, body: { id?: string | number | null }) {
	return body.id ? sendJson<T>(`${url}/${body.id}`, "PUT", body) : sendJson<T>(url, "POST", body);
}

type QueryValue = string | number | boolean | null | undefined;

// encodes values and drops null/undefined/empty ones; arrays repeat the key (?sort=a&sort=b)
export function withQuery(url: string, params: Record<string, QueryValue | QueryValue[]>) {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		for (const item of Array.isArray(value) ? value : [value]) {
			if (item !== null && item !== undefined && item !== "") {
				search.append(key, String(item));
			}
		}
	}
	const query = search.toString();
	return query ? `${url}?${query}` : url;
}
