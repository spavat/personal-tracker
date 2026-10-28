import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

import { formatFullDate, getDurationString } from "../../../utils";
import { allActivitiesQuery } from "../api";
import { formatPaceMinPerKm, getActivityTypeLabel } from "../utils";

export default function SportList() {
	const navigate = useNavigate();
	const location = useLocation();

	const { data: activities } = useSuspenseQuery(allActivitiesQuery());

	return (
		<>
			<table className="list activities alternate">
				<thead>
					<tr>
						<th>#</th>
						<th>Date</th>
						<th>Nom</th>
						<th>Type</th>
						<th>Distance</th>
						<th>Temps</th>
						<th>Allure</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{activities.length === 0 && (
						<tr>
							<td colSpan={8}>Aucune activité.</td>
						</tr>
					)}
					{activities.map((activity, i) => (
						<tr key={activity.id}>
							<td>{i + 1}</td>
							<td>{formatFullDate(activity.date)}</td>
							<td>
								<Link to="/sport/$activityId" params={{ activityId: activity.id }}>
									{activity.name}
								</Link>
							</td>
							<td>{getActivityTypeLabel(activity.type)}</td>
							<td>{activity.details.distance} km</td>
							<td>{getDurationString(activity.details.totalDuration)}</td>
							<td>{formatPaceMinPerKm(activity.details.pace)} /km</td>
							<td>
								<button
									type="button"
									title="Modifier"
									onClick={() =>
										navigate({
											to: "/sport/list/edit/$activityId",
											params: { activityId: activity.id },
											search: { returnTo: location.pathname },
											replace: true,
											resetScroll: false,
											mask: { to: "/sport/list" },
										})
									}
								>
									<i className="fa-regular fa-pen-to-square"></i>
								</button>
								&nbsp;
								<button
									type="button"
									title="Supprimer"
									onClick={() =>
										navigate({
											to: "/sport/list/delete/$activityId",
											params: { activityId: activity.id },
											search: { returnTo: location.pathname },
											replace: true,
											resetScroll: false,
											mask: { to: "/sport/list" },
										})
									}
								>
									<i className="fa-regular fa-trash-can"></i>
								</button>
							</td>
						</tr>
					))}
				</tbody>
				<tfoot>
					<tr>
						<td colSpan={8}></td>
					</tr>
				</tfoot>
			</table>

			<div className="fab-container">
				<button
					type="button"
					className="fab-main"
					title="Ajouter une activité"
					onClick={() =>
						navigate({
							to: "/sport/list/add",
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: { to: "/sport/list" },
						})
					}
				>
					<div className="pulse"></div>
					<div className="heart-line" aria-hidden="true">
						<i className="fa-solid fa-plus"></i>
					</div>
				</button>
			</div>

			<Outlet />
		</>
	);
}
