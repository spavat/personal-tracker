import { Controller, Get, Inject, Logger, ServiceUnavailableException } from "@nestjs/common";
import { Db } from "mongodb";

import { Public } from "../auth/public.decorator.js";
import { MONGO_DB } from "../database/database.tokens.js";

@Controller("health")
@Public()
export class HealthController {
	private readonly logger = new Logger(HealthController.name);
	constructor(@Inject(MONGO_DB) private readonly db: Db) {}

	@Get()
	async check() {
		try {
			await this.db.command({ ping: 1 });
		} catch (error) {
			this.logger.error("MongoDB ping failed", error);
			throw new ServiceUnavailableException("MongoDB unreachable");
		}
		return { status: "ok", mongo: "up", time: new Date().toISOString() };
	}
}
