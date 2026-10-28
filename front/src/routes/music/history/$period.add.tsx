import { MusicListeningSchema } from "@personal-tracker/shared/music";
import { createFileRoute } from "@tanstack/react-router";

import AddListeningModalForm from "../../../modules/music/modal/AddListeningModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/music/history/$period/add")({
	validateSearch: withReturnToSchema.extend({
		copyObject: MusicListeningSchema.omit({ id: true }).optional(),
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo, copyObject } = Route.useSearch();
	return <AddListeningModalForm returnTo={returnTo} copyObject={copyObject} />;
}
