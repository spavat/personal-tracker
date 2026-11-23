import { Module } from "@nestjs/common";
import { RouterModule } from "@nestjs/core";

import { BroadcastSharedModule } from "./broadcast-shared.module.js";
import { BroadcastController } from "./broadcast.controller.js";
import { LatestModule } from "./latest/latest.module.js";
import { ReviewModule } from "./review/review.module.js";
import { StatsModule } from "./stats/stats.module.js";
import { SyncModule } from "./sync/sync.module.js";

@Module({
	imports: [
		BroadcastSharedModule,
		LatestModule,
		ReviewModule,
		StatsModule,
		SyncModule,
		RouterModule.register([
			{
				path: "broadcast",
				module: BroadcastModule,
				children: [
					{ path: "latest", module: LatestModule },
					{ path: "review", module: ReviewModule },
					{ path: "stats", module: StatsModule },
					{ path: "sync", module: SyncModule },
				],
			},
		]),
	],
	controllers: [BroadcastController],
})
export class BroadcastModule {}
