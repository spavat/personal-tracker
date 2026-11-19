import type { ArtistView } from "@personal-tracker/shared/show";

import type { showArtist } from "../../database/schema.js";

import { optionalMediaUrl } from "../media/media.entity.js";

export function toArtistView(artist: typeof showArtist.$inferSelect): ArtistView {
	return {
		id: artist.id,
		name: artist.name ?? "",
		pictureId: artist.pictureId,
		pictureUrl: optionalMediaUrl(artist.pictureId),
	};
}
