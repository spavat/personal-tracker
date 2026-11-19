import type { z } from "zod";

import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	Post,
	Put,
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

	@Post()
	@SerializeOptions({ schema: DetailsResponseSchema })
	create(@Body({ schema: SaveBodyRequestSchema }) body: SaveBodyRequest) {
		return this.service.create(body);
	}

	@Put(":id")
	@SerializeOptions({ schema: DetailsResponseSchema })
	update(
		@Param({ schema: DeleteParamsRequestSchema }) { id }: { id: string },
		@Body({ schema: SaveBodyRequestSchema }) body: SaveBodyRequest,
	) {
		return this.service.update(id, body);
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: DeleteParamsRequestSchema }) { id }: { id: string }) {
		await this.service.delete(id);
	}

	@Put(":id/segments")
	@SerializeOptions({ schema: DetailsResponseSchema })
	updateSegments(
		@Param({ schema: DeleteParamsRequestSchema }) { id }: { id: string },
		@Body({ schema: UpdateSegmentsBodyRequestSchema }) {
			segments,
		}: z.infer<typeof UpdateSegmentsBodyRequestSchema>,
	) {
		return this.service.updateSegments(id, segments);
	}

	// an action on the activity (not a CRUD write): 200 with the cropped activity
	@Post(":id/crop")
	@HttpCode(200)
	@SerializeOptions({ schema: DetailsResponseSchema })
	crop(
		@Param({ schema: DeleteParamsRequestSchema }) { id }: { id: string },
		@Body({ schema: CropBodyRequestSchema }) { startIndex, endIndex }: z.infer<typeof CropBodyRequestSchema>,
	) {
		return this.service.crop(id, startIndex, endIndex);
	}
}
