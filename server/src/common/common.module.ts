import {
	BadRequestException,
	MiddlewareConsumer,
	Module,
	NestModule,
	StandardSchemaSerializerInterceptor,
	StandardSchemaValidationPipe,
} from "@nestjs/common";
import { APP_PIPE, APP_FILTER, Reflector, APP_INTERCEPTOR } from "@nestjs/core";

import { DomainErrorFilter } from "./domain.filter.js";
import { RequestContextMiddleware } from "./request-context.middleware.js";
import { TimingInterceptor } from "./timing.interceptor.js";

// A 400 whose `message` is one string ("path: message; ..."), as the Fastify server answered:
// the front shows `body.message` as is (api-utils.ts), the pipe's default would be an array.
const validationPipe = new StandardSchemaValidationPipe({
	exceptionFactory: (issues) =>
		new BadRequestException(
			issues
				.map(({ path, message }) => {
					const at = (path ?? []).map((segment) =>
						String(typeof segment === "object" ? segment.key : segment),
					);
					return at.length ? `${at.join(".")}: ${message}` : message;
				})
				.join("; "),
		),
});

@Module({
	providers: [
		{ provide: APP_PIPE, useValue: validationPipe },
		{ provide: APP_FILTER, useClass: DomainErrorFilter },
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
