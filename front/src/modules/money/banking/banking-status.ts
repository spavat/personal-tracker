const EXPIRY_WARNING_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

export function daysBeforeExpiry(connection: Money.BankConnection) {
	if (!connection.validUntil) return null;
	return Math.ceil((new Date(connection.validUntil).getTime() - Date.now()) / DAY);
}

export function connectionBadge(connection: Money.BankConnection): { label: string; className: string } {
	switch (connection.status) {
		case "pending":
			return { label: "En attente d'autorisation", className: "warning" };
		case "expired":
			return { label: "Expirée", className: "danger" };
		case "revoked":
			return { label: "Révoquée", className: "danger" };
		case "error":
			return { label: "En erreur", className: "danger" };
	}
	const days = daysBeforeExpiry(connection);
	if (days !== null && days <= EXPIRY_WARNING_DAYS) {
		return { label: `Expire dans ${days} j`, className: "warning" };
	}
	return { label: "En ligne", className: "ok" };
}

/** connections that need the user: expiring soon, expired, revoked, in error or never authorized */
export function connectionsNeedingAttention(connections: Array<Money.BankConnection>) {
	return connections.filter((c) => connectionBadge(c).className !== "ok");
}
