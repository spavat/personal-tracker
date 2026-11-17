import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useOptimistic, useTransition } from "react";
import { Fragment } from "react/jsx-runtime";

import PageTitle from "../../../components/PageTitle";
import { PendingContent } from "../../../components/PendingContent";
import { useStoredValue } from "../../../hooks/stored-value";
import { groupedSpectaclesQuery } from "../api";
import { MODULE_NAME } from "../constants";
import { formatShowDate, isFutureShow } from "../utils";

export default function SpectacleDetails() {
	const [groupByYear, setGroupByYear] = useStoredValue("show_spectacle_list_groupByYear", false);
	const [isPending, startTransition] = useTransition();

	const [optimisticGroupByYear, setOptimisticGroupByYear] = useOptimistic(groupByYear);
	function changeGroupByYear(e: React.ChangeEvent<HTMLInputElement>) {
		const checked = e.target.checked;
		// transition: keep the current list displayed while the new grouping loads
		startTransition(() => {
			setOptimisticGroupByYear(checked);
			setGroupByYear(checked);
		});
	}

	const { data: spectaclesGroup } = useSuspenseQuery(groupedSpectaclesQuery(groupByYear));

	return (
		<>
			<PageTitle title={`${MODULE_NAME} > Spectacles`} />
			<h2>
				Spectacles
				<label>
					<input type="checkbox" checked={optimisticGroupByYear} onChange={changeGroupByYear} /> Grouper par
					année
				</label>
			</h2>

			<PendingContent isPending={isPending}>
				<table className="list spectacles alternate responsive">
					<thead>
						<tr>
							<th className="cell-index"></th>
							<th className="cell-text">Spectacle</th>
							<th className="cell-number">Représentation</th>
							<th className="cell-text">Lieu</th>
							<th className="cell-text">Dates</th>
						</tr>
					</thead>
					<tbody>
						{spectaclesGroup.map(({ id, name, nbPerformances, nbSpectacles, spectacles }) => (
							<Fragment key={id}>
								<tr>
									<td colSpan={5}>
										<span className="title">
											{id === "all" ? "Années" : "Année"} {name}
										</span>{" "}
										<span className="subtitle">
											(<b>{nbSpectacles}</b> spectacles - <b>{nbPerformances}</b> représentations)
										</span>
									</td>
								</tr>
								{spectacles.map((show: any, index: number) => (
									<Fragment key={show.id}>
										<tr>
											<td className="cell-index">{index + 1}</td>
											<td className="cell-text">
												<Link
													to="/shows/spectacles/$spectacleId"
													params={{ spectacleId: String(show.id) }}
												>
													{show.name}
												</Link>
											</td>
											<td className="cell-number" data-label="Représentations">
												{show.nbPerformances}
											</td>
											<td className="cell-text" data-label="Lieu">
												{show.places.map((place: any) => (
													// a renamed place is listed once per name (same id)
													<Fragment key={`${place.id}-${place.name}`}>
														<Link
															to="/shows/places/$placeId"
															params={{ placeId: String(place.id) }}
														>
															{place.name}
														</Link>
														<br />
													</Fragment>
												))}
											</td>
											<td className="cell-text" data-label="Dates">
												{show.places.map((place: any) => (
													<span
														key={`${id}-${show.name}-${place.id}-${place.name}`}
														className="smalltext monospace"
													>
														{place.performances.map((d: any) => {
															const isFuture = isFutureShow(d.date);
															return (
																<span
																	key={d.date}
																	className={`smalltext ${d.canceled ? "canceled" : ""}`}
																>
																	{isFuture && <>📅</>}
																	{formatShowDate(d.date, false)}{" "}
																</span>
															);
														})}
														<br />
													</span>
												))}
											</td>
										</tr>
									</Fragment>
								))}
							</Fragment>
						))}
					</tbody>
				</table>
			</PendingContent>
		</>
	);
}
