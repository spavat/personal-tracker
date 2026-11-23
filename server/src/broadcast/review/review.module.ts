import { Module } from "@nestjs/common";

import { BroadcastSharedModule } from "../broadcast-shared.module.js";
import { ReviewController } from "./review.controller.js";
import { ReviewService } from "./review.service.js";

@Module({
	imports: [BroadcastSharedModule],
	controllers: [ReviewController],
	providers: [ReviewService],
})
export class ReviewModule {}
