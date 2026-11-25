import { ArtistListResponse } from "@personal-tracker/shared/show";

import VirtualGrid from "../../../components/VirtualGrid";
import CardArtist from "./CardArtist";

// Only the rows on screen are rendered; the column count comes from the .grid.artists CSS.
export default function ArtistGrid({ artists }: { artists: ArtistListResponse[] }) {
	return (
		<VirtualGrid
			items={artists}
			className="grid artists"
			rowHeight={150}
			renderItem={(artist) => (
				<CardArtist key={artist.id} artist={artist} picture={artist.picture}>
					{artist.nbSpectacles} spectacle(s) · {artist.nbPerformances} représentation(s)
				</CardArtist>
			)}
		/>
	);
}
