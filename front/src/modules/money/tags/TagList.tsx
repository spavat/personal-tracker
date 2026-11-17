import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import Badge from "../../../components/Badge";
import { tagsQuery } from "../api";

export default function TagList() {
	const navigate = useNavigate();
	const location = useLocation();

	const { data: tagsList } = useSuspenseQuery(tagsQuery());

	return (
		<>
			<h2>Liste des tags ({tagsList.length})</h2>
			<table className="list tags alternate">
				<thead>
					<tr>
						<th className="cell-index"></th>
						<th className="cell-text">Nom</th>
						<th className="cell-text">Icone</th>
						<th className="cell-icon">Couleur du fond</th>
						<th className="cell-icon">Couleur du texte</th>
						<th className="cell-text">Affichage</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{tagsList.map((tag, i) => (
						<tr key={tag.id}>
							<td className="cell-index">{i + 1}</td>
							<td className="cell-text">
								<Link to="/money/transactions/$type/$id" params={{ type: "tag", id: String(tag.id) }}>
									{tag.name}
								</Link>
							</td>
							<td className="cell-text">
								<i className={tag.icon} /> {tag.icon}
							</td>
							<td className="cell-icon">
								<input type="color" value={tag.backgroundColor} disabled aria-label="Couleur du fond" />
							</td>
							<td className="cell-icon">
								<input type="color" value={tag.textColor} disabled aria-label="Couleur du texte" />
							</td>
							<td className="cell-text">
								<Badge
									key={tag.id}
									name={tag.name}
									icon={tag.icon}
									backgroundColor={tag.backgroundColor}
									color={tag.textColor}
								/>
							</td>
							<td>
								<button
									type="button"
									title="Modifier"
									onClick={() =>
										navigate({
											to: "/money/tags/$tagId/edit",
											params: { tagId: String(tag.id) },
											search: { returnTo: location.pathname },
											replace: true,
											resetScroll: false,
											mask: { to: "/money/tags" },
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
											to: "/money/tags/$tagId/delete",
											params: { tagId: String(tag.id) },
											search: { returnTo: location.pathname },
											replace: true,
											resetScroll: false,
											mask: { to: "/money/tags" },
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

			<Outlet />

			<div className="fab-container">
				<button
					type="button"
					className="fab-main"
					title="Ajouter un tag"
					onClick={() =>
						navigate({
							to: "/money/tags/add",
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: { to: "/money/tags" },
						})
					}
				>
					<div className="pulse"></div>
					<div className="heart-line">
						<i className="fa-solid fa-plus"></i>
					</div>
				</button>
			</div>
		</>
	);
}
