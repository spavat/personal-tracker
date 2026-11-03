import type { ReactNode } from "react";

import { ArtistRef } from "@personal-tracker/shared/show";
import { Link } from "@tanstack/react-router";

import { mediaSrc } from "../utils";

// children: what the artist is shown for (a role, counts…)
export default function Card({
	artist,
	pictureUrl,
	children,
}: {
	artist: ArtistRef;
	pictureUrl: string | null;
	children?: ReactNode;
}) {
	return (
		<div className="card_item artist">
			{pictureUrl ? (
				<img src={mediaSrc(pictureUrl)} alt="" className="portrait-card" loading="lazy" />
			) : (
				<div className="portrait-card">
					<i className="fa-solid fa-user"></i>
				</div>
			)}
			<div>
				<span className="title">
					<Link to="/shows/artists/$artistId" params={{ artistId: String(artist.id) }}>
						{artist.name}
					</Link>
				</span>
				<br />
				{children}
			</div>
		</div>
	);
}
