import type { Episode, EpisodeStatus, ProgramDetails } from "@personal-tracker/shared/broadcast";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Fragment } from "react";

import MutationError from "../../../../components/MutationError";
import { useIsOwner } from "../../../../hooks/use-is-owner";
import { formatDate, getDurationString } from "../../../../utils";
import { addView, setEpisodeStatus } from "../../api";
import EpisodeTitle from "../../components/EpisodeTitle";

// Oldest release first; an episode without release date last, then by its number in the season
function byRelease(a: Episode, b: Episode) {
	if (a.releaseDate !== b.releaseDate) {
		if (!a.releaseDate) return 1;
		if (!b.releaseDate) return -1;
		return a.releaseDate.localeCompare(b.releaseDate);
	}
	return (a.position ?? Infinity) - (b.position ?? Infinity) || a.name.localeCompare(b.name);
}

export default function CatalogEpisodes({
	program,
	formatFilter,
	hideSkipped,
	openView,
	openEpisode,
}: {
	program: ProgramDetails;
	formatFilter: string;
	hideSkipped: boolean;
	openView: (action: "edit" | "delete", viewId: string) => void;
	openEpisode: (episodeId: string) => void;
}) {
	const isOwner = useIsOwner();
	const queryClient = useQueryClient();
	const onSuccess = () => {
		queryClient.invalidateQueries({ queryKey: ["programs"] });
		queryClient.invalidateQueries({ queryKey: ["program", program.id] });
	};
	const viewMutation = useMutation({
		mutationFn: (episodeId: string) => addView(program.id, episodeId),
		onSuccess,
	});
	const statusMutation = useMutation({
		mutationFn: ({ episodeId, status }: { episodeId: string; status: EpisodeStatus | null }) =>
			setEpisodeStatus(program.id, episodeId, status),
		onSuccess,
	});
	// a status button: sets it, or clears it when already set
	const toggleStatus = (episode: Episode, status: EpisodeStatus) =>
		statusMutation.mutate({ episodeId: episode.id, status: episode.status === status ? null : status });

	const episodes = program.episodes
		.filter((episode) => !formatFilter || episode.formatId === formatFilter)
		.filter((episode) => !hideSkipped || episode.status !== "skipped")
		.toSorted(byRelease);
	const groups = program.seasons.length
		? [
				...program.seasons
					.toSorted((a, b) => a.position - b.position)
					.map((season) => ({
						key: season.id,
						label: season.label,
						episodes: episodes.filter((episode) => episode.seasonId === season.id),
					})),
				{ key: "none", label: "Sans saison", episodes: episodes.filter((episode) => !episode.seasonId) },
			].filter((group) => group.episodes.length)
		: [{ key: "all", label: null, episodes }];
	const columns = isOwner ? 6 : 5;

	return (
		<>
			<MutationError error={viewMutation.error ?? statusMutation.error} />
			<table className="list episodes catalog alternate responsive">
				<thead>
					<tr data-title="Épisodes">
						<th className="cell-index"></th>
						<th className="cell-text">Nom</th>
						<th className="cell-date">Sortie</th>
						<th className="cell-duration">Durée</th>
						<th className="cell-views">Vues</th>
						{isOwner && <th>Actions</th>}
					</tr>
				</thead>
				<tbody>
					{groups.map((group) => (
						<Fragment key={group.key}>
							{group.label && (
								<tr className="season-row">
									<td colSpan={columns}>
										<strong>{group.label}</strong> (
										{group.episodes.filter(({ views }) => views.length).length}/
										{group.episodes.filter(({ status }) => status !== "skipped").length})
									</td>
								</tr>
							)}
							{group.episodes.map((episode) => {
								// the latest view: the one edited / deleted from the line
								const latest = episode.views.at(0);
								return (
									<tr
										key={episode.id}
										className={
											latest ? "watched" : episode.status === "skipped" ? "skipped" : undefined
										}
									>
										<td className="cell-index number-label">{episode.numberLabel}</td>
										<td className="cell-text">
											<EpisodeTitle
												episode={episode}
												watched={Boolean(latest)}
												onOpen={() => openEpisode(episode.id)}
											/>
										</td>
										<td className="cell-date" data-label="Sortie">
											{episode.releaseDate && formatDate(episode.releaseDate)}
										</td>
										<td className="cell-duration" data-label="Durée">
											{episode.duration > 0 && getDurationString(episode.duration)}
										</td>
										<td
											className="cell-views"
											data-label="Vues"
											title={latest ? `Vu le ${formatDate(latest.date)}` : undefined}
										>
											{episode.views.length > 0 && (
												<>
													<i className="fa-solid fa-check"></i>
													{episode.views.length > 1 && ` ×${episode.views.length}`}
												</>
											)}
											{episode.status === "planned" && (
												<span className="episode-status">
													{" "}
													<i className="fa-solid fa-bookmark"></i> À voir
												</span>
											)}
											{episode.status === "skipped" && (
												<span className="episode-status">
													<i className="fa-solid fa-ban"></i> Ignoré
												</span>
											)}
										</td>
										{isOwner && (
											<td data-label="Actions">
												<button
													type="button"
													title="Vu aujourd'hui"
													disabled={viewMutation.isPending}
													onClick={() => viewMutation.mutate(episode.id)}
												>
													<i className="fa-regular fa-eye"></i> Vu
												</button>
												&nbsp;
												<button
													type="button"
													title={episode.views.length ? "À revoir" : "À voir"}
													aria-pressed={episode.status === "planned"}
													disabled={statusMutation.isPending}
													onClick={() => toggleStatus(episode, "planned")}
												>
													<i className="fa-regular fa-bookmark"></i> À voir
												</button>
												{episode.views.length === 0 && (
													<>
														&nbsp;
														<button
															type="button"
															aria-pressed={episode.status === "skipped"}
															disabled={statusMutation.isPending}
															onClick={() => toggleStatus(episode, "skipped")}
														>
															<i className="fa-solid fa-ban"></i> Ignorer
														</button>
													</>
												)}
												{latest && (
													<>
														&nbsp;
														<button
															type="button"
															title="Modifier la dernière vue"
															onClick={() => openView("edit", latest.id)}
														>
															<i className="fa-regular fa-pen-to-square"></i>
														</button>
														&nbsp;
														<button
															type="button"
															title="Supprimer la dernière vue"
															onClick={() => openView("delete", latest.id)}
														>
															<i className="fa-regular fa-trash-can"></i>
														</button>
													</>
												)}
											</td>
										)}
									</tr>
								);
							})}
						</Fragment>
					))}
				</tbody>
			</table>
		</>
	);
}
