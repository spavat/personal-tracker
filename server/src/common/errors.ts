export class NotFoundError extends Error {
	override name = "NotFoundError";
}

export class ConflictError extends Error {
	override name = "ConflictError";
}

// Input that passes the request schema but the domain cannot use (e.g. a GPX file without a date)
export class BadRequestError extends Error {
	override name = "BadRequestError";
}

// An outside service (RSS feed, YouTube, gopodder...) failed or is not configured
export class UpstreamError extends Error {
	override name = "UpstreamError";
}
