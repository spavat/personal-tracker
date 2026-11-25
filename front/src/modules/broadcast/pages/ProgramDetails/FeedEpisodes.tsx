import type { ProgramDetails } from "@personal-tracker/shared/broadcast";

import { Fragment } from "react";

import ContextTagBadge from "../../../../components/ContextTagBadge";
import DayDate from "../../../../components/DayDate";
import TagBadge from "../../../../components/TagBadge";
import { useIsOwner } from "../../../../hooks/use-is-owner";
import { getDurationString } from "../../../../utils";
import EpisodeTitle from "../../components/EpisodeTitle";
import IgnoredTagBadge from "../../components/IgnoredTagBadge";
import { toLines } from "../../episode-lines";

export default function FeedEpisodes({
	program,
	formatFilter,
	groupBySeason,
	openView,
	openEpisode,
}: {
	program: ProgramDetails;
	formatFilter: string;
	groupBySeason: boolean;
	openView: (action: "edit" | "delete", viewId: string) => void;
	openEpisode: (episodeId: string) => void;
}) {
	const isOwner = useIsOwner();
	const lines = toLines(program.episodes).filter((line) => !formatFilter || line.formatId === formatFilter);
	// grouped by season when the program has some: the latest season first, the lines without season last
	const groups =
		program.seasons.length && groupBySeason
			? [
					...program.seasons
						.toSorted((a, b) => b.position - a.position)
						.map((season) => ({
							key: season.id,
							label: season.label,
							lines: lines.filter((line) => line.seasonId === season.id),
						})),
					{ key: "none", label: "Sans saison", lines: lines.filter((line) => !line.seasonId) },
				].filter((group) => group.lines.length)
			: [{ key: "all", label: null, lines }];
	let lineIndex = 0;

	return (
		<table className="list episodes alternate responsive">
			<thead>
				<tr data-title="Épisodes">
					<th className="cell-index"></th>
					<th className="cell-icon"></th>
					<th className="cell-date">Date</th>
					<th className="cell-text">Nom</th>
					<th className="cell-text">Tags</th>
					<th className="cell-duration">Durée</th>
					{isOwner && <th>Actions</th>}
				</tr>
			</thead>
			<tbody>
				{groups.map((group) => (
					<Fragment key={group.key}>
						{group.label && (
							<tr className="season-row">
								<td colSpan={isOwner ? 7 : 6}>
									<strong>{group.label}</strong> ({group.lines.length})
								</td>
							</tr>
						)}
						{group.lines.map((episode) => {
							const i = lineIndex++;
							const notFull = Boolean(episode.durationReal);
							return (
								<tr key={episode.id}>
									<td className="cell-index">{i + 1}</td>
									<td className="cell-icon" data-label="Type">
										{episode.type === "video" && <i className="fa-solid fa-video"></i>}
										{episode.type === "podcast" && <i className="fa-solid fa-podcast"></i>}
										{episode.type === "live" && <i className="fa-solid fa-play"></i>}
										{episode.type === "radio" && <i className="fa-solid fa-radio"></i>}
									</td>
									<td className="cell-date" data-label="Date">
										<DayDate date={episode.date} />
									</td>
									<td className="cell-text">
										<EpisodeTitle
											episode={episode}
											prefix={
												episode.numberLabel && (
													<span className="number-label">{episode.numberLabel} · </span>
												)
											}
											onOpen={() => openEpisode(episode.episodeId)}
										>
											{episode.comment && (
												<>
													<span
														className="tooltip-anchor"
														style={{ anchorName: `--comment-${episode.id}` }}
													>
														<i className="fa-solid fa-circle-info"></i>
													</span>
													<span
														className="tooltip-content"
														style={{ positionAnchor: `--comment-${episode.id}` }}
													>
														{episode.comment}
													</span>
												</>
											)}
										</EpisodeTitle>
									</td>
									<td className="cell-text" data-label="Tags">
										{(episode.tags ?? []).map((c: string) => (
											<TagBadge key={c} name={c} />
										))}
										{(episode.ignoredTags ?? []).map((c: string) => (
											<IgnoredTagBadge key={c} name={c} />
										))}
										{(episode.contextTags ?? []).map((c: string) => (
											<ContextTagBadge key={c} name={c} />
										))}
									</td>
									<td className="cell-duration" data-label="Durée">
										{getDurationString(episode.durationReal ?? episode.duration)}
										{notFull ? "*" : ""}
									</td>
									{isOwner && (
										<td data-label="Actions">
											<button
												type="button"
												title="Modifier"
												onClick={() => openView("edit", episode.id)}
											>
												<i className="fa-regular fa-pen-to-square"></i>
											</button>
											&nbsp;
											<button
												type="button"
												title="Supprimer"
												onClick={() => openView("delete", episode.id)}
											>
												<i className="fa-regular fa-trash-can"></i>
											</button>
										</td>
									)}
								</tr>
							);
						})}
					</Fragment>
				))}
			</tbody>
			<tfoot></tfoot>
		</table>
	);
}
