import { PerformanceView } from "@personal-tracker/shared/show";
import { Link } from "@tanstack/react-router";

import { formatShowDate, mediaSrc } from "../utils";
import { CastingIcon } from "./CastingIcon";

export default function Card({ performance }: { performance: PerformanceView }) {
	const [date, time] = formatShowDate(performance.date).split(" ");

	return (
		<div className="card_item performance">
			{performance.posterUrl ? (
				<img
					src={mediaSrc(performance.posterUrl)}
					alt=""
					className="poster-card"
					style={{ viewTransitionName: `poster-${performance.id}` }}
					loading="lazy"
				/>
			) : (
				<div className="poster-card">
					<i className="fa-solid fa-masks-theater"></i>
				</div>
			)}
			<div>
				<span className="title">
					<Link to="/shows/performances/$performanceId" params={{ performanceId: String(performance.id) }}>
						{performance.spectacle.name}
					</Link>
				</span>
				<br />📅{" "}
				<span className="monospace">
					{date} <span className="smalltext">{time}</span>
				</span>
				<br />
				<span className={`fi fi-${performance.place?.country}`}></span> {performance.place?.name}
				<br />🎫 {performance.seat}
				{performance.casting_status === "unknown" || performance.casting_status === "tbd" ? (
					<div>
						<CastingIcon {...performance} /> Casting inconnu
					</div>
				) : (
					<details>
						<summary>
							<CastingIcon {...performance} /> Casting
						</summary>
						<ul>
							{(performance.roles ?? []).map((role) => (
								<li key={role.id}>
									{role.pictureUrl && (
										<img
											src={mediaSrc(role.pictureUrl)}
											alt=""
											className="portrait-thumb in-list"
											loading="lazy"
										/>
									)}
									<Link to="/shows/artists/$artistId" params={{ artistId: String(role.artist.id) }}>
										{role.artist.name}
									</Link>{" "}
									- {role.name} {role.status && <>({role.status})</>}
								</li>
							))}
						</ul>
					</details>
				)}
			</div>
		</div>
	);
}
