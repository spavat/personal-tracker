import type { GamePlay } from "@personal-tracker/shared/game";

import { catchUpTitle, formatPlayDate } from "../origins";

/** A play's date; a catch-up's one is underlined (dotted) and explains itself in a native tooltip. */
export default function PlayDate({ date, catchUp }: Pick<GamePlay, "date" | "catchUp">) {
	if (!catchUp) return formatPlayDate({ date });
	return (
		<span className="catch-up-date" title={catchUpTitle({ date, catchUp })}>
			{formatPlayDate({ date, catchUp })}
		</span>
	);
}
