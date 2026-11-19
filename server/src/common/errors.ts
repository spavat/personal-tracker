import type { ErrorCode, ErrorIssue, ErrorParams, ErrorResource } from "@personal-tracker/shared/errors";

/**
 * A domain error, answered by ErrorFilter: the front translates its `code` (with its `params`), `message` is English,
 * for logs and developers (see .scratch/error-codes/spec.md).
 */
export abstract class DomainError extends Error {
	constructor(
		readonly code: ErrorCode,
		message: string,
		readonly params?: ErrorParams,
	) {
		super(message);
	}
}

// 404. `resource`: the one not found; another code for a missing part ("sport.no_gpx")
export class NotFoundError extends DomainError {
	override name = "NotFoundError";
	constructor(resource: ErrorResource, code: ErrorCode = "not_found", message = `${resource} not found`) {
		super(code, message, { resource });
	}
}

// 409
export class ConflictError extends DomainError {
	override name = "ConflictError";
}

// 400: input that passes the request schema but the domain cannot use (e.g. a GPX file without a date)
export class BadRequestError extends DomainError {
	override name = "BadRequestError";
}

// 502: an outside service (RSS feed, YouTube, gopodder...) failed or is not configured
export class UpstreamError extends DomainError {
	override name = "UpstreamError";
}

// 400 from the validation pipe: the request schema refused the input
export class ValidationError extends DomainError {
	override name = "ValidationError";
	constructor(readonly issues: ErrorIssue[]) {
		super(
			"validation",
			issues.map(({ path, message }) => (path.length ? `${path.join(".")}: ${message}` : message)).join("; "),
		);
	}
}
