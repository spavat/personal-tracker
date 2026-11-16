import { Game } from "@personal-tracker/shared/game";
import { Link } from "@tanstack/react-router";

import { API_BASE_URL } from "../../../config";
import { getStatusIcon } from "../../reading-manga/search-fn";
import { formatPlayDuration } from "../duration";
import { formatPlayDate, formatPlayDay } from "../origins";
import PlayDate from "./PlayDate";

export default function GameCardGame({ game }: { game: Game }) {
	let lastPlayString = "";
	if (Array.isArray(game.plays) && game.plays.length > 0) {
		const lastPlay = game.plays[game.plays.length - 1];
		lastPlayString = `📅 ${formatPlayDate(lastPlay)}`;
	}
	let totalDuration = "";
	if (Array.isArray(game.plays) && game.plays.length > 0) {
		const duration = game.plays.reduce((sum: number, play) => sum + (play.duration ?? 0), 0);
		totalDuration = `⏱️ ${formatPlayDuration(duration) || "0min"}`;
	}

	const status = getStatusIcon({ status: game.complete ? "complete" : "in-progress" }, { color: false });

	return (
		<div key={`${game.name}`} className="card_item">
			{game.complete && <span className="status complete">{status}</span>}
			{game.header && <img src={`${API_BASE_URL}${game.header}`} alt="" className="game-header-card" />}
			<span className="title">
				<Link to="/game/details/$gameId" params={{ gameId: game.id }}>
					{game.name}
				</Link>
			</span>{" "}
			- <span className="subtitle">{game.developper}</span>
			<br />
			{lastPlayString} {totalDuration}
			<details>
				<summary>Détails de jeu ({(game.plays ?? []).length})</summary>
				<ul>
					{(game.plays ?? []).map((play) => {
						return (
							<li key={play.id}>
								<span className="monospace">
									📅 <span className="fixed_day">{formatPlayDay(play)}</span> <PlayDate {...play} /> :
									⏱️
									{formatPlayDuration(play.duration ?? 0)}
								</span>
							</li>
						);
					})}
				</ul>
				{game.comment ? <b>{game.comment}</b> : <></>}
			</details>
		</div>
	);
}
