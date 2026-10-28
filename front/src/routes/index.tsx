import { createFileRoute } from "@tanstack/react-router";

import MainDashboard from "../dashboard/MainDashboard";
import PublicHome from "../dashboard/PublicHome";
import { useIsOwner } from "../hooks/use-is-owner";

export const Route = createFileRoute("/")({
	component: Home,
});

function Home() {
	return useIsOwner() ? <MainDashboard /> : <PublicHome />;
}
