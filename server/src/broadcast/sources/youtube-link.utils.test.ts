import { describe, expect, it } from "vitest";

import { youtubeVideoId } from "./youtube-link.utils.js";

describe("youtubeVideoId", () => {
	it.each([
		"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		"https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
		"https://youtu.be/dQw4w9WgXcQ?si=abc",
		"https://www.youtube.com/shorts/dQw4w9WgXcQ",
		"https://www.youtube.com/live/dQw4w9WgXcQ",
		"https://www.youtube.com/embed/dQw4w9WgXcQ",
	])("reads the video of %s", (link) => {
		expect(youtubeVideoId(link)).toBe("dQw4w9WgXcQ");
	});

	it.each([
		"https://www.youtube.com/@franceinter",
		"https://www.youtube.com/watch?v=short",
		"https://www.radiofrance.fr/franceinter/podcasts/episode",
		"not a url",
	])("reads no video in %s", (link) => {
		expect(youtubeVideoId(link)).toBeUndefined();
	});
});
