import type { GameOrigin } from "@personal-tracker/shared/game";

import Badge from "../../components/Badge";
import { GAME_ORIGINS } from "./origins";

export default function GameOriginBadge({ origin }: { origin: GameOrigin }) {
	const { label, icon } = GAME_ORIGINS[origin];
	return <Badge icon={icon} name={label} color="white" backgroundColor="#4a5568" />;
}
