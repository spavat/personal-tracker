import type { Episode } from "@personal-tracker/shared/broadcast";

import { resolveImagePreviewSrc } from "../images";

// An episode's cover, at a fixed height and its own ratio; `watched` adds a green check on its corner
export default function EpisodeCover({
	episode,
	watched = false,
	className = "",
}: {
	episode: Pick<Episode, "cover">;
	watched?: boolean;
	className?: string;
}) {
	if (!episode.cover) return null;
	return (
		<span className={`episode-cover ${className}`}>
			<img src={resolveImagePreviewSrc(episode.cover)} alt="" loading="lazy" />
			{watched && <i className="fa-solid fa-circle-check cover-check" aria-label="Vu"></i>}
		</span>
	);
}
