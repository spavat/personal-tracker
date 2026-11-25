import {
	RefIdsEnum,
	RefIdsEnumSchema,
	Refs,
	SaveBodyRequestType,
	type Tracking,
} from "@personal-tracker/shared/broadcast";

import { type CreditInput, type CreditRole, toSaveCredits } from "./CreditRows";

interface Item {
	value: string;
}
interface ItemRef {
	key: RefIdsEnum | ""; // Allow empty value when add an empty refs
	value: string;
}

export interface ProgramInputs {
	program: {
		id?: string;
		name: string;
		shortName?: string;
		credits?: Array<CreditInput>;
		links?: Array<Item>;
		country?: string;
		tags?: Array<Item>;
		refs?: Array<ItemRef>;
		description?: string;
		private?: boolean;
		type?: string;
		tracking?: Tracking;
		profile?: string;
		banner?: string;
	};
}

export const onSubmitProgram = (data: ProgramInputs): SaveBodyRequestType["program"] => {
	const { tags, links, refs, credits, ...othersProps } = data.program;
	if (refs) {
		(othersProps as any).refs = refs.reduce((acc: Refs, r) => {
			const pa = RefIdsEnumSchema.safeParse(r.key);
			if (pa.success && r.key !== "") {
				acc[r.key] = r.value;
			}
			return acc;
		}, {});
	}
	return {
		...othersProps,
		tags: (tags ?? []).map((t) => t.value),
		links: (links ?? []).map((l) => l.value),
		// a form without the credit rows keeps the program's credits
		...(credits ? { credits: toSaveCredits(credits) as SaveBodyRequestType["program"]["credits"] } : {}),
		// ...(refs ? { refs: refs.reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {}) } : {}),
	};
};

export const PROGRAM_CREDIT_ROLES: Array<CreditRole> = [
	{ value: "host", label: "Animation", kind: "person" },
	{ value: "producer", label: "Production", kind: "organization" },
	{ value: "network", label: "Réseau", kind: "organization" },
];
