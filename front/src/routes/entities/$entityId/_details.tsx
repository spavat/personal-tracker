import { createFileRoute } from "@tanstack/react-router";

import { readStoredValue } from "../../../hooks/stored-value";
import { entityBroadcastQuery } from "../../../modules/broadcast/api";
import { entityDetailsQuery } from "../../../modules/entities/api";
import { GROUP_BY_SPECTACLE_KEY } from "../../../modules/entities/constants";
import EntityDetails from "../../../modules/entities/pages/EntityDetails";
import { entityBooksQuery } from "../../../modules/reading-book/api";
import { artistDetailsQuery } from "../../../modules/show/api";

export const Route = createFileRoute("/entities/$entityId/_details")({
	// the counts tell which module sections the page shows: only their data is loaded
	loader: async ({ context: { queryClient }, params: { entityId } }) => {
		const entity = await queryClient.query({ ...entityDetailsQuery(entityId), staleTime: "static" });
		const groupBySpectacle = readStoredValue(GROUP_BY_SPECTACLE_KEY, false);
		await Promise.all([
			entity.show.spectacles > 0 &&
				queryClient.query({ ...artistDetailsQuery(entityId, groupBySpectacle), staleTime: "static" }),
			entity.book.books > 0 && queryClient.query({ ...entityBooksQuery(entityId), staleTime: "static" }),
			entity.program.programs + entity.episode.episodes > 0 &&
				queryClient.query({ ...entityBroadcastQuery(entityId), staleTime: "static" }),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { entityId } = Route.useParams();
	return <EntityDetails entityId={entityId} />;
}
