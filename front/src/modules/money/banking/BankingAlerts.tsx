import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { bankConnectionsQuery, bankInboxCountQuery } from "../api";
import { connectionBadge, connectionsNeedingAttention } from "./banking-status";

/** Messages on the money overview: bank lines to validate, connections to renew or fix */
export default function BankingAlerts() {
	// not suspense: the overview must render even when the bank sync is not configured
	const { data: inbox } = useQuery(bankInboxCountQuery());
	const { data: connections } = useQuery(bankConnectionsQuery());
	const attention = connectionsNeedingAttention(connections ?? []);

	if (!inbox?.count && attention.length === 0) return null;
	return (
		<div className="banking-alerts">
			{Boolean(inbox?.count) && (
				<p>
					<i className="fa-solid fa-inbox"></i>{" "}
					<Link to="/money/banking/inbox">{inbox!.count} opération(s) bancaire(s) à valider</Link>
				</p>
			)}
			{attention.map((connection) => (
				<p key={connection.id} className={connectionBadge(connection).className}>
					<i className="fa-solid fa-triangle-exclamation"></i>{" "}
					<Link to="/money/banking/connections">
						{connection.aspspName} : {connectionBadge(connection).label}
					</Link>
				</p>
			))}
		</div>
	);
}
