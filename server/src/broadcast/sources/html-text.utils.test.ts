import { describe, expect, it } from "vitest";

import { htmlToText } from "./html-text.utils.js";

describe("htmlToText", () => {
	it("keeps the paragraphs, line breaks and list items as new lines and strips the tags", () => {
		expect(
			htmlToText(
				'<p>Intro <a href="https://x">lien</a></p>\n<p>Deuxième<br>ligne</p><ul><li>un</li><li>deux</li></ul><div>fin</div>',
			),
		).toBe("Intro lien\n\nDeuxième\nligne\n\n- un\n- deux\n\nfin");
	});

	it("decodes the named and numeric entities, and leaves an unknown one", () => {
		expect(htmlToText("L&rsquo;&eacute;t&#233; &#x1F600; &amp;lt; &unknown; a&nbsp;b")).toBe(
			"L’été 😀 &lt; &unknown; a b",
		);
	});

	it("keeps the line breaks of a plain text, trims the lines and the blank ones in excess", () => {
		expect(htmlToText("  Ligne 1  \r\nLigne 2\n\n\n\nLigne 3\n")).toBe("Ligne 1\nLigne 2\n\nLigne 3");
	});
});
