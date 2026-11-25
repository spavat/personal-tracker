// The named entities met in the feeds' descriptions (the numeric ones are all decoded)
const ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	rsquo: "’",
	lsquo: "‘",
	rdquo: "”",
	ldquo: "“",
	laquo: "«",
	raquo: "»",
	hellip: "…",
	ndash: "–",
	mdash: "—",
	bull: "•",
	euro: "€",
	copy: "©",
	eacute: "é",
	egrave: "è",
	ecirc: "ê",
	euml: "ë",
	agrave: "à",
	acirc: "â",
	ccedil: "ç",
	icirc: "î",
	iuml: "ï",
	ocirc: "ô",
	ugrave: "ù",
	ucirc: "û",
	uuml: "ü",
	oelig: "œ",
	Eacute: "É",
	Egrave: "È",
	Ecirc: "Ê",
	Agrave: "À",
	Ccedil: "Ç",
};

function decodeEntities(text: string) {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
		if (name.startsWith("#")) {
			const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
			return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
		}
		return ENTITIES[name] ?? entity;
	});
}

// A feed's HTML description as plain text: line breaks, paragraphs and list items kept as new lines, tags stripped,
// entities decoded. A plain text keeps its own line breaks.
export function htmlToText(html: string) {
	const text = html
		.replace(/\r\n?/g, "\n")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<li[^>]*>/gi, "\n- ")
		.replace(/<\/(p|div|h[1-6]|ul|ol|blockquote)>/gi, "\n\n")
		.replace(/<[^>]*>/g, "");
	return decodeEntities(text)
		.replaceAll(" ", " ")
		.split("\n")
		.map((line) => line.trim())
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
