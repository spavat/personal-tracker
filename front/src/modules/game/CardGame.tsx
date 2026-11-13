import { Game } from "@personal-tracker/shared/game";
import { Link } from "@tanstack/react-router";
import React from "react";

import { API_BASE_URL } from "../../config";
import { getDurationString } from "../../utils";
import GameOriginBadge from "./GameOriginBadge";
import { formatPlayDate, formatPlayDay } from "./origins";

export default function GameCardGame({ game }: { game: Game }) {
	let lastPlayString = "";
	if (Array.isArray(game.plays) && game.plays.length > 0) {
		const lastPlay = game.plays[game.plays.length - 1];
		lastPlayString = `📅 ${formatPlayDate(lastPlay)}`;
	}
	let totalDuration = "";
	if (Array.isArray(game.plays) && game.plays.length > 0) {
		const duration = game.plays.reduce((sum: number, play) => sum + (play.duration ?? 0), 0);
		// no duration recorded: 0, not left empty
		totalDuration = `⏱️ ${getDurationString(duration) || "0min"}`;
	}

	return (
		<div key={`${game.name}`} className="card_item">
			{game.complete && <span className="status complete"></span>}
			{game.capsule && <img src={`${API_BASE_URL}${game.capsule}`} alt="" className="game-capsule" />}
			<span className="title">
				<Link to="/game/details/$gameId" params={{ gameId: game.id }}>
					{game.name}
				</Link>
			</span>{" "}
			- <span className="subtitle">{game.developper}</span>
			<br />
			{lastPlayString} {totalDuration} 🔗
			{Array.isArray(game.links) && game.links.length > 0 && (
				<>
					{game.links.map((link) => (
						<React.Fragment key={link.link}>
							<a href={link.link}>{link.name}</a>{" "}
						</React.Fragment>
					))}
				</>
			)}
			<details>
				<summary>Détails de jeu ({(game.plays ?? []).length})</summary>
				<ul>
					{(game.plays ?? []).map((play) => {
						return (
							<li key={play.id}>
								<span className="monospace">
									📅 <span className="fixed_day">{formatPlayDay(play)}</span> {formatPlayDate(play)} :
									⏱️{getDurationString(play.duration ?? 0)}
								</span>{" "}
								{play.origin && <GameOriginBadge origin={play.origin} />}
								{play.comment && (
									<>
										<br />
										<span className="multi_lines_text">{play.comment}</span>
									</>
								)}
							</li>
						);
					})}
				</ul>
				{game.comment ? <b>{game.comment}</b> : <></>}
			</details>
		</div>
	);
}
