import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useOptimistic, useTransition } from "react";
import { Fragment } from "react/jsx-runtime";

import { PendingContent } from "../../components/pending-content";
import { useStoredValue } from "../../hooks/stored-value";
import { useIsOwner } from "../../hooks/use-is-owner";
import { formatDate, getPeriodDifference } from "../../utils";
import { placeDetailsQuery } from "./api";
import { formatShowDate } from "./utils";

export default function PlaceDetails({ placeId }: { placeId: string }) {
	const navigate = useNavigate();
	const isOwner = useIsOwner();

	const [groupBySpectacle, setGroupBySpectacle] = useStoredValue("show_place_details_groupBySpectacle", false);
	const [isPending, startTransition] = useTransition();
	const [optimisticGroupBySpectacle, setOptimisticGroupBySpectacle] = useOptimistic(groupBySpectacle);
	function changeGroupBySpectacle(e: React.ChangeEvent<HTMLInputElement>) {
		// transition: keep the current details displayed while the new grouping loads
		const checked = e.target.checked;
		startTransition(() => {
			setOptimisticGroupBySpectacle(checked);
			setGroupBySpectacle(checked);
		});
	}

	const { data: details } = useSuspenseQuery(placeDetailsQuery(placeId, groupBySpectacle));

	let index = 1;

	return (
		<>
			<div className="presentation">
				<div className="title">
					<h2>
						<span className={`fi fi-${details.country}`}></span> {details.name}{" "}
						{isOwner && (
							<button
								type="button"
								title="Modifier"
								onClick={() =>
									navigate({
										to: "/shows/places/$placeId/edit",
										params: { placeId },
										search: { returnTo: location.pathname },
										replace: true,
										resetScroll: false,
										mask: {
											to: "/shows/places/$placeId",
											params: { placeId },
										},
									})
								}
							>
								<i className="fa-regular fa-pen-to-square"></i>
							</button>
						)}
					</h2>
				</div>
				<div className="general">
					<div style={{ whiteSpace: "pre-wrap" }}>
						{details.formerNames.map((formerName) => (
							<Fragment key={formerName.untilDate}>
								<span>
									<i className="fa-solid fa-clock-rotate-left"></i> {formerName.name} (avant le{" "}
									{formatDate(formerName.untilDate)})
								</span>
								<br />
							</Fragment>
						))}
						{details.address && (
							<>
								<span>{details.address}</span>
								<br />
							</>
						)}
						{details.link && (
							<>
								<i className="fa-solid fa-link"></i>{" "}
								<a href={details.link} target="_blank" rel="noopener noreferrer">
									{details.link}
								</a>
								<br />
							</>
						)}
					</div>
				</div>
				<div className="stats">
					<div>
						<span>
							<i className="fa-solid fa-masks-theater"></i> <strong>{details.stats.nbSpectacles}</strong>{" "}
							spectacle{details.stats.nbSpectacles > 1 ? "s" : ""}
						</span>
						<br />
						<span>
							<i className="fa-solid fa-square-poll-vertical"></i>
							<strong>{details.stats.nbPerformances}</strong> représentation
							{details.stats.nbPerformances > 1 ? "s" : ""}
						</span>
						<br />
						<span>
							<i className="fa-solid fa-calendar"></i> Dernière fois :{" "}
							<strong>
								{details.stats.lastPerformance ? (
									<>
										{getPeriodDifference(details.stats.lastPerformance)} (
										{formatDate(details.stats.lastPerformance)})
									</>
								) : (
									"Aucune"
								)}
							</strong>
						</span>
						<br />
					</div>
				</div>
			</div>

			<h2>
				Liste des représentations
				<label>
					<input type="checkbox" checked={optimisticGroupBySpectacle} onChange={changeGroupBySpectacle} />{" "}
					Grouper par spectacle
				</label>
			</h2>
			<PendingContent isPending={isPending}>
				<table className="list performances alternate responsive">
					<thead>
						<tr>
							<th></th>
							<th>Date</th>
							<th>Spectacle</th>
							<th>Lieu</th>
							<th>Pays</th>
							<th>Place</th>
						</tr>
					</thead>
					<tbody>
						{details.groups.map((spectacle) => (
							<Fragment key={spectacle.id ?? "spectacle"}>
								{groupBySpectacle && (
									<tr>
										<td colSpan={7}>
											<span className="title">{spectacle.name}</span>{" "}
											<span className="subtitle">
												{spectacle.performances.length > 1 && (
													<>({spectacle.performances.length})</>
												)}
											</span>
										</td>
									</tr>
								)}

								{spectacle.performances.map((perf) => {
									const [date, time] = formatShowDate(perf.date).split(" ");
									return (
										<tr key={perf.id} className={perf.canceled ? "canceled" : ""}>
											<td className="smalltext">{!perf.canceled && <>#{index++}</>}</td>
											<td data-label="Date">
												{date} <span className="smalltext">{time}</span>
											</td>
											<td>
												<Link
													to="/shows/spectacles/$spectacleId"
													params={{ spectacleId: String(perf.spectacleId) }}
												>
													{perf.spectacleName}
												</Link>
											</td>
											<td data-label="Lieu">{perf.placeName}</td>
											<td data-label="Pays">
												<span className={`fi fi-${perf.placeCountry}`}></span>
											</td>
											<td data-label="Place">{perf.seat ? <> 🎫 {perf.seat}</> : ""}</td>
										</tr>
									);
								})}
							</Fragment>
						))}
					</tbody>
				</table>
			</PendingContent>
			<Outlet />
		</>
	);
}
