import { GameSchema } from "@personal-tracker/shared/game";
import { z } from "zod";

export const GameFormSchema = GameSchema.omit({ plays: true }).partial({ id: true });

type FormData = z.input<typeof GameFormSchema>;
export interface GameInputs {
	game?: FormData;
}

export const onSubmitGame = (data: GameInputs) => {
	return GameFormSchema.parse(data.game);
};
