import type { Episode } from "@personal-tracker/shared/broadcast";

import { resolveImagePreviewSrc } from "../images";

// An episode's cover: square for a podcast, 16:9 for a video; `watched` adds a green check on its corner
export default function EpisodeCover({
	episode,
	watched = false,
	className = "",
}: {
	episode: Pick<Episode, "cover" | "type">;
	watched?: boolean;
	className?: string;
}) {
	if (!episode.cover) return null;
	return (
		<span className={`episode-cover ${episode.type === "video" ? "wide" : ""} ${className}`}>
			<img src={resolveImagePreviewSrc(episode.cover)} alt="" loading="lazy" />
			{watched && <i className="fa-solid fa-circle-check cover-check" aria-label="Vu"></i>}
		</span>
	);
}
