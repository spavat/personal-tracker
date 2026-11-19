import type { ArtistView } from "@personal-tracker/shared/show";

import type { showArtist } from "../../../db/schema";

import { optionalMediaUrl } from "../media/media.entity";

export function toArtistView(artist: typeof showArtist.$inferSelect): ArtistView {
	return {
		id: artist.id,
		name: artist.name ?? "",
		pictureId: artist.pictureId,
		pictureUrl: optionalMediaUrl(artist.pictureId),
	};
}
