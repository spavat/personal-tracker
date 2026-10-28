import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { contextTagsQuery } from "./api";

export default function ContextTagsList() {
	const navigate = useNavigate();
	const location = useLocation();

	const { data: contextTags } = useSuspenseQuery(contextTagsQuery());

	return (
		<>
			<table className="list alternate">
				<thead>
					<tr>
						<th>Tag principal</th>
						<th>Tags</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{contextTags.length === 0 && (
						<tr>
							<td colSpan={3}>Aucun tag.</td>
						</tr>
					)}
					{contextTags.map((contextTag) => (
						<tr key={contextTag.id}>
							<td>{contextTag.name}</td>
							<td>
								{contextTag.tags.map((tag) => (
									<span key={tag} className="badge">
										{tag}
									</span>
								))}
							</td>
							<td>
								<button
									type="button"
									title="Modifier"
									onClick={() =>
										navigate({
											to: "/context-tags/edit/$id",
											params: { id: contextTag.id },
											search: { returnTo: location.pathname },
											replace: true,
											resetScroll: false,
											mask: { to: "/context-tags" },
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
											to: "/context-tags/delete/$id",
											params: { id: contextTag.id },
											search: { returnTo: location.pathname },
											replace: true,
											resetScroll: false,
											mask: { to: "/context-tags" },
										})
									}
								>
									<i className="fa-regular fa-trash-can"></i>
								</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>

			<div className="fab-container">
				<button
					type="button"
					className="fab-main"
					aria-label="Ajouter un tag principal"
					onClick={() =>
						navigate({
							to: "/context-tags/add",
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: { to: "/context-tags" },
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
