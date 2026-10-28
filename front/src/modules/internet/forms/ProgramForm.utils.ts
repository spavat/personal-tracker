import { RefIdsEnum, RefIdsEnumSchema, Refs, SaveBodyRequestType } from "@personal-tracker/shared/internet";

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
		author?: string;
		network?: string;
		links?: Array<Item>;
		country?: string;
		tags?: Array<Item>;
		refs?: Array<ItemRef>;
		description?: string;
		type?: string;
		profile?: string;
		banner?: string;
	};
}

export const onSubmitProgram = (data: ProgramInputs): SaveBodyRequestType["program"] => {
	const { tags, links, refs, ...othersProps } = data.program;
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
		// ...(refs ? { refs: refs.reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {}) } : {}),
	};
};
