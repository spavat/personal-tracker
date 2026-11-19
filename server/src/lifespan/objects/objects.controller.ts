import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, SerializeOptions } from "@nestjs/common";
import {
	LifespanEventDeleteParamsRequestSchema,
	type LifespanEventDeleteParamsRequestType,
	LifespanEventParamsRequestSchema,
	LifespanEventSaveBodyRequestSchema,
	LifespanEventSchema,
	type LifespanEventSaveBodyRequestType,
	LifespanObjectDeleteParamsRequestSchema,
	LifespanObjectDetailsParamsRequestSchema,
	LifespanObjectListQuerystringRequestSchema,
	type LifespanObjectListQuerystringRequestType,
	LifespanObjectSaveBodyRequestSchema,
	LifespanObjectSchema,
	type LifespanObjectSaveBodyRequestType,
	LifespanObjectWithStatusSchema,
} from "@personal-tracker/shared/lifespan";

import { LifespanObjectsService } from "./objects.service.js";

@Controller()
export class LifespanObjectsController {
	constructor(private readonly service: LifespanObjectsService) {}

	@Get()
	@SerializeOptions({ schema: LifespanObjectWithStatusSchema })
	list(
		@Query({ schema: LifespanObjectListQuerystringRequestSchema }) query: LifespanObjectListQuerystringRequestType,
	) {
		return this.service.list(query);
	}

	@Get(":id")
	@SerializeOptions({ schema: LifespanObjectWithStatusSchema })
	get(@Param({ schema: LifespanObjectDetailsParamsRequestSchema }) { id }: { id: string }) {
		return this.service.get(id);
	}

	// the object, with its first events
	@Post()
	@SerializeOptions({ schema: LifespanObjectSchema })
	create(@Body({ schema: LifespanObjectSaveBodyRequestSchema }) body: LifespanObjectSaveBodyRequestType) {
		return this.service.create(body);
	}

	@Put(":id")
	@SerializeOptions({ schema: LifespanObjectSchema })
	update(
		@Param({ schema: LifespanObjectDeleteParamsRequestSchema }) { id }: { id: string },
		@Body({ schema: LifespanObjectSaveBodyRequestSchema }) body: LifespanObjectSaveBodyRequestType,
	) {
		return this.service.update(id, body);
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: LifespanObjectDeleteParamsRequestSchema }) { id }: { id: string }) {
		await this.service.delete(id);
	}

	@Post(":objectId/events")
	@SerializeOptions({ schema: LifespanEventSchema })
	createEvent(
		@Param({ schema: LifespanEventParamsRequestSchema }) { objectId }: { objectId: string },
		@Body({ schema: LifespanEventSaveBodyRequestSchema }) event: LifespanEventSaveBodyRequestType,
	) {
		return this.service.createEvent(objectId, event);
	}

	@Put(":objectId/events/:eventId")
	@SerializeOptions({ schema: LifespanEventSchema })
	updateEvent(
		@Param({ schema: LifespanEventDeleteParamsRequestSchema }) {
			objectId,
			eventId,
		}: LifespanEventDeleteParamsRequestType,
		@Body({ schema: LifespanEventSaveBodyRequestSchema }) event: LifespanEventSaveBodyRequestType,
	) {
		return this.service.updateEvent(objectId, eventId, event);
	}

	@Delete(":objectId/events/:eventId")
	@HttpCode(204)
	async deleteEvent(
		@Param({ schema: LifespanEventDeleteParamsRequestSchema }) {
			objectId,
			eventId,
		}: LifespanEventDeleteParamsRequestType,
	) {
		await this.service.deleteEvent(objectId, eventId);
	}
}
