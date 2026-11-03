import type { ArtistMedia, SpectacleMedia, SpectacleMediaKind } from "@personal-tracker/shared/show";

import type { ImageKind } from "../../internet/image-storage.repository";

/** A media is attached to exactly one kind of owner through its link table. */
export type MediaOwner = { spectacleId: number } | { artistId: number };

export function isArtistOwner(owner: MediaOwner): owner is { artistId: number } {
	return "artistId" in owner;
}

/** Target size when the uploaded file is an image. */
export function imageKindFor(owner: MediaOwner, kind: SpectacleMediaKind): ImageKind {
	if (isArtistOwner(owner)) return "portrait";
	return kind === "poster" ? "poster" : "photo";
}

/** S3 key without extension (the storage appends `.avif` / `.pdf`). */
export function mediaKey(id: string) {
	return `personal-tracker/show/media/${id}`;
}

/** Proxy URL served by routes/images (the S3 key is never exposed). */
export function mediaUrl(id: string) {
	return `/images/show/${id}`;
}

export function optionalMediaUrl(id: string | null | undefined) {
	return id ? mediaUrl(id) : null;
}

type MediaRow = { id: string; label: string; contentType: string; order: number; createdAt: string | Date };

/** Gallery order: position, then upload time. */
export function sortByMediaOrder<T extends { media: MediaRow | null }>(links: Array<T>): Array<T> {
	return links.toSorted(
		(a, b) =>
			a.media!.order - b.media!.order ||
			new Date(a.media!.createdAt).getTime() - new Date(b.media!.createdAt).getTime(),
	);
}

export function toSpectacleMedia(link: { kind: SpectacleMediaKind; media: MediaRow | null }): SpectacleMedia {
	const { id, label, contentType } = link.media!;
	return { id, label, contentType, url: mediaUrl(id), kind: link.kind };
}

export function toArtistMedia(link: { spectacleId: number | null; media: MediaRow | null }): ArtistMedia {
	const { id, label, contentType } = link.media!;
	return { id, label, contentType, url: mediaUrl(id), spectacleId: link.spectacleId };
}
