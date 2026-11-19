import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NodeAdapter, NestNodeApplication } from "@nestjs/platform-node";

import { AppModule } from "./app.module.js";
import { configureBodyParsers } from "./body-parsers.js";
import { Env } from "./config/env.schema.js";

async function bootstrap() {
	const app = await NestFactory.create<NestNodeApplication>(AppModule, new NodeAdapter());
	configureBodyParsers(app);
	const config = app.get<ConfigService<Env, true>>(ConfigService);
	app.enableCors({
		// credentials: the front sends the session cookie, which requires an explicit origin
		origin: config.get("FRONT_URL", { infer: true }),
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	});
	const port = config.get("PORT", { infer: true });
	app.enableShutdownHooks();
	await app.listen(port);
}
await bootstrap();
