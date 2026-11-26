import type { EntityKind } from "@personal-tracker/shared/entity";

import { CreditInput } from "./CreditRows";

// The rows as the API saves them: the rows without entity left out
export function toSaveCredits(rows: Array<CreditInput> | undefined) {
	return (rows ?? [])
		.filter(({ entityId }) => entityId)
		.map(({ entityId, role, creditedAs }) => ({ entityId, role, creditedAs: creditedAs.trim() || null }));
}

// The credits of a program / an episode as rows
export function toCreditInputs(
	credits: Array<{ entityId: string; kind: EntityKind; role: string; creditedAs: string | null }> | undefined,
): Array<CreditInput> {
	return (credits ?? []).map(({ entityId, kind, role, creditedAs }) => ({
		entityId,
		kind,
		role,
		creditedAs: creditedAs ?? "",
	}));
}
