import { Program } from "@personal-tracker/shared/broadcast";
import { Link } from "@tanstack/react-router";
import { ReactNode } from "react";

import { API_BASE_URL } from "../../../config";
import { formatFullDate, getDurationString } from "../../../utils";
import { toLines } from "../episode-lines";

export default function CardProgram({ program }: { program: Program }) {
	// one line per view, oldest first
	const lines = toLines(program.episodes, "asc");
	let lastSeenString = null;
	if (lines.length > 0) {
		const lastSeen = lines[lines.length - 1];

		lastSeenString = (
			<>
				📅 <span className="monospace">{formatFullDate(lastSeen.date)}</span> 🎧
				{lastSeen.shortName ?? lastSeen.name}
			</>
		);
	}

	const total = lines.reduce((sum, line) => (line.durationReal ?? line.duration) + sum, 0);

	const hasSubtitle = Boolean(program.author || program.network);
	return (
		<div className="card_item">
			{program.profile && (
				<img
					src={`${API_BASE_URL}${program.profile}`}
					alt=""
					className="profile-thumbnail"
					loading="lazy"
					style={{ viewTransitionName: `program-profile-${program.id}` }}
				/>
			)}
			<span className="title">
				<Link to="/broadcast/$programId" params={{ programId: program.id }} viewTransition>
					{program.name}
				</Link>
			</span>
			{hasSubtitle && <> - </>}
			{hasSubtitle && (
				<span className="card_subtitle">
					{program.author}
					{program.author && program.network && <> - </>}
					{program.network}
				</span>
			)}
			<br />
			{lastSeenString}
			<details>
				<summary>
					{lines.length} épisode
					{lines.length > 1 ? "s" : ""} ({getDurationString(total)})
				</summary>
				{lines.map((episode) => {
					const episodeLink = episode.link ?? "";
					const type: ReactNode = episode.link ? <a href={episodeLink}>{episode.type}</a> : episode.type;
					return (
						<div key={episode.id}>
							<span className="monospace">{formatFullDate(episode.date)}</span>: <b>{episode.name}</b>{" "}
							{getDurationString(episode.durationReal ?? episode.duration)}
							{episode.durationReal ? "*" : ""} ({type})
						</div>
					);
				})}
			</details>
		</div>
	);
}
