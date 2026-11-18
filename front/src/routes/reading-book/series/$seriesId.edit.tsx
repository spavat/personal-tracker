import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { seriesDetailsQuery } from "../../../modules/reading-book/api";
import SeriesForm from "../../../modules/reading-book/forms/SeriesForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/reading-book/series/$seriesId/edit")({
	staticData: { modal: true },
	loader: ({ context, params }) =>
		context.queryClient.query({ ...seriesDetailsQuery(params.seriesId), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { seriesId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <SeriesForm seriesId={seriesId} returnTo={returnTo} />;
}
