import { Controller, Get, SerializeOptions } from "@nestjs/common";
import { ReviewEpisodesResponseSchema } from "@personal-tracker/shared/internet";

import { ReviewService } from "./review.service.js";

@Controller()
export class ReviewController {
	constructor(private readonly service: ReviewService) {}

	@Get()
	@SerializeOptions({ schema: ReviewEpisodesResponseSchema.element })
	untaggedEpisodes() {
		return this.service.untaggedEpisodes();
	}
}
