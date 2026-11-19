import type {
	LifespanEvent,
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

type SaveObject = NonNullable<LifespanObjectSaveBodyRequestType["object"]>;
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
		const object = await this.repo.findById(id);
		if (!object) {
			throw new NotFoundError("Objet introuvable");
		}
		const { events, ...rest } = object;
		return { ...rest, events: events?.toSorted(sortEventsDesc) ?? [] };
	}

	// The body schema's refine guarantees either an object (with optional events), or an event with its objectId
	save({ object, event, events, objectId }: LifespanObjectSaveBodyRequestType) {
		this.logger.log("save");
		if (object) {
			if (object.id) {
				// Update existing object
				return events
					? this.updateObjectWithEvents(object.id, object, events)
					: this.repo.update(object.id, object, missingFields(object, CLEARABLE_OBJECT_FIELDS));
			}
			// Add new object
			return this.repo.insert({ id: randomUUID(), ...object, events: (events ?? []).map(buildLifespanEvent) });
		}

		if (event && objectId) {
			if (event.id) {
				// Update existing event
				return this.repo.updateEvent(
					objectId,
					event as LifespanEvent,
					missingFields(event, CLEARABLE_EVENT_FIELDS),
				);
			}
			// Add new event to existing object
			return this.repo.pushEvent(objectId, buildLifespanEvent(event));
		}
	}

	deleteEvent(objectId: string, eventId: string) {
		this.logger.log("deleteEvent");
		return this.repo.deleteEvent(objectId, eventId);
	}

	delete(id: string) {
		this.logger.log("delete");
		return this.repo.delete(id);
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
