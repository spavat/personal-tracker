import type { ArtistView } from "@personal-tracker/shared/show";

import { portraitUrl } from "../../entities/entity.entity.js";

// An artist is a person entity: its portrait is the entity's
export function toArtistView(artist: { id: string; name: string; pictureKey: string | null }): ArtistView {
	return {
		id: artist.id,
		name: artist.name,
		picture: portraitUrl(artist.id, artist.pictureKey),
	};
}
