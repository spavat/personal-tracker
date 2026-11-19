import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";

import { BadRequestError, ConflictError, NotFoundError, UpstreamError } from "./errors.js";

type DomainError = NotFoundError | ConflictError | BadRequestError | UpstreamError;

function toHttp(exception: DomainError) {
	if (exception instanceof ConflictError) return { statusCode: HttpStatus.CONFLICT, error: "Conflict" };
	if (exception instanceof BadRequestError) return { statusCode: HttpStatus.BAD_REQUEST, error: "Bad Request" };
	if (exception instanceof UpstreamError) return { statusCode: HttpStatus.BAD_GATEWAY, error: "Bad Gateway" };
	return { statusCode: HttpStatus.NOT_FOUND, error: "Not Found" };
}

@Catch(NotFoundError, ConflictError, BadRequestError, UpstreamError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
	constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

	catch(exception: DomainError, host: ArgumentsHost) {
		// In certain situations `httpAdapter` might not be available in the
		// constructor, so resolve it here.
		const { httpAdapter } = this.httpAdapterHost;

		const ctx = host.switchToHttp();
		const { statusCode, error } = toHttp(exception);

		httpAdapter.reply(ctx.getResponse(), { statusCode, error, message: exception.message }, statusCode);
	}
}
