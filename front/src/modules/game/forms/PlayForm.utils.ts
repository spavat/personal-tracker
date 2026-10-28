import { GamePlaySchema } from "@personal-tracker/shared/game";
import z from "zod";

export const GamePlayFormSchema = GamePlaySchema.partial({ id: true }).extend({});

type FormData = z.infer<typeof GamePlayFormSchema>;
export interface PlayInputs {
	play: FormData;
}

export const onSubmitPlay = (data: PlayInputs) => {
	return {
		...data.play,
	};
};
