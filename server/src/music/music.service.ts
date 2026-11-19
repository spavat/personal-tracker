import type { SaveBodyRequestSchema } from "@personal-tracker/shared/music";
import type { z } from "zod";

import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { NotFoundError } from "../common/errors.js";
import { cleanListening } from "./music.entity.js";
import { MusicRepository } from "./music.repository.js";

export type SaveListeningBody = z.infer<typeof SaveBodyRequestSchema>;

@Injectable()
export class MusicService {
	private readonly logger = new Logger(MusicService.name);
	constructor(private readonly repo: MusicRepository) {}

	list({ from, to }: { from?: string; to?: string }) {
		this.logger.log("list");
		return this.repo.findAll({ from, to });
	}

	search(search: string | undefined) {
		this.logger.log("search");
		return this.repo.searchListenings(search);
	}

	async get(id: string) {
		this.logger.log("get");
		return (await this.repo.findById(id)) ?? notFound();
	}

	create({ id: _, ...data }: SaveListeningBody) {
		this.logger.log("create");
		return this.repo.insert({
			id: randomUUID(),
			created: Temporal.Now.plainDateTimeISO().toString(),
			...cleanListening(data),
		});
	}

	async update(id: string, { id: _, ...data }: SaveListeningBody) {
		this.logger.log("update");
		return (await this.repo.update(id, cleanListening(data))) ?? notFound();
	}

	async delete(id: string) {
		this.logger.log("delete");
		if (!(await this.repo.delete(id))) {
			notFound();
		}
	}
}

function notFound(): never {
	throw new NotFoundError("listening");
}
