import { Module } from "@nestjs/common";
import { RouterModule } from "@nestjs/core";

import { InternetSharedModule } from "./internet-shared.module.js";
import { InternetController } from "./internet.controller.js";
import { LatestModule } from "./latest/latest.module.js";
import { ReviewModule } from "./review/review.module.js";
import { StatsModule } from "./stats/stats.module.js";
import { SyncModule } from "./sync/sync.module.js";

@Module({
	imports: [
		InternetSharedModule,
		LatestModule,
		ReviewModule,
		StatsModule,
		SyncModule,
		RouterModule.register([
			{
				path: "internet",
				module: InternetModule,
				children: [
					{ path: "latest", module: LatestModule },
					{ path: "review", module: ReviewModule },
					{ path: "stats", module: StatsModule },
					{ path: "sync", module: SyncModule },
				],
			},
		]),
	],
	controllers: [InternetController],
})
export class InternetModule {}
