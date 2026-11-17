import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { categoriesQuery } from "../api";

export default function CategoriesList() {
	const navigate = useNavigate();
	const location = useLocation();

	const { data: categories } = useSuspenseQuery(categoriesQuery());

	const nameById = new Map(categories.map((category) => [category.id, category.name]));

	return (
		<>
			<table className="list alternate responsive">
				<thead>
					<tr>
						<th className="cell-index"></th>
						<th className="cell-text">Nom</th>
						<th className="cell-text">Catégorie parente</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{categories.length === 0 && (
						<tr>
							<td colSpan={4}>Aucune catégorie.</td>
						</tr>
					)}
					{categories.map((category, i) => (
						<tr key={category.id}>
							<td className="cell-index">{i + 1}</td>
							<td className="cell-text">{category.name}</td>
							<td className="cell-text" data-label="Catégorie parente">
								{category.parentId ? (nameById.get(category.parentId) ?? "—") : "—"}
							</td>
							<td data-label="Actions">
								<button
									type="button"
									title="Modifier"
									onClick={() =>
										navigate({
											to: "/lifespan/categories/edit/$id",
											params: { id: category.id },
											search: { returnTo: location.pathname },
											replace: true,
											resetScroll: false,
											mask: { to: "/lifespan/categories" },
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
											to: "/lifespan/categories/delete/$id",
											params: { id: category.id },
											search: { returnTo: location.pathname },
											replace: true,
											resetScroll: false,
											mask: { to: "/lifespan/categories" },
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
					title="Ajouter une catégorie"
					onClick={() =>
						navigate({
							to: "/lifespan/categories/add",
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: { to: "/lifespan/categories" },
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
