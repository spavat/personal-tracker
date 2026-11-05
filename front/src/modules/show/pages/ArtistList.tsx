import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import DisplaySelector from "../../../components/DisplaySelector";
import PageTitle from "../../../components/PageTitle";
import { PendingContent } from "../../../components/PendingContent";
import { useDisplay } from "../../../hooks/use-display";
import { useIsOwner } from "../../../hooks/use-is-owner";
import { useSortTable } from "../../../hooks/use-sort-table";
import { artistListSort } from "../api";
import ArtistGrid from "../components/ArtistGrid";
import ArtistTable from "../components/ArtistTable";
import { MODULE_NAME } from "../constants";

export default function ArtistList() {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();
	const { query, headers, isPending } = useSortTable({
		...artistListSort,
		columnsList: [
			null,
			{ name: "Nom", colName: "name", isSortable: true },
			{ name: "Spectacle(s)", colName: "nbSpectacles", isSortable: true },
			{ name: "Représentation(s)", colName: "nbPerformances", isSortable: true },
			...(isOwner ? [{ name: "Actions", colName: "actions", isSortable: false }] : []),
		],
	});

	const [display, changeDisplay] = useDisplay("show_artist_list_display");

	return (
		<>
			<PageTitle title={`${MODULE_NAME} > Artistes`} />
			<h2>
				Artistes
				<DisplaySelector value={display} onChange={changeDisplay} />
			</h2>
			<PendingContent isPending={isPending}>
				{display === "list" ? (
					<ArtistTable artists={query.data} headers={headers} isOwner={isOwner} />
				) : (
					<ArtistGrid artists={query.data} />
				)}
			</PendingContent>

			<Outlet />
			{isOwner && (
				<div className="fab-container">
					<button
						type="button"
						className="fab-main"
						aria-label="Ajouter un artiste"
						onClick={() =>
							navigate({
								to: "/shows/artists/add",
								search: { returnTo: location.pathname },
								replace: true,
								resetScroll: false,
								mask: { to: "/shows/artists" },
							})
						}
					>
						<div className="pulse"></div>
						<div className="heart-line" aria-hidden="true">
							<i className="fa-solid fa-plus"></i>
						</div>
					</button>
				</div>
			)}
		</>
	);
}
