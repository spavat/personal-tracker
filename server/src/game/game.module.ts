import { Module } from "@nestjs/common";
import { RouterModule } from "@nestjs/core";

import { GameSharedModule } from "./game-shared.module.js";
import { GameController } from "./game.controller.js";
import { GameService } from "./game.service.js";
import { GameSyncModule } from "./sync/game-sync.module.js";

@Module({
	imports: [
		GameSharedModule,
		GameSyncModule,
		RouterModule.register([
			{ path: "game", module: GameModule, children: [{ path: "sync", module: GameSyncModule }] },
		]),
	],
	controllers: [GameController],
	providers: [GameService],
})
export class GameModule {}
