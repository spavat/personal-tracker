import { Outlet } from "@tanstack/react-router";

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
	const isOwner = useIsOwner();
	const { query, headers, isPending } = useSortTable({
		...artistListSort,
		columnsList: [
			{ name: "", isSortable: false, className: "cell-index" },
			{ name: "Nom", colName: "name", isSortable: true, className: "cell-text" },
			{
				name: "Spectacle(s)",
				colName: "nbSpectacles",
				isSortable: true,
				className: "cell-number col-spectacles",
			},
			{
				name: "Représentation(s)",
				colName: "nbPerformances",
				isSortable: true,
				className: "cell-number col-performances",
			},
			...(isOwner ? [{ name: "Actions", colName: "actions", isSortable: false, className: "col-actions" }] : []),
		],
	});

	const [display, changeDisplay] = useDisplay("show_artist_list_display", "card");

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
		</>
	);
}
