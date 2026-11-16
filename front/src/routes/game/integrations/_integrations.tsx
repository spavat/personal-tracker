import { createFileRoute } from "@tanstack/react-router";

import { syncStatusQuery } from "../../../modules/game/api";
import Integrations from "../../../modules/game/pages/Integrations";

export const Route = createFileRoute("/game/integrations/_integrations")({
	loader: ({ context }) => context.queryClient.query({ ...syncStatusQuery(), staleTime: "static" }),
	component: Integrations,
});
