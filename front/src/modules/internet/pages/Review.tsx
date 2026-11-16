import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { formatDate, formatDay, getDurationString } from "../../../utils";
import { reviewQuery } from "../api";
import IgnoredTagBadge from "../components/IgnoredTagBadge";

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
							<th></th>
							<th colSpan={2}>Date</th>
							<th>Programme</th>
							<th>Nom</th>
							<th>Tags</th>
							<th>Durée</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{data.map(({ programId, programName, episode }) => (
							<tr key={episode.id}>
								<td data-label="Type">
									{episode.type === "video" && <i className="fa-solid fa-video"></i>}
									{episode.type === "podcast" && <i className="fa-solid fa-podcast"></i>}
									{episode.type === "live" && <i className="fa-solid fa-play"></i>}
									{episode.type === "radio" && <i className="fa-solid fa-radio"></i>}
								</td>
								<td data-label="Jour">{formatDay(episode.date)}</td>
								<td data-label="Date">{formatDate(episode.date)}</td>
								<td data-label="Programme">
									<Link to="/internet/$programId" params={{ programId }}>
										{programName}
									</Link>
								</td>
								<td>{episode.name}</td>
								<td data-label="Tags">
									{(episode.ignoredTags ?? []).map((t) => (
										<IgnoredTagBadge key={t} name={t} />
									))}
								</td>
								<td data-label="Durée">
									{getDurationString(episode.durationReal ?? episode.duration)}
									{episode.durationReal ? "*" : ""}
								</td>
								<td data-label="Actions">
									<button
										type="button"
										title="Modifier"
										onClick={() =>
											navigate({
												to: "/internet/review/episode/$programId/$episodeId/edit",
												params: { programId, episodeId: episode.id },
												search: { returnTo: location.pathname },
												replace: true,
												resetScroll: false,
												mask: { to: "/internet/review" },
											})
										}
									>
										<i className="fa-regular fa-pen-to-square"></i>
									</button>
								</td>
							</tr>
						))}
					</tbody>
					<tfoot></tfoot>
				</table>
			)}

			<Outlet />
		</>
	);
}
