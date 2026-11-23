import * as z from "zod";

import type { Program } from "./broadcast.schema";
import type { Game, GameWithOverview } from "./game.schema";
import type { BookOverview } from "./reading-book.schema";
import type { MangaOverview } from "./reading-manga.schema";
import type { PerformanceView } from "./show.schema";

//
// GET LATEST
//
// Response
export const LatestListeningSchema = z.object({
	id: z.string(),
	artist: z.array(z.string()),
	album: z.string(),
	date: z.iso.date(),
});

// The cards of the home are the ones of each module: each item keeps its module's shape (not validated here, so
// that an old document does not break the whole home)
export const GetLatestResponseSchema = z.object({
	// with their plays
	game: z.array(z.custom<GameWithOverview & Pick<Game, "plays">>()),
	show: z.array(z.custom<PerformanceView>()),
	music: z.array(LatestListeningSchema),
	// the programs of the latest episodes, each with only those episodes
	broadcast: z.array(z.custom<Program>()),
	"reading-manga": z.array(z.custom<MangaOverview>()),
	"reading-book": z.array(z.custom<BookOverview>()),
});
export type GetLatestResponse = z.infer<typeof GetLatestResponseSchema>;
