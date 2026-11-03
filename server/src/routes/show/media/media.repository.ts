import type { SpectacleMediaKind } from "@personal-tracker/shared/show";
import type { FastifyInstance } from "fastify";

import { and, count, eq, max } from "drizzle-orm";

import { showArtistMedia, showMedia, showSpectacleMedia } from "../../../db/schema";
import { isArtistOwner, type MediaOwner } from "./media.entity";

export class MediaRepository {
	constructor(private db: FastifyInstance["db"]) {}

	runInTransaction<T>(fn: (tx: any) => Promise<T>) {
		return this.db.transaction(fn);
	}

	async findKey(id: string) {
		const media = await this.db.query.showMedia.findFirst({ where: { id }, columns: { key: true } });
		return media?.key;
	}

	findSpectacleMedia(spectacleId: number, kind?: SpectacleMediaKind) {
		return this.db.query.showSpectacleMedia.findMany({
			where: kind ? { spectacleId, kind } : { spectacleId },
			with: { media: true },
		});
	}

	findArtistMedia(artistId: number) {
		return this.db.query.showArtistMedia.findMany({
			where: { artistId },
			with: { media: true },
		});
	}

	async linkExists(owner: MediaOwner, mediaId: string) {
		const [link] = isArtistOwner(owner)
			? await this.db
					.select({ mediaId: showArtistMedia.mediaId })
					.from(showArtistMedia)
					.where(and(eq(showArtistMedia.artistId, owner.artistId), eq(showArtistMedia.mediaId, mediaId)))
			: await this.db
					.select({ mediaId: showSpectacleMedia.mediaId })
					.from(showSpectacleMedia)
					.where(
						and(
							eq(showSpectacleMedia.spectacleId, owner.spectacleId),
							eq(showSpectacleMedia.mediaId, mediaId),
						),
					);
		return link !== undefined;
	}

	async findMediaIds(owner: MediaOwner): Promise<string[]> {
		const rows = isArtistOwner(owner)
			? await this.db
					.select({ mediaId: showArtistMedia.mediaId })
					.from(showArtistMedia)
					.where(eq(showArtistMedia.artistId, owner.artistId))
			: await this.db
					.select({ mediaId: showSpectacleMedia.mediaId })
					.from(showSpectacleMedia)
					.where(eq(showSpectacleMedia.spectacleId, owner.spectacleId));
		return rows.map((row) => row.mediaId);
	}

	/** Position after the owner's last media. */
	async nextOrder(tx: any, owner: MediaOwner): Promise<number> {
		const [row] = isArtistOwner(owner)
			? await tx
					.select({ last: max(showMedia.order) })
					.from(showArtistMedia)
					.innerJoin(showMedia, eq(showMedia.id, showArtistMedia.mediaId))
					.where(eq(showArtistMedia.artistId, owner.artistId))
			: await tx
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

	insertLink(
		tx: any,
		owner: MediaOwner,
		mediaId: string,
		{ kind, spectacleId }: { kind: SpectacleMediaKind; spectacleId?: number | null },
	) {
		return isArtistOwner(owner)
			? tx.insert(showArtistMedia).values({ artistId: owner.artistId, mediaId, spectacleId: spectacleId ?? null })
			: tx.insert(showSpectacleMedia).values({ spectacleId: owner.spectacleId, mediaId, kind });
	}

	updateArtistLink(tx: any, artistId: number, mediaId: string, spectacleId: number | null) {
		return tx
			.update(showArtistMedia)
			.set({ spectacleId })
			.where(and(eq(showArtistMedia.artistId, artistId), eq(showArtistMedia.mediaId, mediaId)));
	}

	deleteLink(tx: any, owner: MediaOwner, mediaId: string): Promise<unknown[]> {
		return isArtistOwner(owner)
			? tx
					.delete(showArtistMedia)
					.where(and(eq(showArtistMedia.artistId, owner.artistId), eq(showArtistMedia.mediaId, mediaId)))
					.returning({ mediaId: showArtistMedia.mediaId })
			: tx
					.delete(showSpectacleMedia)
					.where(
						and(
							eq(showSpectacleMedia.spectacleId, owner.spectacleId),
							eq(showSpectacleMedia.mediaId, mediaId),
						),
					)
					.returning({ mediaId: showSpectacleMedia.mediaId });
	}

	async countLinks(tx: any, mediaId: string) {
		const [spectacles] = await tx
			.select({ n: count() })
			.from(showSpectacleMedia)
			.where(eq(showSpectacleMedia.mediaId, mediaId));
		const [artists] = await tx
			.select({ n: count() })
			.from(showArtistMedia)
			.where(eq(showArtistMedia.mediaId, mediaId));
		return (spectacles?.n ?? 0) + (artists?.n ?? 0);
	}

	deleteMedia(tx: any, id: string): Promise<{ key: string }[]> {
		return tx.delete(showMedia).where(eq(showMedia.id, id)).returning({ key: showMedia.key });
	}
}
