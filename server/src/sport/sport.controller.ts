import type { z } from "zod";

import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	Post,
	Query,
	Redirect,
	SerializeOptions,
} from "@nestjs/common";
import {
	CropBodyRequestSchema,
	DeleteParamsRequestSchema,
	DetailsQuerystringRequestSchema,
	DetailsResponseSchema,
	ListQuerystringRequestSchema,
	ListResponseSchema,
	type SaveBodyRequest,
	SaveBodyRequestSchema,
	UpdateSegmentsBodyRequestSchema,
} from "@personal-tracker/shared/sport";

import { SportService } from "./sport.service.js";

@Controller("sport")
export class SportController {
	constructor(private readonly service: SportService) {}

	@Get("list")
	@SerializeOptions({ schema: ListResponseSchema.element })
	list(@Query({ schema: ListQuerystringRequestSchema }) query: z.infer<typeof ListQuerystringRequestSchema>) {
		return this.service.list(query);
	}

	@Get("id")
	@SerializeOptions({ schema: DetailsResponseSchema })
	get(@Query({ schema: DetailsQuerystringRequestSchema }) { id }: { id: string }) {
		return this.service.get(id);
	}

	// @Redirect() without a url: the handler returns it (302, as Fastify's reply.redirect)
	@Get("download")
	@Redirect()
	async download(@Query({ schema: DetailsQuerystringRequestSchema }) { id }: { id: string }) {
		return { url: await this.service.downloadUrl(id) };
	}

	@Post("save")
	@HttpCode(200)
	save(@Body({ schema: SaveBodyRequestSchema }) body: SaveBodyRequest) {
		return this.service.save(body);
	}

	@Delete(":id")
	delete(@Param({ schema: DeleteParamsRequestSchema }) { id }: { id: string }) {
		return this.service.delete(id);
	}

	@Post("segments")
	@HttpCode(200)
	updateSegments(
		@Body({ schema: UpdateSegmentsBodyRequestSchema }) {
			id,
			segments,
		}: z.infer<typeof UpdateSegmentsBodyRequestSchema>,
	) {
		return this.service.updateSegments(id, segments);
	}

	@Post("crop")
	@HttpCode(200)
	crop(@Body({ schema: CropBodyRequestSchema }) { id, startIndex, endIndex }: z.infer<typeof CropBodyRequestSchema>) {
		return this.service.crop(id, startIndex, endIndex);
	}
}
