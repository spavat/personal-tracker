import { GameStoreSchema } from "@personal-tracker/shared/game";
import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { importPreviewQuery } from "../../../modules/game/api";
import ImportPreviewModal from "../../../modules/game/modals/ImportPreviewModal";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/game/integrations/_integrations/import/$store")({
	staticData: { modal: true },
	params: { parse: ({ store }) => ({ store: GameStoreSchema.parse(store) }) },
	// the preview fetches the store: never served from the cache
	loader: ({ context, params }) => context.queryClient.fetchQuery(importPreviewQuery(params.store)),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { store } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <ImportPreviewModal store={store} returnTo={returnTo} />;
}
