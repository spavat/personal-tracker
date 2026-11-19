import type { ServerResponse } from "node:http";

import { NotFoundError } from "../common/errors.js";

/**
 * The show saves answer 201 with the created row, 200 with the updated one, and 404 when an update matched nothing.
 * `response` comes from `@Res({ passthrough: true })`: the status is set on it, Nest still sends the returned value.
 */
export async function savedOr404<T>(
	response: ServerResponse,
	isUpdate: boolean,
	saved: Promise<T | null | undefined>,
	notFoundMessage: string,
): Promise<T> {
	const row = await saved;
	if (!row) {
		throw new NotFoundError(notFoundMessage);
	}
	response.statusCode = isUpdate ? 200 : 201;
	return row;
}

export async function orNotFound<T>(found: Promise<T | null | undefined>, message: string): Promise<T> {
	return (await found) ?? Promise.reject(new NotFoundError(message));
}
