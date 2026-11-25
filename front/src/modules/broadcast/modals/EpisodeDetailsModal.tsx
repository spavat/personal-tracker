import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ContextTagBadge from "../../../components/ContextTagBadge";
import Modal from "../../../components/Modal";
import TagBadge from "../../../components/TagBadge";
import { formatDate, formatDateTime, getDurationString } from "../../../utils";
import { programDetailsQuery } from "../api";
import CreditLinks from "../components/CreditLinks";
import EpisodeCover from "../components/EpisodeCover";
import IgnoredTagBadge from "../components/IgnoredTagBadge";
import { EPISODE_CREDIT_ROLES } from "../forms/EpisodeForm.utils";
import { getDomain } from "../links";

const CREDIT_LABELS = Object.fromEntries(EPISODE_CREDIT_ROLES.map(({ value, label }) => [value, label]));
const TYPE_ICONS: Record<string, string> = {
	video: "fa-solid fa-video",
	podcast: "fa-solid fa-podcast",
	live: "fa-solid fa-play",
	radio: "fa-solid fa-radio",
};
const STATUS_LABELS = { planned: "À voir", skipped: "Ignoré" };

// Everything of an episode, read only, organised like the program's header: title, general infos with the cover,
// description, figures; then its views
export default function EpisodeDetailsModal({
	programId,
	episodeId,
	returnTo,
}: {
	programId: string;
	episodeId: string;
	returnTo: string;
}) {
	const navigate = useNavigate();
	const { data: program } = useSuspenseQuery(programDetailsQuery(programId));
	const episode = program.episodes.find(({ id }) => id === episodeId)!;
	const season = program.seasons.find(({ id }) => id === episode.seasonId);
	const format = program.formats.find(({ id }) => id === episode.formatId);
	// latest first
	const views = episode.views.toSorted((a, b) => b.date.localeCompare(a.date));

	function closeModal() {
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	const row = (label: string, value: React.ReactNode) => (
		<>
			<span>
				{label} : {value}
			</span>
			<br />
		</>
	);

	return (
		<Modal
			className="modal dialog-extralarge episode-details"
			isOpen={true}
			onClose={closeModal}
			hasCloseBtn={true}
		>
			<div className="dialog-header">
				<h2 id="dialog-title">Détails de l'épisode</h2>
			</div>
			<div className="dialog-body">
				<div className="presentation">
					<div className="title">
						<h2>
							{episode.numberLabel && <span className="number-label">{episode.numberLabel} · </span>}
							{episode.name}
							{episode.shortName && <span className="subTitle"> ({episode.shortName})</span>}
						</h2>
					</div>
					<div className="general">
						<EpisodeCover episode={episode} watched={views.length > 0} className="large" />
						<div>
							{row("Programme", <b>{program.name}</b>)}
							{season && row("Saison", <b>{season.label}</b>)}
							{format && row("Format", <b>{format.label}</b>)}
							{episode.type &&
								row(
									"Type",
									<>
										<i className={TYPE_ICONS[episode.type] ?? "fa-solid fa-circle"}></i>{" "}
										{episode.type}
									</>,
								)}
							{episode.releaseDate && row("Sortie", <b>{formatDate(episode.releaseDate)}</b>)}
							{episode.duration > 0 && row("Durée", <b>{getDurationString(episode.duration)}</b>)}
							{episode.link && row("Lien", <a href={episode.link}>{getDomain(episode.link)}</a>)}
							{episode.externalId && row("Id externe", <code>{episode.externalId}</code>)}
							{episode.credits.length > 0 &&
								row(
									"Participants",
									episode.credits.map((credit) => (
										<span key={`${credit.role}-${credit.entityId}`} className="episode-credit">
											{CREDIT_LABELS[credit.role]} :{" "}
											<b>
												<CreditLinks credits={[credit]} />
											</b>{" "}
										</span>
									)),
								)}
							{((episode.tags ?? []).length > 0 || (episode.ignoredTags ?? []).length > 0) &&
								row(
									"Tags",
									<>
										{(episode.tags ?? []).map((tag) => (
											<TagBadge key={tag} name={tag} />
										))}
										{(episode.ignoredTags ?? []).map((tag) => (
											<IgnoredTagBadge key={tag} name={tag} />
										))}
									</>,
								)}
						</div>
					</div>
					<div className="description"></div>
					<div className="stats">
						<div>
							<span>
								<i className="fa-solid fa-eye"></i> <strong>{views.length}</strong> vue(s)
							</span>
							<br />
							{views[0] && (
								<>
									<span>
										<i className="fa-solid fa-calendar"></i> Dernière vue :{" "}
										<strong>{formatDate(views[0].date)}</strong>
									</span>
									<br />
								</>
							)}
							{episode.status && (
								<>
									<span>
										<i
											className={
												episode.status === "planned"
													? "fa-solid fa-bookmark"
													: "fa-solid fa-ban"
											}
										></i>{" "}
										<strong>{STATUS_LABELS[episode.status]}</strong>
									</span>
									<br />
								</>
							)}
						</div>
					</div>
				</div>
				<div className="description">{episode.description}</div>

				{views.length > 0 && (
					<table className="list episode-views alternate responsive">
						<thead>
							<tr data-title="Vues">
								<th className="cell-date">Date</th>
								<th className="cell-duration">Durée</th>
								<th className="cell-text">Contexte</th>
								<th className="cell-text">Commentaire</th>
								<th className="cell-date">Créée le</th>
							</tr>
						</thead>
						<tbody>
							{views.map((view) => (
								<tr key={view.id}>
									<td className="cell-date" data-label="Date">
										{formatDate(view.date)}
									</td>
									<td className="cell-duration" data-label="Durée">
										{getDurationString(view.duration ?? episode.duration)}
										{view.duration ? "*" : ""}
									</td>
									<td className="cell-text" data-label="Contexte">
										{(view.contextTags ?? []).map((tag) => (
											<ContextTagBadge key={tag} name={tag} />
										))}
									</td>
									<td className="cell-text" data-label="Commentaire">
										{view.comment}
									</td>
									<td className="cell-date smalltext" data-label="Créée le">
										{view.created && formatDateTime(view.created)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
			<div className="dialog-footer">
				<button type="button" onClick={closeModal}>
					Fermer
				</button>
			</div>
		</Modal>
	);
}
