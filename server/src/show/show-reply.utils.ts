import type { ErrorResource } from "@personal-tracker/shared/errors";

import { NotFoundError } from "../common/errors.js";

// the show reads and saves answer 404 for an unknown id (null / undefined)
export async function orNotFound<T>(found: Promise<T | null | undefined>, resource: ErrorResource): Promise<T> {
	return (await found) ?? Promise.reject(new NotFoundError(resource));
}
