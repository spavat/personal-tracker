import type { ArtistView, SaveArtistBodyRequest } from "@personal-tracker/shared/show";

import type { showArtist } from "../../database/schema.js";

import { optionalMediaUrl } from "../media/media.entity.js";

// the body, with the id of the path on an update (none: created)
export type SaveArtistBody = SaveArtistBodyRequest & { id?: number };

export function toArtistView(artist: typeof showArtist.$inferSelect): ArtistView {
	return {
		id: artist.id,
		name: artist.name ?? "",
		pictureId: artist.pictureId,
		pictureUrl: optionalMediaUrl(artist.pictureId),
	};
}
