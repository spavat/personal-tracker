import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import Badge from "../../../components/badge";
import { categoriesQuery } from "../api";

export default function CategoryList() {
	const navigate = useNavigate();
	const location = useLocation();

	const { data: categories } = useSuspenseQuery(categoriesQuery());

	return (
		<>
			<h2>Liste des catégories ({categories.length})</h2>
			<table className="list categories alternate">
				<thead>
					<tr>
						<th></th>
						<th>Nom</th>
						<th>Icone</th>
						<th>Couleur du fond</th>
						<th>Couleur du texte</th>
						<th>Affichage</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{categories.map((category, i) => (
						<tr key={category.id}>
							<td className="smalltext">#{i + 1}</td>
							<td>
								<Link
									to="/money/transactions/$type/$id"
									params={{ type: "category", id: String(category.id) }}
								>
									{category.name}
								</Link>
							</td>
							<td>
								<i className={category.icon} /> {category.icon}
							</td>
							<td>
								<input
									type="color"
									value={category.backgroundColor}
									disabled
									aria-label="Couleur du fond"
								/>
							</td>
							<td>
								<input type="color" value={category.textColor} disabled aria-label="Couleur du texte" />
							</td>
							<td>
								<Badge
									key={category.id}
									name={category.name}
									icon={category.icon}
									backgroundColor={category.backgroundColor}
									color={category.textColor}
								/>
							</td>
							<td>
								<button
									type="button"
									title="Modifier"
									onClick={() =>
										navigate({
											to: "/money/categories/$categoryId/edit",
											params: { categoryId: String(category.id) },
											search: { returnTo: location.pathname },
											replace: true,
											resetScroll: false,
											mask: { to: "/money/categories" },
										})
									}
								>
									<i className="fa-regular fa-pen-to-square"></i>
								</button>
								<button
									type="button"
									title="Supprimer"
									onClick={() =>
										navigate({
											to: "/money/categories/$categoryId/delete",
											params: { categoryId: String(category.id) },
											search: { returnTo: location.pathname },
											replace: true,
											resetScroll: false,
											mask: { to: "/money/categories" },
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
							to: "/money/categories/add",
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: { to: "/money/categories" },
						})
					}
				>
					<div className="pulse"></div>
					<div className="heart-line">
						<i className="fa-solid fa-plus"></i>
					</div>
				</button>
			</div>
			<Outlet />
		</>
	);
}
