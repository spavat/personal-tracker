import type {
	LifespanEvent,
	LifespanEventSaveType,
	LifespanObjectListQuerystringRequestType,
	LifespanObjectSaveBodyRequestType,
} from "@personal-tracker/shared/lifespan";

import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { NotFoundError } from "../../common/errors.js";
import { buildLifespanEvent, missingFields, sortEventsDesc } from "./object.entity.js";
import { LifespanObjectsRepository } from "./objects.repository.js";

const CLEARABLE_OBJECT_FIELDS = ["description"] as const;
const CLEARABLE_EVENT_FIELDS = ["cause", "comment"] as const;

type SaveObject = Omit<LifespanObjectSaveBodyRequestType["object"], "id">;
type SaveEvents = NonNullable<LifespanObjectSaveBodyRequestType["events"]>;

@Injectable()
export class LifespanObjectsService {
	private readonly logger = new Logger(LifespanObjectsService.name);
	constructor(private readonly repo: LifespanObjectsRepository) {}

	list({ sort, search, categoryId }: LifespanObjectListQuerystringRequestType) {
		this.logger.log("list");
		const [sortField, sortDirection] = sort ?? ["name", "asc"];
		return this.repo.findAll({ search: search ?? "", categoryId, sortField, sortDirection });
	}

	async get(id: string) {
		this.logger.log("get");
		const { events, ...rest } = (await this.repo.findById(id)) ?? objectNotFound();
		return { ...rest, events: events?.toSorted(sortEventsDesc) ?? [] };
	}

	create({ object: { id: _, ...object }, events }: LifespanObjectSaveBodyRequestType) {
		this.logger.log("create");
		return this.repo.insert({ id: randomUUID(), ...object, events: (events ?? []).map(buildLifespanEvent) });
	}

	// the events, when sent, replace the whole list
	async update(id: string, { object: { id: _, ...object }, events }: LifespanObjectSaveBodyRequestType) {
		this.logger.log("update");
		const updated = events
			? await this.updateObjectWithEvents(id, object, events)
			: await this.repo.update(id, object, missingFields(object, CLEARABLE_OBJECT_FIELDS));
		return updated ?? objectNotFound();
	}

	async delete(id: string) {
		this.logger.log("delete");
		if (!(await this.repo.delete(id))) {
			objectNotFound();
		}
	}

	async createEvent(objectId: string, { id: _, ...fields }: LifespanEventSaveType) {
		this.logger.log("createEvent");
		const event = buildLifespanEvent(fields);
		if (!(await this.repo.pushEvent(objectId, event))) {
			objectNotFound();
		}
		return event;
	}

	async updateEvent(objectId: string, eventId: string, { id: _, ...fields }: LifespanEventSaveType) {
		this.logger.log("updateEvent");
		const event = { ...fields, id: eventId } as LifespanEvent;
		if (!(await this.repo.updateEvent(objectId, event, missingFields(fields, CLEARABLE_EVENT_FIELDS)))) {
			eventNotFound();
		}
		// the stored event: its "created" is kept
		return (await this.repo.findById(objectId))?.events.find((e) => e.id === eventId) ?? eventNotFound();
	}

	async deleteEvent(objectId: string, eventId: string) {
		this.logger.log("deleteEvent");
		if (!(await this.repo.deleteEvent(objectId, eventId))) {
			eventNotFound();
		}
	}

	// The provided events replace the whole list (missing ones are deleted).
	// Known events keep their stored "created" (same-day ordering), unknown ones are built as new.
	private async updateObjectWithEvents(id: string, object: SaveObject, events: SaveEvents) {
		const existing = await this.repo.findById(id);
		const existingById = new Map((existing?.events ?? []).map((e) => [e.id, e]));
		const nextEvents = events.map((e) => {
			const previous = e.id ? existingById.get(e.id) : undefined;
			return previous ? ({ ...e, created: previous.created } as LifespanEvent) : buildLifespanEvent(e);
		});
		return this.repo.update(id, { ...object, events: nextEvents }, missingFields(object, CLEARABLE_OBJECT_FIELDS));
	}
}

function objectNotFound(): never {
	throw new NotFoundError("object");
}

function eventNotFound(): never {
	throw new NotFoundError("event");
}
