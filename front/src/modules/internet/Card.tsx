import { Program } from "@personal-tracker/shared/internet";
import { Link } from "@tanstack/react-router";
import { ReactNode } from "react";

import { API_BASE_URL } from "../../config";
import { formatFullDate, getDurationString } from "../../utils";

export default function Card({ program }: { program: Program }) {
	let lastSeenString = null;
	if (program.episodes.length > 0) {
		const lastSeen = program.episodes[program.episodes.length - 1];

		lastSeenString = (
			<>
				📅 <span className="monospace">{formatFullDate(lastSeen.date)}</span> 🎧
				{lastSeen.shortName ?? lastSeen.name}
			</>
		);
	}

	const total = program.episodes.reduce((sum, episode) => (episode.durationReal ?? episode.duration) + sum, 0);

	const hasSubtitle = Boolean(program.author || program.network);

	return (
		<div className="card_item">
			{program.profile && (
				<img src={`${API_BASE_URL}${program.profile}`} alt="" className="profile-thumbnail" loading="lazy" />
			)}
			<span className="title">
				<Link to="/internet/$programId" params={{ programId: program.id }}>
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
					{program.episodes.length} épisode
					{program.episodes.length > 1 ? "s" : ""} ({getDurationString(total)})
				</summary>
				{program.episodes.map((episode) => {
					const episodeLink = episode.link ?? "";
					const type: ReactNode = episode.link ? <a href={episodeLink}>{episode.type}</a> : episode.type;
					return (
						<div key={`${program.id}-${episode.id}-${episode.date}`}>
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
