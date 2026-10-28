import { createFileRoute } from "@tanstack/react-router";

import AppMoney from "../modules/money";

export const Route = createFileRoute("/money")({
	component: AppMoney,
});
