import { Module } from "@nestjs/common";

import { BroadcastSharedModule } from "../broadcast-shared.module.js";
import { WatchlistController } from "./watchlist.controller.js";
import { WatchlistService } from "./watchlist.service.js";

@Module({
	imports: [BroadcastSharedModule],
	controllers: [WatchlistController],
	providers: [WatchlistService],
})
export class WatchlistModule {}
