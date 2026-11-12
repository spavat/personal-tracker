import { createFileRoute } from "@tanstack/react-router";
import z from "zod";

import BankCallback from "../../../modules/money/banking/BankCallback";

// the bank (through Enable Banking) sends the browser back here: ?code&state, or ?error&error_description
export const Route = createFileRoute("/money/banking/callback")({
	validateSearch: z.object({
		code: z.string().optional(),
		state: z.string().optional(),
		error: z.string().optional(),
		error_description: z.string().optional(),
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const { code, state, error, error_description } = Route.useSearch();
	return <BankCallback code={code} state={state} error={error} errorDescription={error_description} />;
}
