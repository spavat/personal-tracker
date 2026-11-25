// The site of a link, as the program and episode details show it: "https://www.youtube.com/watch?v=…" → "youtube.com"
export function getDomain(url: string) {
	try {
		return new URL(url).hostname.split(".").slice(-2).join(".");
	} catch {
		return url;
	}
}
