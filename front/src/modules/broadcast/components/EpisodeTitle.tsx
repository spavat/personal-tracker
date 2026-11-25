import type { Episode } from "@personal-tracker/shared/broadcast";
import type { ReactNode } from "react";

import EpisodeCover from "./EpisodeCover";

// An episode line's title cell content: its cover, its title opening the episode's details (without `onOpen`: a
// link to the episode itself), then `children`
export default function EpisodeTitle({
	episode,
	watched,
	prefix,
	onOpen,
	children,
}: {
	episode: Pick<Episode, "cover" | "type" | "name" | "link">;
	watched?: boolean;
	// before the title (a number label)
	prefix?: ReactNode;
	onOpen?: () => void;
	children?: ReactNode;
}) {
	return (
		<div className="episode-title">
			<EpisodeCover episode={episode} watched={watched} />
			<span className="episode-name">
				{prefix}
				{onOpen ? (
					<button type="button" className="link-button" onClick={onOpen}>
						{episode.name}
					</button>
				) : episode.link ? (
					<a href={episode.link}>{episode.name}</a>
				) : (
					episode.name
				)}
				{children}
			</span>
		</div>
	);
}
