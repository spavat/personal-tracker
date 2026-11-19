import type { Logger } from "@nestjs/common";

/**
 * The logger framework-free use cases write to: pino-style (an object of details, then the message), so they stay
 * testable with a fake. `toUseCaseLog` writes it to a Nest `Logger`.
 */
export interface UseCaseLog {
	info(details: object | string, message?: string): void;
	warn(details: object, message: string): void;
	error(details: object, message: string): void;
}

export function toUseCaseLog(logger: Logger): UseCaseLog {
	const line = (details: object | string, message?: string) =>
		typeof details === "string" ? details : `${message} ${JSON.stringify(details)}`;
	return {
		info: (details, message) => logger.log(line(details, message)),
		warn: (details, message) => logger.warn(line(details, message)),
		error: (details, message) => logger.error(line(details, message)),
	};
}
