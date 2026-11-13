const ACCENT_CLASSES: Record<string, string> = {
	a: "aàáâãäå",
	c: "cç",
	e: "eèéêë",
	i: "iìíîï",
	n: "nñ",
	o: "oòóôõö",
	u: "uùúûü",
	y: "yýÿ",
};

function escapeRegExp(text: string) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Case- and accent-insensitive "contains" for Mongo $regex ("anais" matches "Anaïs"), the Mongo
// counterpart of db/contains.ts. Assumes stored strings are NFC (precomposed accents).
export function accentInsensitiveRegex(search: string): RegExp {
	const base = search
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
	const pattern = [...base]
		.map((char) => (ACCENT_CLASSES[char] ? `[${ACCENT_CLASSES[char]}]` : escapeRegExp(char)))
		.join("");
	return new RegExp(pattern, "i");
}
