import type {
	LifespanEvent,
	LifespanEventDeleteParamsRequestType,
	LifespanObjectListQuerystringRequestType,
	LifespanObjectSaveBodyRequestType,
} from "@personal-tracker/shared/lifespan";
import type { FastifyBaseLogger } from "fastify";

import { randomUUID } from "crypto";

import type { LifespanObjectRepository } from "./object.repository";

import { buildLifespanEvent, sortEventsDesc } from "./object.entity";

const CLEARABLE_OBJECT_FIELDS = ["description"] as const;
const CLEARABLE_EVENT_FIELDS = ["cause", "comment"] as const;

function missingFields<T extends object>(data: T, fields: ReadonlyArray<string>) {
	return fields.filter((field) => (data as Record<string, unknown>)[field] === undefined);
}

export class ListLifespanObjectsUseCase {
	constructor(private repo: LifespanObjectRepository) {}

	execute({ sort, search, categoryId }: LifespanObjectListQuerystringRequestType, log: FastifyBaseLogger) {
		log.info("ListLifespanObjectsUseCase.execute");
		const [sortField, sortDirection] = sort ?? ["name", "asc"];
		return this.repo.findAll({ search: search ?? "", categoryId, sortField, sortDirection });
	}
}

export class GetLifespanObjectUseCase {
	constructor(private repo: LifespanObjectRepository) {}

	async execute(id: string, log: FastifyBaseLogger) {
		log.info("GetLifespanObjectUseCase.execute");
		const res = await this.repo.findById(id);
		if (!res) return null;
		const { _id, events, ...rest } = res;
		return {
			...rest,
			events: events?.toSorted(sortEventsDesc) ?? [],
		};
	}
}

export class SaveLifespanObjectUseCase {
	constructor(private repo: LifespanObjectRepository) {}

	execute({ object, event, events, objectId }: LifespanObjectSaveBodyRequestType, log: FastifyBaseLogger) {
		log.info("SaveLifespanObjectUseCase.execute");
		if (objectId && object?.id) {
			throw new Error("Cannot provide both objectId and object.id");
		}

		if (object) {
			if (object.id) {
				// Update existing object
				return events
					? this.updateObjectWithEvents(object.id, object, events)
					: this.repo.update(object.id, object, missingFields(object, CLEARABLE_OBJECT_FIELDS));
			}
			// Add new object
			return this.repo.insert({
				id: randomUUID(),
				...object,
				events: (events ?? []).map((e) => buildLifespanEvent(e)),
			});
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

		return { error: "Nothing to do" };
	}

	// The provided events replace the whole list (missing ones are deleted).
	// Known events keep their stored "created" (same-day ordering), unknown ones are built as new.
	private async updateObjectWithEvents(
		id: string,
		object: NonNullable<LifespanObjectSaveBodyRequestType["object"]>,
		events: NonNullable<LifespanObjectSaveBodyRequestType["events"]>,
	) {
		const existing = await this.repo.findById(id);
		const existingById = new Map<string, LifespanEvent>(
			(existing?.events ?? []).map((e: LifespanEvent) => [e.id, e]),
		);
		const nextEvents = events.map((e) => {
			const previous = e.id ? existingById.get(e.id) : undefined;
			return previous ? ({ ...e, created: previous.created } as LifespanEvent) : buildLifespanEvent(e);
		});
		return this.repo.update(id, { ...object, events: nextEvents }, missingFields(object, CLEARABLE_OBJECT_FIELDS));
	}
}

export class DeleteLifespanEventUseCase {
	constructor(private repo: LifespanObjectRepository) {}

	execute({ eventId, objectId }: LifespanEventDeleteParamsRequestType, log: FastifyBaseLogger) {
		log.info("DeleteLifespanEventUseCase.execute");
		if (!eventId || !objectId) {
			throw new Error("Both eventId and objectId are required");
		}
		return this.repo.deleteEvent(objectId, eventId);
	}
}

export class DeleteLifespanObjectUseCase {
	constructor(private repo: LifespanObjectRepository) {}

	execute(id: string, log: FastifyBaseLogger) {
		log.info("DeleteLifespanObjectUseCase.execute");
		return this.repo.delete(id);
	}
}
