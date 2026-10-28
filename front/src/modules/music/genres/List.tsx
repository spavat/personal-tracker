import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { genresQuery } from "../api";

export default function GenresList() {
	const navigate = useNavigate();
	const location = useLocation();

	const { data: musicGenres } = useSuspenseQuery(genresQuery());

	return (
		<>
			<table className="list alternate">
				<thead>
					<tr>
						<th>Genre principal</th>
						<th>Genres</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{musicGenres.length === 0 && (
						<tr>
							<td colSpan={3}>Aucun genre.</td>
						</tr>
					)}
					{musicGenres.map((musicGenre) => (
						<tr key={musicGenre.id}>
							<td>{musicGenre.name}</td>
							<td>
								{musicGenre.genres.map((genre) => (
									<span key={genre} className="badge">
										{genre}
									</span>
								))}
							</td>
							<td>
								<button
									type="button"
									title="Modifier"
									onClick={() =>
										navigate({
											to: "/music/genres/edit/$id",
											params: { id: musicGenre.id },
											search: { returnTo: location.pathname },
											replace: true,
											resetScroll: false,
											mask: { to: "/music/genres" },
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
											to: "/music/genres/delete/$id",
											params: { id: musicGenre.id },
											search: { returnTo: location.pathname },
											replace: true,
											resetScroll: false,
											mask: { to: "/music/genres" },
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
					title="Ajouter un genre principal"
					onClick={() =>
						navigate({
							to: "/music/genres/add",
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: { to: "/music/genres" },
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
