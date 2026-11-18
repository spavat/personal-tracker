import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { useIsOwner } from "../../../hooks/use-is-owner";
import { seriesListQuery } from "../api";

export default function SeriesList() {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();
	const { data: series } = useSuspenseQuery(seriesListQuery());

	return (
		<>
			<h2>Séries</h2>
			<table className="list series alternate responsive">
				<thead>
					<tr>
						<th className="cell-index"></th>
						<th className="cell-text">Série</th>
						<th className="cell-number">Livres</th>
					</tr>
				</thead>
				<tbody>
					{series.map((item, i) => (
						<tr key={item.id}>
							<td className="cell-index">{i + 1}</td>
							<td className="cell-text">
								<Link to="/reading-book/series/$seriesId" params={{ seriesId: item.id }}>
									{item.title}
								</Link>
								{item.parents.length > 0 && (
									<span className="smalltext">
										{" "}
										· dans {item.parents.map(({ title }) => title).join(", ")}
									</span>
								)}
							</td>
							<td className="cell-number" data-label="Livres">
								{item.nbBooks}
							</td>
						</tr>
					))}
				</tbody>
			</table>
			{isOwner && (
				<div className="fab-container">
					<button
						type="button"
						className="fab-main"
						title="Ajouter une série"
						onClick={() =>
							navigate({
								to: "/reading-book/series/add",
								search: { returnTo: location.pathname },
								replace: true,
								resetScroll: false,
								mask: { to: "/reading-book/series" },
							})
						}
					>
						<div className="pulse"></div>
						<div className="heart-line">
							<i className="fa-solid fa-plus"></i>
						</div>
					</button>
				</div>
			)}
			<Outlet />
		</>
	);
}
