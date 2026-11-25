import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import DayDate from "../../../components/DayDate";
import { getDurationString } from "../../../utils";
import { reviewQuery } from "../api";
import IgnoredTagBadge from "../components/IgnoredTagBadge";
import { toLines } from "../episode-lines";

export default function Review() {
	const navigate = useNavigate();
	const location = useLocation();
	const { data } = useSuspenseQuery(reviewQuery());

	return (
		<>
			{data.length === 0 ? (
				<p>Aucun épisode sans tag</p>
			) : (
				<table className="list episodesNoTag alternate responsive">
					<thead>
						<tr data-title={`${data.length} épisodes sans tag`}>
							<th className="cell-index"></th>
							<th className="cell-icon"></th>
							<th className="cell-date">Date</th>
							<th className="cell-text">Programme</th>
							<th className="cell-text">Nom</th>
							<th className="cell-text">Tags</th>
							<th className="cell-duration">Durée</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{data.map(({ programId, programName, episode: { views, ...rest } }, i) => {
							// shown and edited through its latest view
							const episode = toLines([{ ...rest, views }])[0];
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
									<td className="cell-text" data-label="Programme">
										<Link to="/broadcast/$programId" params={{ programId }}>
											{programName}
										</Link>
									</td>
									<td className="cell-text">{episode.name}</td>
									<td className="cell-text" data-label="Tags">
										{(episode.ignoredTags ?? []).map((t) => (
											<IgnoredTagBadge key={t} name={t} />
										))}
									</td>
									<td className="cell-duration" data-label="Durée">
										{getDurationString(episode.durationReal ?? episode.duration)}
										{episode.durationReal ? "*" : ""}
									</td>
									<td data-label="Actions">
										<button
											type="button"
											title="Modifier"
											onClick={() =>
												navigate({
													to: "/broadcast/review/view/$programId/$viewId/edit",
													params: { programId, viewId: episode.id },
													search: { returnTo: location.pathname },
													replace: true,
													resetScroll: false,
													mask: { to: "/broadcast/review" },
												})
											}
										>
											<i className="fa-regular fa-pen-to-square"></i>
										</button>
									</td>
								</tr>
							);
						})}
					</tbody>
					<tfoot></tfoot>
				</table>
			)}

			<Outlet />
		</>
	);
}
