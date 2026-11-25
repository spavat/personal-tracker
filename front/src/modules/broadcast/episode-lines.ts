import type {
	CreateEpisodeBodyRequestType,
	Episode,
	EpisodeLine,
	SaveEpisodeBodyRequestType,
	SaveViewBodyRequestType,
} from "@personal-tracker/shared/broadcast";

const byLatest = (a: EpisodeLine, b: EpisodeLine) =>
	b.date === a.date ? (b.created ?? "").localeCompare(a.created ?? "") : b.date.localeCompare(a.date);

// One line per view, with its episode's fields: what the lists show and the forms edit. Latest first, or oldest
// first with "asc".
export function toLines(episodes: Array<Episode>, order: "asc" | "desc" = "desc"): Array<EpisodeLine> {
	const lines = episodes.flatMap(({ views, ...episode }) =>
		views.map(({ id, duration, ...view }) => ({
			...episode,
			...view,
			id,
			episodeId: episode.id,
			...(duration !== undefined && { durationReal: duration }),
		})),
	);
	return lines.toSorted((a, b) => (order === "desc" ? byLatest(a, b) : byLatest(b, a)));
}

type LineFields = Omit<EpisodeLine, "id" | "episodeId" | "created">;

// The episode's part of a line (shared by its views) / the view's part, as the API saves them
export function toEpisodeBody({
	name,
	shortName,
	duration,
	type,
	releaseDate,
	link,
	tags,
	ignoredTags,
	externalId,
	seasonId,
	formatId,
	position,
	numberLabel,
	description,
	cover,
	credits,
}: LineFields): SaveEpisodeBodyRequestType {
	return {
		name,
		shortName,
		duration,
		type,
		releaseDate: releaseDate || undefined,
		link,
		tags,
		ignoredTags,
		externalId,
		// a select left on "none" sends ""
		seasonId: seasonId || undefined,
		formatId: formatId || undefined,
		position,
		numberLabel: numberLabel || undefined,
		description: description?.trim() || undefined,
		// left out: no cover (a new view of a stored episode keeps its own)
		cover: cover || undefined,
		credits: (credits ?? []).map(({ entityId, role, creditedAs }) => ({ entityId, role, creditedAs })),
	};
}
export function toViewBody({ date, durationReal, contextTags, comment }: LineFields): SaveViewBodyRequestType {
	return { date, ...(durationReal ? { duration: durationReal } : {}), contextTags, comment };
}
export function toCreateEpisodeBody(line: LineFields): CreateEpisodeBodyRequestType {
	return { ...toEpisodeBody(line), view: toViewBody(line) };
}
