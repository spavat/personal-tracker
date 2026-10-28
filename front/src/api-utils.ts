// fetch doesn't reject on HTTP errors: throw so queries reach the route errorComponent and mutations their error state
export async function checkResponse(response: Response) {
	if (!response.ok) {
		// the server answers errors with { message }, but a proxy or a crash may not
		const body = await response.json().catch(() => null);
		throw new Error(body?.message ?? `${response.status} ${response.statusText}`);
	}
}

// credentials: sends the session cookie, the server denies writes and private reads without it
export async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, { ...init, credentials: "include" });
	await checkResponse(response);
	return response.json();
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
