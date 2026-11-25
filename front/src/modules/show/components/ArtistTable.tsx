import type { ReactNode } from "react";

import { ArtistListResponse } from "@personal-tracker/shared/show";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";

import VirtualTable from "../../../components/VirtualTable";

// Only the rows on screen are rendered
export default function ArtistTable({
	artists,
	headers,
	isOwner,
}: {
	artists: ArtistListResponse[];
	headers: ReactNode[];
	isOwner: boolean;
}) {
	const navigate = useNavigate();
	const location = useLocation();

	return (
		<VirtualTable
			items={artists}
			headers={headers}
			className="list artists alternate responsive"
			getKey={(artist) => artist.id}
			renderCells={(artist, index) => (
				<>
					<td className="cell-index">{index + 1}</td>
					<td className="cell-text">
						<b>
							<Link to="/shows/artists/$artistId" params={{ artistId: String(artist.id) }}>
								{artist.name}
							</Link>
						</b>
					</td>
					<td className="cell-number" data-label="Spectacles">
						{artist.nbSpectacles}
					</td>
					<td className="cell-number" data-label="Représentations">
						{artist.nbPerformances}
					</td>
					{isOwner && (
						<td data-label="Actions">
							<button
								type="button"
								title="Modifier"
								onClick={() =>
									navigate({
										to: "/shows/artists/edit/$artistId",
										params: { artistId: artist.id },
										search: { returnTo: location.pathname },
										replace: true,
										resetScroll: false,
										mask: {
											to: "/shows/artists",
										},
									})
								}
							>
								<i className="fa-regular fa-pen-to-square"></i>
							</button>
						</td>
					)}
				</>
			)}
		/>
	);
}
