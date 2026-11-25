import { creditName } from "@personal-tracker/shared/broadcast";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

// Each credited entity's name, linked to its directory page, joined by " & " (as the program's author / network)
export default function CreditLinks({
	credits,
}: {
	credits: Array<{ entityId: string; name: string; creditedAs: string | null }>;
}) {
	return credits.map((credit, index) => (
		<Fragment key={credit.entityId}>
			{index > 0 && " & "}
			<Link to="/entities/$entityId" params={{ entityId: credit.entityId }}>
				{creditName(credit)}
			</Link>
		</Fragment>
	));
}
