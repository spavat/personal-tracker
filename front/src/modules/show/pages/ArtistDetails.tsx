import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useOptimistic, useTransition } from "react";

import PageTitle from "../../../components/PageTitle";
import { PendingContent } from "../../../components/PendingContent";
import { useStoredValue } from "../../../hooks/stored-value";
import { useIsOwner } from "../../../hooks/use-is-owner";
import { formatDate, getPeriodDifference } from "../../../utils";
import { artistDetailsQuery } from "../api";
import ArtistPerformanceTable from "../components/ArtistPerformanceTable";
import { MODULE_NAME } from "../constants";
import { mediaSrc } from "../utils";

export default function ArtistDetails({ artistId }: { artistId: string }) {
	const navigate = useNavigate();
	const isOwner = useIsOwner();

	const [groupBySpectacle, setGroupBySpectacle] = useStoredValue("show_artist_details_groupBySpectacle", false);
	const [isPending, startTransition] = useTransition();
	const [optimisticGroupBySpectacle, setOptimisticGroupBySpectacle] = useOptimistic(groupBySpectacle);
	function changeGroupBySpectacle(e: React.ChangeEvent<HTMLInputElement>) {
		// transition: keep the current details displayed while the new grouping loads
		const checked = e.target.checked;
		startTransition(() => {
			setOptimisticGroupBySpectacle(checked);
			setGroupBySpectacle(checked);
		});
	}

	const { data: details } = useSuspenseQuery(artistDetailsQuery(artistId, groupBySpectacle));

	return (
		<>
			<PageTitle title={`${MODULE_NAME} > Artiste > ${details.name}`} />
			<div className="presentation-with-picture">
				<div className="picture">
					{details.picture ? (
						<img
							src={mediaSrc(details.picture)}
							alt={details.name}
							className="artist-picture"
							style={{ viewTransitionName: `artist-portrait-${details.id}` }}
						/>
					) : (
						<div className="portrait-card">
							<i className="fa-solid fa-user"></i>
						</div>
					)}
				</div>
				<div className="general">
					<div className="title">
						<h2>
							{details.name}
							{isOwner && (
								<button
									type="button"
									title="Modifier"
									onClick={() =>
										navigate({
											to: "/shows/artists/$artistId/edit",
											params: { artistId },
											search: { returnTo: location.pathname },
											replace: true,
											resetScroll: false,
											mask: {
												to: "/shows/artists/$artistId",
												params: { artistId },
											},
										})
									}
								>
									<i className="fa-regular fa-pen-to-square"></i>
								</button>
							)}
						</h2>
					</div>
					<span>
						<i className="fa-solid fa-masks-theater"></i> <strong>{details.stats.nbSpectacles}</strong>{" "}
						spectacle{details.stats.nbSpectacles > 1 ? "s" : ""}
					</span>
					<br />
					<span>
						<i className="fa-solid fa-square-poll-vertical"></i>
						<strong>{details.stats.nbPerformances}</strong> représentation
						{details.stats.nbPerformances > 1 ? "s" : ""}
					</span>
					<br />
					<span>
						<i className="fa-solid fa-calendar"></i> Dernière fois :{" "}
						<strong>
							{details.stats.lastPerformance ? (
								<>
									{getPeriodDifference(details.stats.lastPerformance)} (
									<strong>{formatDate(details.stats.lastPerformance)}</strong>)
								</>
							) : (
								"Aucune"
							)}
						</strong>
					</span>
				</div>
			</div>
			<h2>
				Liste des représentations
				<label>
					<input type="checkbox" checked={optimisticGroupBySpectacle} onChange={changeGroupBySpectacle} />{" "}
					Grouper par spectacle
				</label>
			</h2>

			<PendingContent isPending={isPending}>
				<ArtistPerformanceTable groups={details.groups} groupBySpectacle={groupBySpectacle} />
			</PendingContent>
			<Outlet />
		</>
	);
}
