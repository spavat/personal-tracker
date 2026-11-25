import type { SpectacleMediaKind } from "@personal-tracker/shared/show";

import { Inject, Injectable } from "@nestjs/common";
import { and, count, eq, max } from "drizzle-orm";

import { DRIZZLE } from "../../database/database.tokens.js";
import { Drizzle } from "../../database/drizzle.js";
import { showMedia, showSpectacleMedia } from "../../database/schema.js";
import { type MediaOwner } from "./media.entity.js";

@Injectable()
export class MediaRepository {
	constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

	runInTransaction<T>(fn: (tx: any) => Promise<T>) {
		return this.db.transaction(fn);
	}

	async findKey(id: string) {
		const media = await this.db.query.showMedia.findFirst({ where: { id }, columns: { key: true } });
		return media?.key;
	}

	findSpectacleMedia(spectacleId: string, kind?: SpectacleMediaKind) {
		return this.db.query.showSpectacleMedia.findMany({
			where: kind ? { spectacleId, kind } : { spectacleId },
			with: { media: true },
		});
	}

	async linkExists(owner: MediaOwner, mediaId: string) {
		const [link] = await this.db
			.select({ mediaId: showSpectacleMedia.mediaId })
			.from(showSpectacleMedia)
			.where(and(eq(showSpectacleMedia.spectacleId, owner.spectacleId), eq(showSpectacleMedia.mediaId, mediaId)));
		return link !== undefined;
	}

	async findMediaIds(owner: MediaOwner): Promise<string[]> {
		const rows = await this.db
			.select({ mediaId: showSpectacleMedia.mediaId })
			.from(showSpectacleMedia)
			.where(eq(showSpectacleMedia.spectacleId, owner.spectacleId));
		return rows.map((row) => row.mediaId);
	}

	/** Position after the owner's last media. */
	async nextOrder(tx: any, owner: MediaOwner): Promise<number> {
		const [row] = await tx
			.select({ last: max(showMedia.order) })
			.from(showSpectacleMedia)
			.innerJoin(showMedia, eq(showMedia.id, showSpectacleMedia.mediaId))
			.where(eq(showSpectacleMedia.spectacleId, owner.spectacleId));
		return row?.last === null || row?.last === undefined ? 0 : row.last + 1;
	}

	insertMedia(tx: any, label: string, order: number): Promise<{ id: string }[]> {
		// key and content type depend on the generated id and the file: set right after the upload
		return tx.insert(showMedia).values({ key: "", label, contentType: "", order }).returning({ id: showMedia.id });
	}

	setOrder(tx: any, id: string, order: number) {
		return tx.update(showMedia).set({ order }).where(eq(showMedia.id, id));
	}

	setFile(tx: any, id: string, file: { key: string; contentType: string }) {
		return tx.update(showMedia).set(file).where(eq(showMedia.id, id));
	}

	updateLabel(tx: any, id: string, label: string) {
		return tx.update(showMedia).set({ label }).where(eq(showMedia.id, id));
	}

	insertLink(tx: any, owner: MediaOwner, mediaId: string, { kind }: { kind: SpectacleMediaKind }) {
		return tx.insert(showSpectacleMedia).values({ spectacleId: owner.spectacleId, mediaId, kind });
	}

	deleteLink(tx: any, owner: MediaOwner, mediaId: string): Promise<unknown[]> {
		return tx
			.delete(showSpectacleMedia)
			.where(and(eq(showSpectacleMedia.spectacleId, owner.spectacleId), eq(showSpectacleMedia.mediaId, mediaId)))
			.returning({ mediaId: showSpectacleMedia.mediaId });
	}

	async countLinks(tx: any, mediaId: string) {
		const [spectacles] = await tx
			.select({ n: count() })
			.from(showSpectacleMedia)
			.where(eq(showSpectacleMedia.mediaId, mediaId));
		return spectacles?.n ?? 0;
	}

	deleteMedia(tx: any, id: string): Promise<{ key: string }[]> {
		return tx.delete(showMedia).where(eq(showMedia.id, id)).returning({ key: showMedia.key });
	}
}
