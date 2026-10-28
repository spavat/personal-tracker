import { PerformanceListResponse } from "@personal-tracker/shared/show";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Fragment } from "react/jsx-runtime";

import { HeaderPortal } from "../../components/HeaderPortal";
import PageTitle from "../../components/page-title";
import PeriodSelector from "../../components/period-selector";
import { useIsOwner } from "../../hooks/use-is-owner";
import { useYearChanger } from "../../hooks/use-year-changer";
import { formatMonth } from "../../utils";
import { performanceHistory } from "./api";
import { CastingIcon } from "./CastingIcon";
import { MODULE_NAME } from "./constants";
import { formatShowDate } from "./utils";

export default function History({ year }: { year: string }) {
	const navigate = useNavigate();
	const isOwner = useIsOwner();
	const location = useLocation();
	const [period, listQuery, goPrevious, goNext, canGoPrevious, canGoNext] = useYearChanger({
		...performanceHistory,
		navigationIsDisabled: (period: string, delta: "previous" | "next") => {
			const futureYear = String(Temporal.Now.plainDateISO().add({ years: 2 }).year);
			if (delta === "next" && period >= futureYear) {
				return true;
			} else if (delta === "previous" && period <= "2021") {
				return true;
			}
			return false;
		},
		initialPeriod: year,
	});

	const groups: Record<string, { name: string; performances: Array<PerformanceListResponse> }> = {};
	listQuery.data.forEach((perf) => {
		const month = perf.date.substring(5, 7);
		if (!groups[month]) {
			groups[month] = {
				name: formatMonth(`${period}-${month}-01`),
				performances: [],
			};
		}
		groups[month].performances.push(perf);
	});
	const sortedMonths = Object.keys(groups).toSorted((a, b) => a.localeCompare(b));

	let index = 1;
	return (
		<>
			<HeaderPortal>
				<PeriodSelector
					period={`Année ${period}`}
					goPrevious={goPrevious}
					goNext={goNext}
					canGoPrevious={canGoPrevious()}
					canGoNext={canGoNext()}
					type="year"
				/>
			</HeaderPortal>

			<PageTitle title={`${MODULE_NAME} > Historique ${period}`} />
			<h2>Spectacles de l'année {period}</h2>

			<table className="list performances alternate">
				<thead>
					<tr>
						<th></th>
						<th>Date</th>
						<th>Spectacle</th>
						<th>Lieu</th>
						<th>Pays</th>
						<th>Place</th>
						<th>Casting</th>
					</tr>
				</thead>
				<tbody>
					{sortedMonths.map((month) => {
						const group = groups[month];
						return (
							<Fragment key={month}>
								<tr>
									<td colSpan={7}>
										<span className="title">{group.name}</span>{" "}
										<span className="subtitle">
											{group.performances.length > 1 && <>({group.performances.length})</>}
										</span>
									</td>
								</tr>
								{group.performances.map((show) => {
									const [date, time] = formatShowDate(show.date).split(" ");
									return (
										<tr key={show.id} className={show.canceled ? "canceled" : ""}>
											<td className="smalltext">{!show.canceled && <>#{index++}</>}</td>
											<td>
												<Link
													to="/shows/performances/$performanceId"
													params={{ performanceId: String(show.id) }}
												>
													{date}
												</Link>{" "}
												<span className="smalltext">{time}</span>
											</td>
											<td>
												<b>
													<Link
														to="/shows/spectacles/$spectacleId"
														params={{ spectacleId: String(show.spectacleId) }}
													>
														{show.spectacle}
													</Link>
												</b>
											</td>
											<td>
												<Link
													to="/shows/places/$placeId"
													params={{ placeId: String(show.placeId) }}
												>
													{show.place}
												</Link>
											</td>
											<td>
												<span className={`fi fi-${show.country}`}></span>
											</td>
											<td>{show.seat ? <> 🎫 {show.seat}</> : ""}</td>
											<td>
												<CastingIcon {...show} />
											</td>
										</tr>
									);
								})}
							</Fragment>
						);
					})}
				</tbody>
			</table>
			<Outlet />
			{isOwner && (
				<div className="fab-container">
					<button
						type="button"
						className="fab-main"
						aria-label="Ajouter une représentation"
						onClick={() =>
							navigate({
								to: "/shows/history/$year/add",
								params: { year },
								search: { returnTo: location.pathname },
								replace: true,
								resetScroll: false,
								mask: { to: "/shows/history/$year", params: { year } },
							})
						}
					>
						<div className="pulse"></div>
						<div className="heart-line" aria-hidden="true">
							<i className="fa-solid fa-plus"></i>
						</div>
					</button>
				</div>
			)}
		</>
	);
}
