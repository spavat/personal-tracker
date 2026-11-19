import type { ContextTag } from "@personal-tracker/shared/context-tag";

import { randomUUID } from "crypto";

export type { ContextTag };

export function buildContextTag(input: Omit<ContextTag, "id">): ContextTag {
	return { id: randomUUID(), ...input };
}
