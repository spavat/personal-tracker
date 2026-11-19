import { NotFoundError } from "../common/errors.js";

// the show reads and saves answer 404 for an unknown id (null / undefined)
export async function orNotFound<T>(found: Promise<T | null | undefined>, message: string): Promise<T> {
	return (await found) ?? Promise.reject(new NotFoundError(message));
}
