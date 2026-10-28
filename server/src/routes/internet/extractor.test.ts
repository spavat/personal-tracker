import { describe, expect, it } from "vitest";

import { isoDurationToSeconds, parseFranceTvPage } from "./extractor";

const PAGE_URL =
	"https://www.france.tv/sport/cyclisme/championnats-du-monde-de-cyclisme-sur-piste/8959376-shanghai-2026-jour-1.html";

function franceTvPage(videoObject: Record<string, unknown>) {
	return `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[]}</script>
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "VideoObject", ...videoObject })}</script>
</head><body></body></html>`;
}

describe("isoDurationToSeconds", () => {
	it.each([
		["PT1H51M27S", 6687],
		["PT0H2M1S", 121],
		["PT45M", 2700],
		["PT30S", 30],
	])("converts %s to %i seconds", (iso, expected) => {
		expect(isoDurationToSeconds(iso)).toBe(expected);
	});

	it("throws on invalid duration", () => {
		expect(() => isoDurationToSeconds("1:51:27")).toThrow();
	});
});

describe("parseFranceTvPage", () => {
	it("extracts episode data from the JSON-LD VideoObject", () => {
		const html = franceTvPage({
			name: "Shanghai 2026 - Jour 1",
			url: PAGE_URL,
			uploadDate: "2026-10-14T14:44:00+02:00",
			duration: "PT1H51M27S",
		});

		expect(parseFranceTvPage(html, PAGE_URL)).toEqual({
			id: "8959376",
			title: "Shanghai 2026 - Jour 1",
			author: {
				name: "Championnats du monde de cyclisme sur piste",
				description: "",
				type: "tv",
				channelId: "",
				url: "https://www.france.tv/sport/cyclisme/championnats-du-monde-de-cyclisme-sur-piste/",
			},
			duration: 111,
			durationInMinutes: 111,
			uploadDate: "2026-10-14T14:44:00+02:00",
			link: PAGE_URL,
		});
	});

	it("throws when the page has no VideoObject", () => {
		expect(() => parseFranceTvPage("<html></html>", PAGE_URL)).toThrow("Could not find VideoObject");
	});
});
