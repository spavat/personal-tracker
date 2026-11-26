import type { ReactNode } from "react";

import { ArtistRef } from "@personal-tracker/shared/show";
import { Link } from "@tanstack/react-router";

import { mediaSrc } from "../utils";

// children: what the artist is shown for (a role, counts…)
export default function Card({
	artist,
	picture,
	children,
}: {
	artist: ArtistRef;
	picture: string | null;
	children?: ReactNode;
}) {
	return (
		<div className="card_item artist">
			{picture ? (
				<img
					src={mediaSrc(picture)}
					alt=""
					className="portrait-card"
					loading="lazy"
					style={{ viewTransitionName: `entity-portrait-${artist.id}` }}
				/>
			) : (
				<div className="portrait-card">
					<i className="fa-solid fa-user"></i>
				</div>
			)}
			<div>
				<span className="title">
					<Link to="/entities/$entityId" params={{ entityId: artist.id }} viewTransition>
						{artist.name}
					</Link>
				</span>
				<br />
				{children}
			</div>
		</div>
	);
}
