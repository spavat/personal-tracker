const VIDEO_ID = /^[\w-]{11}$/;

// The id of the YouTube video a link points to (youtube.com/watch?v=, youtu.be/, /shorts/, /live/, /embed/), or
// undefined
export function youtubeVideoId(link: string): string | undefined {
	let url: URL;
	try {
		url = new URL(link);
	} catch {
		return undefined;
	}
	const host = url.hostname.replace(/^(www|m|music)\./, "");
	let id: string | null | undefined;
	if (host === "youtu.be") id = url.pathname.split("/")[1];
	else if (host === "youtube.com" || host === "youtube-nocookie.com") {
		const [, first, second] = url.pathname.split("/");
		id =
			first === "watch" ? url.searchParams.get("v") : ["shorts", "live", "embed"].includes(first) ? second : null;
	}
	return id && VIDEO_ID.test(id) ? id : undefined;
}

// The medium thumbnail of a YouTube video
export const youtubeThumbnail = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
