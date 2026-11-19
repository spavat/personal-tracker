import type { ErrorBody } from "@personal-tracker/shared/errors";

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";

import {
	BadRequestError,
	ConflictError,
	DomainError,
	NotFoundError,
	UpstreamError,
	ValidationError,
} from "./errors.js";

function statusOf(exception: DomainError) {
	if (exception instanceof NotFoundError) return HttpStatus.NOT_FOUND;
	if (exception instanceof ConflictError) return HttpStatus.CONFLICT;
	if (exception instanceof UpstreamError) return HttpStatus.BAD_GATEWAY;
	if (exception instanceof BadRequestError || exception instanceof ValidationError) return HttpStatus.BAD_REQUEST;
	return HttpStatus.INTERNAL_SERVER_ERROR;
}

function toBody(exception: unknown): ErrorBody {
	if (exception instanceof DomainError) {
		return {
			statusCode: statusOf(exception),
			code: exception.code,
			message: exception.message,
			...(exception.params ? { params: exception.params } : {}),
			...(exception instanceof ValidationError ? { issues: exception.issues } : {}),
		};
	}
	if (exception instanceof HttpException) {
		const statusCode = exception.getStatus();
		return {
			statusCode,
			code: statusCode === HttpStatus.UNAUTHORIZED ? "unauthorized" : "http_error",
			message: exception.message,
		};
	}
	return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, code: "internal", message: "Internal server error" };
}

// Every error answers the same body (ErrorBodySchema): the domain errors, Nest's own (401, unknown route…) and the
// unexpected ones (500, logged)
@Catch()
export class ErrorFilter implements ExceptionFilter {
	private readonly logger = new Logger(ErrorFilter.name);

	constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

	catch(exception: unknown, host: ArgumentsHost) {
		// In certain situations `httpAdapter` might not be available in the constructor, so resolve it here.
		const { httpAdapter } = this.httpAdapterHost;
		const body = toBody(exception);
		if (body.code === "internal") {
			this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
		}
		httpAdapter.reply(host.switchToHttp().getResponse(), body, body.statusCode);
	}
}
