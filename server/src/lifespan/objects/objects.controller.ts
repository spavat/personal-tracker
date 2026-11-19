import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import {
	LifespanEventDeleteParamsRequestSchema,
	type LifespanEventDeleteParamsRequestType,
	LifespanEventParamsRequestSchema,
	LifespanEventSaveBodyRequestSchema,
	type LifespanEventSaveType,
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

	// the object, with its first events
	@Post()
	create(@Body({ schema: LifespanObjectSaveBodyRequestSchema }) body: LifespanObjectSaveBodyRequestType) {
		return this.service.create(body);
	}

	@Put(":id")
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
	createEvent(
		@Param({ schema: LifespanEventParamsRequestSchema }) { objectId }: { objectId: string },
		@Body({ schema: LifespanEventSaveBodyRequestSchema }) event: LifespanEventSaveType,
	) {
		return this.service.createEvent(objectId, event);
	}

	@Put(":objectId/events/:eventId")
	updateEvent(
		@Param({ schema: LifespanEventDeleteParamsRequestSchema }) {
			objectId,
			eventId,
		}: LifespanEventDeleteParamsRequestType,
		@Body({ schema: LifespanEventSaveBodyRequestSchema }) event: LifespanEventSaveType,
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
