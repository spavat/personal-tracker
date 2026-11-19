import {
	MiddlewareConsumer,
	Module,
	NestModule,
	StandardSchemaSerializerInterceptor,
	StandardSchemaValidationPipe,
} from "@nestjs/common";
import { APP_PIPE, APP_FILTER, Reflector, APP_INTERCEPTOR } from "@nestjs/core";

import { ErrorFilter } from "./error.filter.js";
import { ValidationError } from "./errors.js";
import { RequestContextMiddleware } from "./request-context.middleware.js";
import { TimingInterceptor } from "./timing.interceptor.js";

// A 400 `validation` error with zod's issues, their path as plain keys
const validationPipe = new StandardSchemaValidationPipe({
	exceptionFactory: (issues) =>
		new ValidationError(
			issues.map(({ path, message, ...issue }) => ({
				path: (path ?? []).map((segment) =>
					typeof segment === "object" ? (segment.key as string | number) : segment,
				) as Array<string | number>,
				...("code" in issue && typeof issue.code === "string" ? { code: issue.code } : {}),
				message,
			})),
		),
});

@Module({
	providers: [
		{ provide: APP_PIPE, useValue: validationPipe },
		{ provide: APP_FILTER, useClass: ErrorFilter },
		{ provide: APP_INTERCEPTOR, useClass: TimingInterceptor },
		{
			provide: APP_INTERCEPTOR,
			inject: [Reflector],
			useFactory: (reflector: Reflector) => new StandardSchemaSerializerInterceptor(reflector),
		},
	],
})
export class CommonModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(RequestContextMiddleware).forRoutes("*path");
	}
}
