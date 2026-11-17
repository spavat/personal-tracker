import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Fragment, Suspense, useState } from "react";

import { PendingContent } from "../../../components/PendingContent";
import { useSortTable } from "../../../hooks/use-sort-table";
import { formatFullDate } from "../../../utils";
import { categoriesQuery, objectDetailsQuery, objectListSort } from "../api";
import { DISPOSE_CAUSE_LABELS, EVENT_TYPE_LABELS, POSSESSION_STATUS_LABELS, USAGE_STATUS_LABELS } from "../labels";

export default function ObjectsList() {
	const navigate = useNavigate();
	const location = useLocation();
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const { data: categories } = useSuspenseQuery(categoriesQuery());
	const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

	const { query, headers, isPending } = useSortTable({
		...objectListSort,
		columnsList: [
			{ name: "", isSortable: false, className: "cell-index" },
			{ name: " ", isSortable: false, className: "cell-icon" },
			{ name: "Nom", colName: "name", isSortable: true, className: "cell-text" },
			{ name: "Catégorie", colName: "categoryId", isSortable: false, className: "cell-text" },
			{ name: "Type", colName: "type", isSortable: true, className: "cell-text" },
			{ name: "Statut", colName: "usageStatus", isSortable: true, className: "cell-text" },
			{ name: "Possession", colName: "possessionStatus", isSortable: true, className: "cell-text" },
			{ name: "Actions", colName: "", isSortable: false },
		],
	});

	return (
		<>
			<PendingContent isPending={isPending}>
				<table className="list objects alternate responsive">
					<thead>
						<tr>{headers.map((h) => h)}</tr>
					</thead>
					<tbody>
						{query.data.map((object, i) => (
							<Fragment key={object.id}>
								<tr>
									<td className="cell-index">{i + 1}</td>
									<td className="cell-icon">
										<button
											type="button"
											aria-label="Afficher les évènements"
											onClick={() => setExpandedId(expandedId === object.id ? null : object.id)}
										>
											<i
												className={`fa-solid ${expandedId === object.id ? "fa-chevron-down" : "fa-chevron-right"}`}
											></i>
										</button>
									</td>
									<td className="cell-text">
										{object.name}
										{object.description && <div className="description">{object.description}</div>}
									</td>
									<td className="cell-text" data-label="Catégorie">
										{categoryNameById.get(object.categoryId) ?? "—"}
									</td>
									<td className="cell-text" data-label="Type">
										{object.type || "—"}
									</td>
									<td className="cell-text" data-label="Statut">
										{USAGE_STATUS_LABELS[object.usageStatus]}
									</td>
									<td className="cell-text" data-label="Possession">
										{POSSESSION_STATUS_LABELS[object.possessionStatus]}
									</td>
									<td data-label="Actions">
										{/* <button
										type="button"
										title="Ajouter"
										onClick={() =>
											navigate({
												to: "/lifespan/list/$objectId/event/add",
												params: { objectId: object.id },
												search: { returnTo: location.pathname },
												replace: true,
												resetScroll: false,
												mask: { to: "/lifespan/list" },
											})
										}
									>
										<i className="fa-regular fa-calendar-plus"></i>
									</button>
									&nbsp; */}
										<button
											type="button"
											title="Modifier"
											onClick={() =>
												navigate({
													to: "/lifespan/list/$objectId/edit",
													params: { objectId: object.id },
													search: { returnTo: location.pathname },
													replace: true,
													resetScroll: false,
													mask: { to: "/lifespan/list" },
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
													to: "/lifespan/list/$objectId/delete",
													params: { objectId: object.id },
													search: { returnTo: location.pathname },
													replace: true,
													resetScroll: false,
													mask: { to: "/lifespan/list" },
												})
											}
										>
											<i className="fa-regular fa-trash-can"></i>
										</button>
									</td>
								</tr>
								{expandedId === object.id && (
									<tr>
										<td colSpan={8}>
											{/* local boundary: only the expanded row waits for the events */}
											<Suspense fallback={<p>Chargement…</p>}>
												<ObjectEvents objectId={object.id} returnTo={location.pathname} />
											</Suspense>
										</td>
									</tr>
								)}
							</Fragment>
						))}
					</tbody>
				</table>
			</PendingContent>

			<div className="fab-container">
				<button
					type="button"
					className="fab-main"
					title="Ajouter un objet"
					onClick={() =>
						navigate({
							to: "/lifespan/list/add",
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: { to: "/lifespan/list" },
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

function ObjectEvents({ objectId, returnTo }: { objectId: string; returnTo: string }) {
	const navigate = useNavigate();
	const { data: object } = useSuspenseQuery(objectDetailsQuery(objectId));

	if (!object.events.length) {
		return <p>Aucun évènement.</p>;
	}

	return (
		<ul className="events">
			{object.events.map((event) => (
				<li key={event.id}>
					<b className="event-type">{EVENT_TYPE_LABELS[event.type]}</b> (
					<span className="event-date">{formatFullDate(event.date)}</span>){" "}
					<span className="event-details">
						{event.cause && <span className="badge">{DISPOSE_CAUSE_LABELS[event.cause]}</span>}
						{event.comment}
					</span>{" "}
					<button
						type="button"
						title="Modifier"
						onClick={() =>
							navigate({
								to: "/lifespan/list/$objectId/event/$eventId/edit",
								params: { objectId, eventId: event.id },
								search: { returnTo },
								replace: true,
								resetScroll: false,
								mask: { to: "/lifespan/list" },
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
								to: "/lifespan/list/$objectId/event/$eventId/delete",
								params: { objectId, eventId: event.id },
								search: { returnTo },
								replace: true,
								resetScroll: false,
								mask: { to: "/lifespan/list" },
							})
						}
					>
						<i className="fa-regular fa-trash-can"></i>
					</button>
				</li>
			))}
		</ul>
	);
}
