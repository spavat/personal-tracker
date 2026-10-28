import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useOptimistic, useTransition } from "react";
import { Fragment } from "react/jsx-runtime";

import { PendingContent } from "../../components/pending-content";
import { useStoredValue } from "../../hooks/stored-value";
import { groupedWorksQuery } from "./api";
import { formatShowDate } from "./utils";

export default function WorkList() {
	const navigate = useNavigate();
	const [groupByYear, setGroupByYear] = useStoredValue("show_work_list_groupByYear", false);
	const [isPending, startTransition] = useTransition();
	const [optimisticGroupByYear, setOptimisticGroupByYear] = useOptimistic(groupByYear);
	function changeGroupByYear(e: React.ChangeEvent<HTMLInputElement>) {
		// transition: keep the current list displayed while the new grouping loads
		const checked = e.target.checked;
		startTransition(() => {
			setOptimisticGroupByYear(checked);
			setGroupByYear(checked);
		});
	}

	const { data: works } = useSuspenseQuery(groupedWorksQuery(groupByYear));

	return (
		<>
			<h2>
				Oeuvres
				<label>
					<input type="checkbox" checked={optimisticGroupByYear} onChange={changeGroupByYear} /> Grouper par
					année
				</label>
			</h2>

			<PendingContent isPending={isPending}>
				<table className="list works alternate">
					<thead>
						<tr>
							<th></th>
							<th>Oeuvre</th>
							<th>Représentations</th>
							<th>Spectacles</th>
							<th>Spectacles</th>
							<th>Lieu</th>
							<th>#</th>
							<th>Dates</th>
							<th>Actions</th>
						</tr>
					</thead>
					{works.map(({ id, name, nbPerformances, nbSpectacles, nbWorks, works }) => {
						let index = 1;

						return (
							<Fragment key={id}>
								<tbody className="year">
									<tr>
										<td colSpan={9}>
											<span className="title">
												{id === "all" ? "Années" : "Année"} {name}
											</span>{" "}
											<span className="subtitle">
												(<b>{nbWorks}</b> oeuvres - <b>{nbSpectacles}</b> spectacles -{" "}
												<b>{nbPerformances}</b> représentations)
											</span>
										</td>
									</tr>
								</tbody>
								{works.map((work: any) => {
									// flatten spectacles > places
									const flatSpectaclePlace = work.spectacles.reduce((acc: any, spec: any) => {
										spec.places.forEach((place: any, index: number) => {
											acc.push({
												id: `${spec.id}-${place.id}-${place.name}`, // a renamed place is listed once per name
												hasSpectacle: index === 0, // only the first line need the spectacle time
												displaySpectacle: work.spectacles.length > 1,
												rowSpan: spec.places.length,
												spectacleId: spec.id,
												spectacleName: spec.name,
												placeId: place.id,
												placeName: place.name,
												performances: place.performances,
											});
										});
										return acc;
									}, []);

									const nbRows = work.spectacles.reduce((acc: any, spec: any) => {
										return acc + spec.places.length;
									}, 0);

									return (
										<tbody key={work.id} className="work">
											{flatSpectaclePlace.map((dataRow: any, i: number) => {
												return (
													<tr key={dataRow.id}>
														{i === 0 && (
															<td
																rowSpan={nbRows}
																className="alignRight smalltext monospace"
															>
																#{index++}
															</td>
														)}
														{i === 0 && (
															<td rowSpan={nbRows} className="alignLeft">
																{work.name}
															</td>
														)}
														{i === 0 && (
															<td rowSpan={nbRows} className="alignRight monospace">
																{work.nbPerformances}
															</td>
														)}
														{i === 0 && (
															<td rowSpan={nbRows} className="alignRight monospace">
																{work.nbSpectacles}
															</td>
														)}

														{dataRow.hasSpectacle && (
															<td rowSpan={dataRow.rowSpan} className="alignLeft">
																{dataRow.displaySpectacle ? dataRow.spectacleName : ""}
															</td>
														)}
														<td className="alignLeft">{dataRow.placeName}</td>
														<td className="alignRight monospace">
															{dataRow.performances.length}
														</td>
														<td className="alignLeft">
															{dataRow.performances.map((d: any) => {
																const isFuture = new Date(d.date) > new Date();
																return (
																	<span
																		key={d.date}
																		className={`monospace small ${d.canceled ? "canceled" : ""}`}
																	>
																		{isFuture && <>📅</>}
																		{formatShowDate(d.date, false)}{" "}
																	</span>
																);
															})}
														</td>
														{i === 0 && (
															<td
																rowSpan={nbRows}
																className="alignRight smalltext monospace"
															>
																<button
																	type="button"
																	title="Modifier"
																	onClick={() =>
																		navigate({
																			to: "/shows/works/edit/$workId",
																			params: { workId: String(work.id) },
																			search: { returnTo: location.pathname },
																			replace: true,
																			resetScroll: false,
																			mask: {
																				to: "/shows/works",
																			},
																		})
																	}
																>
																	<i className="fa-regular fa-pen-to-square"></i>
																</button>
															</td>
														)}
													</tr>
												);
											})}
										</tbody>
									);
								})}
							</Fragment>
						);
					})}
				</table>
			</PendingContent>
			<Outlet />
			<div className="fab-container">
				<button
					type="button"
					className="fab-main"
					aria-label="Ajouter une oeuvre"
					onClick={() =>
						navigate({
							to: "/shows/works/add",
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: { to: "/shows/works" },
						})
					}
				>
					<div className="pulse"></div>
					<div className="heart-line" aria-hidden="true">
						<i className="fa-solid fa-plus"></i>
					</div>
				</button>
			</div>
		</>
	);
}
