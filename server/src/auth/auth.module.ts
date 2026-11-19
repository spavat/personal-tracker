import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";

import { Env } from "../config/env.schema.js";
import { DatabaseModule } from "../database/database.module.js";
import { DRIZZLE } from "../database/database.tokens.js";
import { Drizzle } from "../database/drizzle.js";
import { AuthHandlerMiddleware } from "./auth-handler.middleware.js";
import { AuthGuard } from "./auth.guard.js";
import { createAuth } from "./auth.js";
import { AUTH } from "./auth.tokens.js";

@Module({
	imports: [DatabaseModule],
	providers: [
		{
			provide: AUTH,
			useFactory: (db: Drizzle, config: ConfigService<Env, true>) =>
				createAuth(db, {
					secret: config.get("BETTER_AUTH_SECRET", { infer: true }),
					baseURL: config.get("BETTER_AUTH_URL", { infer: true }),
					trustedOrigins: config.get("FRONT_URL", { infer: true }),
				}),
			inject: [DRIZZLE, ConfigService],
		},
		{ provide: APP_GUARD, useClass: AuthGuard },
	],
	exports: [AUTH],
})
export class AuthModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		// a middleware, not a controller: better-auth answers before the guard, which never sees /auth/*
		consumer.apply(AuthHandlerMiddleware).forRoutes("auth");
	}
}
