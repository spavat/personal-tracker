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

type TransformArgs = Parameters<StandardSchemaSerializerInterceptor["transformToPlain"]>;
type Issue = NonNullable<
	Extract<Awaited<ReturnType<TransformArgs[1]["~standard"]["validate"]>>, { issues: unknown }>["issues"]
>[number];

const plainPath = (path: Issue["path"]) =>
	(path ?? []).map((segment) => (typeof segment === "object" ? (segment.key as string | number) : segment)) as Array<
		string | number
	>;

// A 400 `validation` error with zod's issues, their path as plain keys
const validationPipe = new StandardSchemaValidationPipe({
	exceptionFactory: (issues) =>
		new ValidationError(
			issues.map(({ path, message, ...issue }) => ({
				path: plainPath(path),
				...("code" in issue && typeof issue.code === "string" ? { code: issue.code } : {}),
				message,
			})),
		),
});

// Nest's serializer only logs the issues' messages: prefix each with its path
class SerializerInterceptor extends StandardSchemaSerializerInterceptor {
	override async transformToPlain(...[plainOrClass, schema, validateOptions]: TransformArgs) {
		if (!plainOrClass) {
			return plainOrClass;
		}
		const result = await schema["~standard"].validate(plainOrClass, validateOptions);
		if (result.issues) {
			const issues = result.issues.map(
				({ path, message }) => `${plainPath(path).join(".") || "(root)"}: ${message}`,
			);
			throw new Error(`Serialization failed: ${issues.join(", ")}`);
		}
		return result.value as Awaited<ReturnType<StandardSchemaSerializerInterceptor["transformToPlain"]>>;
	}
}

@Module({
	providers: [
		{ provide: APP_PIPE, useValue: validationPipe },
		{ provide: APP_FILTER, useClass: ErrorFilter },
		{ provide: APP_INTERCEPTOR, useClass: TimingInterceptor },
		{
			provide: APP_INTERCEPTOR,
			inject: [Reflector],
			useFactory: (reflector: Reflector) => new SerializerInterceptor(reflector),
		},
	],
})
export class CommonModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(RequestContextMiddleware).forRoutes("*path");
	}
}
