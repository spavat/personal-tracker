import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import PageTitle from "../../../components/PageTitle";
import { useIsOwner } from "../../../hooks/use-is-owner";
import { entityDetailsQuery } from "../api";
import EntityPortrait from "../components/EntityPortrait";
import { KIND_LABELS, MODULE_NAME } from "../constants";
import BooksSection from "../sections/BooksSection";
import BroadcastSection from "../sections/BroadcastSection";
import ShowSection from "../sections/ShowSection";
import { creditCounts } from "../utils";

// An entity and its credits in every module, one section per module crediting it
export default function EntityDetails({ entityId }: { entityId: string }) {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();
	const { data: entity } = useSuspenseQuery(entityDetailsQuery(entityId));

	return (
		<>
			<PageTitle title={`${MODULE_NAME} > ${entity.name}`} />
			{/* same layout and classes as the show artist page */}
			<div className="presentation-with-picture">
				<div className="picture">
					<EntityPortrait entity={entity} className="artist-picture" />
				</div>
				<div className="general">
					<div className="title">
						<h2>
							{entity.name}
							{isOwner && (
								<button
									type="button"
									title="Modifier"
									onClick={() =>
										navigate({
											to: "/entities/$entityId/edit",
											params: { entityId },
											search: { returnTo: location.pathname },
											replace: true,
											resetScroll: false,
											mask: { to: "/entities/$entityId", params: { entityId } },
										})
									}
								>
									<i className="fa-regular fa-pen-to-square"></i>
								</button>
							)}
						</h2>
					</div>
					<span className="subtitle">
						{KIND_LABELS[entity.kind]}
						{entity.sortName && <> · {entity.sortName}</>}
					</span>
					{creditCounts(entity).map(({ field, icon, count, label }) => (
						<div key={field}>
							<i className={`fa-solid ${icon}`}></i> <strong>{count}</strong> {label}
						</div>
					))}
				</div>
			</div>

			{entity.show.spectacles > 0 && <ShowSection entityId={entityId} />}
			{entity.book.books > 0 && <BooksSection entityId={entityId} />}
			{entity.program.programs + entity.episode.episodes > 0 && <BroadcastSection entityId={entityId} />}

			<Outlet />
		</>
	);
}
