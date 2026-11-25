import { describe, expect, it } from "vitest";

import type { MongoEpisode, MongoProgram } from "./broadcast-migration.utils.js";

import { titleKey, toBroadcastRows } from "./broadcast-migration.utils.js";

const episode = (fields: Partial<MongoEpisode> & Pick<MongoEpisode, "id" | "name" | "date">): MongoEpisode => ({
	duration: 30,
	type: "podcast",
	...fields,
});
const program = (fields: Partial<MongoProgram> & Pick<MongoProgram, "id" | "episodes">): MongoProgram => ({
	name: "Tolkien",
	...fields,
});

describe("titleKey", () => {
	it("ignores case, accents and punctuation", () => {
		expect(titleKey("Zetman – #53 – La 5e de Couv’")).toBe(titleKey("zetman #53 la 5e de couv'"));
		expect(titleKey("Été")).toBe("ete");
	});
});

describe("toBroadcastRows", () => {
	it("maps a program, empty strings becoming NULL, and credits its author and network", () => {
		const { programs, credits } = toBroadcastRows([
			program({
				id: "p1",
				shortName: "",
				author: " Jane Doe ",
				network: "",
				country: "FR",
				type: "podcast",
				links: ["https://a", ""],
				profile: "personal-tracker/broadcast/p1.profile.avif",
				refs: { rss: "https://feed", youtubeChannelId: "" },
				private: true,
				episodes: [],
			}),
		]);

		expect(programs).toEqual([
			{
				id: "p1",
				name: "Tolkien",
				shortName: null,
				description: null,
				country: "FR",
				type: "podcast",
				rss: "https://feed",
				youtubeChannelId: null,
				youtubePlaylistId: null,
				links: ["https://a"],
				profileKey: "personal-tracker/broadcast/p1.profile.avif",
				bannerKey: null,
				tags: [],
				private: true,
			},
		]);
		expect(credits).toEqual([{ programId: "p1", name: "Jane Doe", kind: "person", role: "host", order: 0 }]);
	});

	it("splits the author on && and applies the overrides: an organization produces, a group hosts", () => {
		const { credits } = toBroadcastRows([
			program({
				id: "p1",
				author: "Jane Doe && Origami && Babymonster && Chistrine Lakin && ",
				network: "France Inter",
				episodes: [],
			}),
		]);

		expect(credits).toEqual([
			{ programId: "p1", name: "Jane Doe", kind: "person", role: "host", order: 0 },
			{ programId: "p1", name: "Origami Media", kind: "organization", role: "producer", order: 0 },
			{ programId: "p1", name: "Babymonster", kind: "group", role: "host", order: 1 },
			{ programId: "p1", name: "Christine Lakin", kind: "person", role: "host", order: 2 },
			{ programId: "p1", name: "France Inter", kind: "organization", role: "network", order: 0 },
		]);
	});

	it("makes each Mongo episode an episode with one view keeping its id", () => {
		const { episodes, views } = toBroadcastRows([
			program({
				id: "p1",
				episodes: [
					episode({
						id: "e1",
						name: "Les hobbits",
						date: "2024-01-05",
						duration: 0,
						durationReal: 20,
						link: "",
						externalId: "",
						contextTags: ["train"],
						comment: "bien",
						created: "2024-01-05T08:00:00",
					}),
				],
			}),
		]);

		expect(episodes).toEqual([
			{
				id: "e1",
				programId: "p1",
				name: "Les hobbits",
				shortName: null,
				type: "podcast",
				duration: null,
				link: null,
				externalId: null,
				tags: [],
				ignoredTags: [],
			},
		]);
		expect(views).toEqual([
			{
				id: "e1",
				episodeId: "e1",
				date: "2024-01-05",
				duration: 20,
				contextTags: ["train"],
				comment: "bien",
				createdAt: "2024-01-05T08:00:00",
			},
		]);
	});

	it("dates a view without `created` at midnight of its day", () => {
		const { views } = toBroadcastRows([
			program({ id: "p1", episodes: [episode({ id: "e1", name: "A", date: "2024-01-05" })] }),
		]);

		expect(views[0].createdAt).toBe("2024-01-05T00:00:00");
	});

	it("merges the listenings of one release into the oldest, with the tags of all", () => {
		const { episodes, views, merged } = toBroadcastRows([
			program({
				id: "p1",
				episodes: [
					episode({ id: "late", name: "Zetman – Couv'", date: "2025-06-11", externalId: "g1", tags: ["b"] }),
					episode({ id: "early", name: "Zetman – Couv’", date: "2025-06-08", externalId: "g1", tags: ["a"] }),
					episode({ id: "other", name: "Autre", date: "2025-06-09", externalId: "g2" }),
				],
			}),
		]);

		expect(merged).toBe(1);
		expect(episodes.map(({ id, name, tags }) => [id, name, tags])).toEqual([
			["early", "Zetman – Couv’", ["a", "b"]],
			["other", "Autre", []],
		]);
		expect(views.map(({ id, episodeId }) => [id, episodeId])).toEqual([
			["early", "early"],
			["late", "early"],
			["other", "other"],
		]);
	});

	it("reports the episodes sharing an externalId with different titles, without migrating them", () => {
		const { episodes, views, conflicts } = toBroadcastRows([
			program({
				id: "p1",
				name: "NOWPLAYING",
				episodes: [
					episode({ id: "jan25", name: "January 2025", date: "2025-02-07", externalId: "g1" }),
					episode({ id: "jan26", name: "January 2026", date: "2026-02-11", externalId: "g1" }),
				],
			}),
		]);

		expect(episodes).toEqual([]);
		expect(views).toEqual([]);
		expect(conflicts).toEqual([
			{
				programName: "NOWPLAYING",
				externalId: "g1",
				episodes: [
					{ id: "jan25", date: "2025-02-07", name: "January 2025" },
					{ id: "jan26", date: "2026-02-11", name: "January 2026" },
				],
			},
		]);
	});
});
