import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useOptimistic, useTransition } from "react";
import { Fragment } from "react/jsx-runtime";

import MutationError from "../../../components/MutationError";
import PageTitle from "../../../components/PageTitle";
import { PendingContent } from "../../../components/PendingContent";
import { useStoredValue } from "../../../hooks/stored-value";
import { useIsOwner } from "../../../hooks/use-is-owner";
import { formatDate, getPeriodDifference } from "../../../utils";
import { artistDetailsQuery, saveArtist } from "../api";
import MediaGallery from "../components/MediaGallery";
import { MODULE_NAME } from "../constants";
import { formatShowDate, mediaSrc } from "../utils";

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

	const queryClient = useQueryClient();
	const mainPictureMutation = useMutation({
		mutationFn: (pictureId: string | null) => saveArtist({ id: details.id, name: details.name, pictureId }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shows", "artists", artistId] }),
	});

	let index = 1;
	return (
		<>
			<PageTitle title={`${MODULE_NAME} > Artiste > ${details.name}`} />
			<div className="presentation-with-picture">
				<div className="picture">
					{details.pictureUrl ? (
						<img src={mediaSrc(details.pictureUrl)} alt={details.name} className="artist-picture" />
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
			{isOwner && (
				<>
					<MediaGallery
						owner={{ artistId: details.id }}
						media={details.media}
						invalidateKey={["shows", "artists", artistId]}
						mainPictureId={details.pictureId}
						onSetMain={(pictureId) => mainPictureMutation.mutate(pictureId)}
					/>
					<MutationError error={mainPictureMutation.error} />
				</>
			)}

			<h2>
				Liste des représentations
				<label>
					<input type="checkbox" checked={optimisticGroupBySpectacle} onChange={changeGroupBySpectacle} />{" "}
					Grouper par spectacle
				</label>
			</h2>

			<PendingContent isPending={isPending}>
				<table className="list performancesWithRole alternate responsive">
					<thead>
						<tr>
							<th></th>
							<th>Date</th>
							<th>Spectacle</th>
							<th>Role</th>
							<th>Lieu</th>
							<th>Pays</th>
							<th>Place</th>
						</tr>
					</thead>
					<tbody>
						{details.groups.map((spectacle) => (
							<Fragment key={spectacle.id ?? "spectacle"}>
								{groupBySpectacle && (
									<tr>
										<td colSpan={7}>
											<span className="title">{spectacle.name}</span>{" "}
											<span className="subtitle">
												{spectacle.performances.length > 1 && (
													<>({spectacle.performances.length})</>
												)}
											</span>
										</td>
									</tr>
								)}

								{spectacle.performances.map((perf) => {
									const [date, time] = formatShowDate(perf.date).split(" ");
									return (
										<tr key={perf.id} className={perf.canceled ? "canceled" : ""}>
											<td className="smalltext">{!perf.canceled && <>#{index++}</>}</td>
											<td data-label="Date">
												{date} <span className="smalltext">{time}</span>
											</td>
											<td>
												<Link
													to="/shows/spectacles/$spectacleId"
													params={{ spectacleId: String(perf.spectacle.id) }}
												>
													{perf.spectacle.name}
												</Link>
											</td>
											<td data-label="Rôle">{perf.role}</td>
											<td data-label="Lieu">{perf.place?.name}</td>
											<td data-label="Pays">
												<span className={`fi fi-${perf.place?.country}`}></span>
											</td>
											<td data-label="Place">{perf.seat ? <> 🎫 {perf.seat}</> : ""}</td>
										</tr>
									);
								})}
							</Fragment>
						))}
					</tbody>
				</table>
			</PendingContent>
			<Outlet />
		</>
	);
}
