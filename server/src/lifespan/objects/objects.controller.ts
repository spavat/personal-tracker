import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import {
	LifespanEventDeleteParamsRequestSchema,
	type LifespanEventDeleteParamsRequestType,
	LifespanObjectDeleteParamsRequestSchema,
	LifespanObjectDetailsParamsRequestSchema,
	LifespanObjectListQuerystringRequestSchema,
	type LifespanObjectListQuerystringRequestType,
	LifespanObjectSaveBodyRequestSchema,
	type LifespanObjectSaveBodyRequestType,
} from "@personal-tracker/shared/lifespan";

import { LifespanObjectsService } from "./objects.service.js";

@Controller()
export class LifespanObjectsController {
	constructor(private readonly service: LifespanObjectsService) {}

	@Get()
	list(
		@Query({ schema: LifespanObjectListQuerystringRequestSchema }) query: LifespanObjectListQuerystringRequestType,
	) {
		return this.service.list(query);
	}

	@Get(":id")
	get(@Param({ schema: LifespanObjectDetailsParamsRequestSchema }) { id }: { id: string }) {
		return this.service.get(id);
	}

	@Post("save")
	@HttpCode(200)
	save(@Body({ schema: LifespanObjectSaveBodyRequestSchema }) body: LifespanObjectSaveBodyRequestType) {
		return this.service.save(body);
	}

	@Delete(":objectId/events/:eventId")
	deleteEvent(
		@Param({ schema: LifespanEventDeleteParamsRequestSchema }) {
			objectId,
			eventId,
		}: LifespanEventDeleteParamsRequestType,
	) {
		return this.service.deleteEvent(objectId, eventId);
	}

	@Delete(":id")
	delete(@Param({ schema: LifespanObjectDeleteParamsRequestSchema }) { id }: { id: string }) {
		return this.service.delete(id);
	}
}
