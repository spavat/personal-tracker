import { Game, GameSchema } from "@personal-tracker/shared/game";
import { z } from "zod";

type StoreIds = NonNullable<Game["storeIds"]>;
export type StoreIdKey = keyof StoreIds;

export const STORE_ID_LABELS: Record<StoreIdKey, string> = {
	steam: "Steam (appid)",
	gog: "GOG",
	epic: "Epic",
	battleNet: "Battle.net",
	ubisoftConnect: "Ubisoft Connect",
};

// storeIds is edited as a list of { key, value } rows (most games are owned on a single store)
export const GameFormSchema = GameSchema.omit({ plays: true, storeIds: true })
	.partial({ id: true })
	.extend({
		storeIds: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
	});

type FormData = z.input<typeof GameFormSchema>;
export interface GameInputs {
	game?: FormData;
}

export const toStoreIdRows = (storeIds: Game["storeIds"]) =>
	Object.entries(storeIds ?? {}).map(([key, value]) => ({ key, value: value ?? "" }));

export const onSubmitGame = (data: GameInputs) => {
	const { storeIds, ...game } = GameFormSchema.parse(data.game);
	return {
		...game,
		storeIds: (storeIds ?? []).reduce((acc: StoreIds, { key, value }) => {
			if (key in STORE_ID_LABELS && value.trim()) {
				acc[key as StoreIdKey] = value.trim();
			}
			return acc;
		}, {}),
	};
};
