import type { ServerResponse } from "node:http";
import type { Readable } from "node:stream";

import { Controller, Get, Headers, Param, Res, StreamableFile } from "@nestjs/common";
import { GameImageParamsSchema } from "@personal-tracker/shared/game";
import * as z from "zod";

import type { GameImageField } from "../game/game-images.storage.js";

import { Public } from "../auth/public.decorator.js";
import { NotFoundError } from "../common/errors.js";
import { EntitiesRepository } from "../entities/entities.repository.js";
import { GameRepository } from "../game/game.repository.js";
import { InternetRepository } from "../internet/internet.repository.js";
import { BookRepository } from "../reading-book/book.repository.js";
import { MediaRepository } from "../show/media/media.repository.js";
import { SportRepository } from "../sport/sport.repository.js";
import { ObjectStorage } from "../storage/object-storage.js";

const IdParams = z.object({ id: z.uuid() });
// the ?v= of these URLs changes with each upload: the file can be cached
const CACHE_A_DAY = "public, max-age=86400";

/**
 * Serves the files stored in S3 (only their key is kept in the databases): the bucket isn't readable anonymously,
 * and a signed URL per image on every read would be wasteful. Each route reads the key from its domain's repository,
 * so the domain's visibility rules apply (a visitor gets no private program's picture).
 */
@Controller("images")
export class ImagesController {
	constructor(
		private readonly storage: ObjectStorage,
		private readonly internet: InternetRepository,
		private readonly books: BookRepository,
		private readonly entities: EntitiesRepository,
		private readonly sport: SportRepository,
		private readonly games: GameRepository,
		private readonly media: MediaRepository,
	) {}

	// <programId>.profile or <programId>.banner; private programs are filtered out by findById for visitors
	@Get("internet/:key")
	@Public()
	async internetPicture(@Param("key") key: string, @Res({ passthrough: true }) response: ServerResponse) {
		const separator = key.lastIndexOf(".");
		const field = key.slice(separator + 1);
		if (field !== "profile" && field !== "banner") {
			throw new NotFoundError("image");
		}
		const program = await this.internet.findById(key.slice(0, separator));
		return this.serve(program?.[field], response, CACHE_A_DAY, "application/octet-stream");
	}

	@Get("reading-book/edition/:id")
	@Public()
	async cover(
		@Param({ schema: IdParams }) { id }: { id: string },
		@Res({ passthrough: true }) response: ServerResponse,
	) {
		return this.serve(await this.books.findCoverKey(id), response, CACHE_A_DAY);
	}

	@Get("entity/:id")
	@Public()
	async portrait(
		@Param({ schema: IdParams }) { id }: { id: string },
		@Res({ passthrough: true }) response: ServerResponse,
	) {
		return this.serve((await this.entities.findById(id))?.pictureKey, response, CACHE_A_DAY);
	}

	// owner only, like the sport module
	@Get("sport/:id/thumbnail")
	async thumbnail(@Param("id") id: string, @Res({ passthrough: true }) response: ServerResponse) {
		return this.serve((await this.sport.findThumbnailKey(id))?.thumbnailKey, response, CACHE_A_DAY);
	}

	// a picture replaced in the form keeps its URL: the browser revalidates, 304 while unchanged
	@Get("game/:id/:field")
	@Public()
	async gamePicture(
		@Param({ schema: GameImageParamsSchema }) { id, field }: { id: string; field: GameImageField },
		@Headers("if-none-match") ifNoneMatch: string | undefined,
		@Res({ passthrough: true }) response: ServerResponse,
	) {
		const key = (await this.games.findById(id))?.[field];
		const object = await this.fetch(key);
		response.setHeader("Cache-Control", "private, no-cache");
		if (object.ETag) {
			response.setHeader("ETag", object.ETag);
			if (ifNoneMatch === object.ETag) {
				object.Body?.destroy();
				response.statusCode = 304;
				return;
			}
		}
		return new StreamableFile(object.Body!, { type: object.ContentType ?? "image/avif" });
	}

	// show media: posters, portraits, programmes (PDF)
	@Get("show/:id")
	@Public()
	async showMedia(@Param("id") id: string, @Res({ passthrough: true }) response: ServerResponse) {
		// an id that isn't a uuid is not found, like any unknown media (not a 400)
		const key = z.uuid().safeParse(id).success ? await this.media.findKey(id) : undefined;
		return this.serve(key, response, CACHE_A_DAY, "application/octet-stream");
	}

	private async serve(
		key: string | null | undefined,
		response: ServerResponse,
		cacheControl: string,
		type = "image/avif",
	) {
		const object = await this.fetch(key);
		response.setHeader("Cache-Control", cacheControl);
		return new StreamableFile(object.Body!, { type: object.ContentType ?? type });
	}

	// The object's body is a Node Readable; a missing key or object is a 404
	private async fetch(key: string | null | undefined) {
		if (!key) {
			throw new NotFoundError("image");
		}
		try {
			const object = await this.storage.get(key);
			return { ...object, Body: object.Body as Readable | undefined };
		} catch {
			throw new NotFoundError("image");
		}
	}
}
