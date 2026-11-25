import type { EntityBroadcastResponse, EpisodeLine, ProgramCreditRole } from "@personal-tracker/shared/broadcast";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";

import ContextTagBadge from "../../../components/ContextTagBadge";
import DayDate from "../../../components/DayDate";
import TagBadge from "../../../components/TagBadge";
import { API_BASE_URL } from "../../../config";
import { useIsOwner } from "../../../hooks/use-is-owner";
import { formatDate, getDurationString } from "../../../utils";
import { entityBroadcastQuery } from "../../broadcast/api";
import EpisodeTitle from "../../broadcast/components/EpisodeTitle";
import IgnoredTagBadge from "../../broadcast/components/IgnoredTagBadge";
import { toLines } from "../../broadcast/episode-lines";

type Episode = EntityBroadcastResponse["episodes"][number];

const PROGRAM_ROLES: Array<{ role: ProgramCreditRole; label: string }> = [
	{ role: "host", label: "Émissions animées" },
	{ role: "producer", label: "Émissions produites" },
	{ role: "network", label: "Émissions diffusées" },
];

const EPISODE_ROLE_LABELS = { host: "Animation", guest: "Invité·e", interviewee: "Interviewé·e" };

// The entity's programs, one part per role, then its episodes: the ones it hosts, the ones it is a guest of or
// interviewed in
export default function BroadcastSection({ entityId }: { entityId: string }) {
	const { data } = useSuspenseQuery(entityBroadcastQuery(entityId));
	// a program in two roles shows twice: only its first card takes the profile transition
	const transitionCards = new Set<string>();

	return (
		<section className="broadcast">
			<h2>🎙️ Émissions</h2>
			{PROGRAM_ROLES.map(({ role, label }) => {
				const programs = data.programs.filter((program) => program.role === role);
				if (!programs.length) return null;
				return (
					<div key={role}>
						<h3>{label}</h3>
						<div className="grid">
							{programs.map((program) => {
								const withTransition = !transitionCards.has(program.id);
								transitionCards.add(program.id);
								return (
									<div key={program.id} className="card_item">
										{program.profile && (
											<img
												src={`${API_BASE_URL}${program.profile}`}
												alt=""
												className="profile-thumbnail"
												loading="lazy"
												style={
													withTransition
														? { viewTransitionName: `program-profile-${program.id}` }
														: undefined
												}
											/>
										)}
										<span className="title">
											<Link
												to="/broadcast/$programId"
												params={{ programId: program.id }}
												viewTransition
											>
												{program.name}
											</Link>
										</span>
										{program.creditedAs && (
											<>
												<br />
												<span className="subtitle">en tant que {program.creditedAs}</span>
											</>
										)}
									</div>
								);
							})}
						</div>
					</div>
				);
			})}
			<EpisodeTable
				title="Épisodes animés"
				episodes={data.episodes.filter((episode) => episode.role === "host")}
			/>
			<EpisodeTable title="Invitations" episodes={data.episodes.filter((episode) => episode.role !== "host")} />
		</section>
	);
}

const TYPE_ICONS: Record<string, string> = {
	video: "fa-solid fa-video",
	podcast: "fa-solid fa-podcast",
	live: "fa-solid fa-play",
	radio: "fa-solid fa-radio",
};

// As the program details list: one line per view (latest first), then the episodes never listened to, by release
function EpisodeTable({ title, episodes }: { title: string; episodes: Episode[] }) {
	const isOwner = useIsOwner();
	const navigate = useNavigate();
	if (!episodes.length) return null;

	const lines = toLines(episodes);
	const unwatched = episodes.filter(({ views }) => !views.length);

	// its details over the program page: a private route
	function openEpisode(episode: Pick<Episode, "id" | "program">) {
		navigate({
			to: "/broadcast/$programId/episode/$episodeId",
			params: { programId: episode.program.id, episodeId: episode.id },
			search: { returnTo: `/broadcast/${episode.program.id}` },
			mask: { to: "/broadcast/$programId", params: { programId: episode.program.id } },
		});
	}

	function cells(
		episode: Omit<Episode, "views">,
		episodeId: string,
		{ date, contextTags = [], durationReal, comment, lineId }: Partial<EpisodeLine> & { lineId: string },
	) {
		return (
			<>
				<td className="cell-icon" data-label="Type">
					{TYPE_ICONS[episode.type] && <i className={TYPE_ICONS[episode.type]}></i>}
				</td>
				<td className="cell-date" data-label="Date">
					{date ? (
						<DayDate date={date} />
					) : (
						<span className="smalltext" title="Pas encore écouté">
							{formatDate(episode.releaseDate)}
						</span>
					)}
				</td>
				<td className="cell-text" data-label="Émission">
					<Link to="/broadcast/$programId" params={{ programId: episode.program.id }} viewTransition>
						{episode.program.name}
					</Link>
				</td>
				<td className="cell-text">
					<EpisodeTitle
						episode={episode}
						watched={Boolean(date)}
						prefix={episode.numberLabel && <span className="number-label">{episode.numberLabel} · </span>}
						onOpen={isOwner ? () => openEpisode({ id: episodeId, program: episode.program }) : undefined}
					>
						{comment && (
							<>
								<span className="tooltip-anchor" style={{ anchorName: `--comment-${lineId}` }}>
									<i className="fa-solid fa-circle-info"></i>
								</span>
								<span className="tooltip-content" style={{ positionAnchor: `--comment-${lineId}` }}>
									{comment}
								</span>
							</>
						)}
					</EpisodeTitle>
				</td>
				<td className="cell-text" data-label="Tags">
					{(episode.tags ?? []).map((tag) => (
						<TagBadge key={tag} name={tag} />
					))}
					{(episode.ignoredTags ?? []).map((tag) => (
						<IgnoredTagBadge key={tag} name={tag} />
					))}
					{contextTags.map((tag) => (
						<ContextTagBadge key={tag} name={tag} />
					))}
				</td>
				<td className="cell-duration" data-label="Durée">
					{getDurationString(durationReal ?? episode.duration)}
					{durationReal ? "*" : ""}
				</td>
				<td className="cell-text" data-label="Rôle">
					{EPISODE_ROLE_LABELS[episode.role]}
					{episode.creditedAs && <> ({episode.creditedAs})</>}
				</td>
			</>
		);
	}

	return (
		<>
			<h3>{title}</h3>
			<table className="list alternate responsive">
				<thead>
					<tr>
						<th className="cell-index"></th>
						<th className="cell-icon"></th>
						<th className="cell-date">Date</th>
						<th className="cell-text">Émission</th>
						<th className="cell-text">Nom</th>
						<th className="cell-text">Tags</th>
						<th className="cell-duration">Durée</th>
						<th className="cell-text">Rôle</th>
					</tr>
				</thead>
				<tbody>
					{lines.map((line, index) => (
						<tr key={`${line.id}-${line.role}`}>
							<td className="cell-index">{index + 1}</td>
							{cells(line, line.episodeId, { ...line, lineId: line.id })}
						</tr>
					))}
					{unwatched.map(({ views: _views, ...episode }) => (
						<tr key={`${episode.id}-${episode.role}`}>
							<td className="cell-index"></td>
							{cells(episode, episode.id, { lineId: episode.id })}
						</tr>
					))}
				</tbody>
			</table>
		</>
	);
}
