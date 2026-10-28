import { createFileRoute } from "@tanstack/react-router";

import { yearQuery } from "../../../hooks/use-year-changer";
import MoneyAnnualRecap from "../../../modules/money/AnnualRecap";
import { annualRecap } from "../../../modules/money/api";

export const Route = createFileRoute("/money/reports/$year")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...yearQuery(annualRecap(true), params.year), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { year } = Route.useParams();
	return <MoneyAnnualRecap year={year} />;
}
