// Mongo `broadcast` documents -> the rows of the Postgres `broadcast` schema (ticket 03 of
// .scratch/broadcast-postgres). Pure: the script migrate-broadcast.ts writes the rows.
import type { Episode, Program } from "@personal-tracker/shared/broadcast";

export interface ProgramRow {
	id: string;
	name: string;
	shortName: string | null;
	description: string | null;
	country: string | null;
	type: string | null;
	rss: string | null;
	youtubeChannelId: string | null;
	youtubePlaylistId: string | null;
	links: string[];
	profileKey: string | null;
	bannerKey: string | null;
	tags: string[];
	private: boolean;
}

export interface EpisodeRow {
	id: string;
	programId: string;
	name: string;
	shortName: string | null;
	type: string | null;
	duration: number | null;
	link: string | null;
	externalId: string | null;
	tags: string[];
	ignoredTags: string[];
}

export interface ViewRow {
	id: string;
	episodeId: string;
	date: string;
	duration: number | null;
	contextTags: string[];
	comment: string | null;
	createdAt: string;
}

// A program credit, by name: the script finds or creates the entity
export interface CreditRow {
	programId: string;
	name: string;
	kind: "person" | "group" | "organization";
	role: "host" | "producer" | "network";
	// position among the program's credits of this role
	order: number;
}

// Author names (after the "&&" split) that are not a person, or are spelled differently, in the dev data of
// 2026-11-23. An organization making the program is credited `producer`, not `host`.
export const AUTHOR_OVERRIDES: Record<string, { name?: string; kind: CreditRow["kind"] }> = {
	Acrimed: { kind: "organization" },
	AlphaCast: { kind: "organization" },
	"Amaury Sport Organisation": { kind: "organization" },
	Babymonster: { kind: "group" },
	"BBC Learning English": { kind: "organization" },
	Blast: { kind: "organization" },
	BonneGueule: { kind: "organization" },
	"Chistrine Lakin": { name: "Christine Lakin", kind: "person" },
	"Ecran Large": { kind: "organization" },
	"Mondes Sociaux": { kind: "organization" },
	"Monte le Son": { kind: "organization" },
	NRJ: { kind: "organization" },
	Origami: { name: "Origami Media", kind: "organization" },
	"RCS Sport": { kind: "organization" },
	StupidEco: { kind: "group" },
	UCI: { kind: "organization" },
	Unipublic: { kind: "organization" },
	WhatsOnStage: { kind: "organization" },
};

// The credits of an `author` string: its names separated by "&&", each a person unless overridden
function authorCredits(programId: string, author: string | undefined): CreditRow[] {
	return (author ?? "")
		.split("&&")
		.flatMap((part) => text(part) ?? [])
		.map((name) => {
			const override = AUTHOR_OVERRIDES[name];
			const kind = override?.kind ?? "person";
			return {
				programId,
				name: override?.name ?? name,
				kind,
				role: (kind === "organization" ? "producer" : "host") as CreditRow["role"],
			};
		})
		.map((credit, i, all) => ({
			...credit,
			order: all.slice(0, i).filter(({ role }) => role === credit.role).length,
		}));
}

// Episodes of a program sharing an externalId with different titles: not the same release, fixed by hand
export interface IdConflict {
	programName: string;
	externalId: string;
	episodes: Array<{ id: string; date: string; name: string }>;
}

export interface BroadcastRows {
	programs: ProgramRow[];
	credits: CreditRow[];
	episodes: EpisodeRow[];
	views: ViewRow[];
	// episodes listened to several times, merged into one episode
	merged: number;
	conflicts: IdConflict[];
}

// "" and whitespace mean nothing
function text(value: string | undefined | null) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

// Same title, case, accents and punctuation ignored ("Couv’" = "Couv'")
export function titleKey(title: string) {
	return title
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "");
}

const byListening = (a: Episode, b: Episode) =>
	a.date.localeCompare(b.date) || (a.created ?? "").localeCompare(b.created ?? "");

// One episode per release: the Mongo episodes of a program sharing an externalId are its listenings. The oldest
// gives the episode its id and fields, the tags of every listening are kept.
function groupListenings(program: Program) {
	const groups = new Map<string, Episode[]>();
	for (const episode of (program.episodes ?? []).toSorted(byListening)) {
		const key = text(episode.externalId) ?? `id:${episode.id}`;
		groups.set(key, [...(groups.get(key) ?? []), episode]);
	}
	return [...groups.values()];
}

export function toBroadcastRows(documents: Program[]): BroadcastRows {
	const rows: BroadcastRows = { programs: [], credits: [], episodes: [], views: [], merged: 0, conflicts: [] };

	for (const program of documents) {
		rows.programs.push({
			id: program.id,
			name: program.name,
			shortName: text(program.shortName),
			description: text(program.description),
			country: text(program.country),
			type: text(program.type),
			rss: text(program.refs?.rss),
			youtubeChannelId: text(program.refs?.youtubeChannelId),
			youtubePlaylistId: text(program.refs?.youtubePlaylistId),
			links: (program.links ?? []).flatMap((link) => text(link) ?? []),
			profileKey: text(program.profile),
			bannerKey: text(program.banner),
			tags: program.tags ?? [],
			private: program.private === true,
		});

		rows.credits.push(...authorCredits(program.id, program.author));
		const network = text(program.network);
		if (network) {
			rows.credits.push({
				programId: program.id,
				name: network,
				kind: "organization",
				role: "network",
				order: 0,
			});
		}

		for (const listenings of groupListenings(program)) {
			const [first] = listenings;
			if (new Set(listenings.map(({ name }) => titleKey(name))).size > 1) {
				rows.conflicts.push({
					programName: program.name,
					externalId: first.externalId!,
					episodes: listenings.map(({ id, date, name }) => ({ id, date, name })),
				});
				continue;
			}
			rows.merged += listenings.length - 1;
			rows.episodes.push({
				id: first.id,
				programId: program.id,
				name: first.name,
				shortName: text(first.shortName),
				type: text(first.type),
				duration: first.duration || null,
				link: text(first.link),
				externalId: text(first.externalId),
				tags: [...new Set(listenings.flatMap(({ tags }) => tags ?? []))],
				ignoredTags: first.ignoredTags ?? [],
			});
			// each Mongo episode is a listening: its view keeps its id
			for (const listening of listenings) {
				rows.views.push({
					id: listening.id,
					episodeId: first.id,
					date: listening.date,
					duration: listening.durationReal ?? null,
					contextTags: listening.contextTags ?? [],
					comment: text(listening.comment),
					createdAt: listening.created ?? `${listening.date}T00:00:00`,
				});
			}
		}
	}
	return rows;
}
