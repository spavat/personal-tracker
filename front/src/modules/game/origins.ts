import { CATCH_UP_DATE, type GameOrigin, type GamePlay } from "@personal-tracker/shared/game";

import { formatDay, formatFullDate } from "../../utils";

export const GAME_ORIGINS: Record<GameOrigin, { label: string; icon: string }> = {
	steam: { label: "Steam", icon: "fa-brands fa-steam" },
	"steam-deck": { label: "Steam Deck", icon: "fa-brands fa-steam" },
	gog: { label: "GOG", icon: "fa-solid fa-gamepad" },
	epic: { label: "Epic", icon: "fa-solid fa-gamepad" },
	"battle-net": { label: "Battle.net", icon: "fa-brands fa-battle-net" },
	"ubisoft-connect": { label: "Ubisoft Connect", icon: "fa-solid fa-gamepad" },
	riot: { label: "Riot", icon: "fa-solid fa-gamepad" },
	"itch-io": { label: "itch.io", icon: "fa-brands fa-itch-io" },
	executable: { label: "Exécutable", icon: "fa-solid fa-terminal" },
	ps5: { label: "PS5", icon: "fa-brands fa-playstation" },
	switch: { label: "Switch", icon: "fa-solid fa-gamepad" },
	other: { label: "Autre", icon: "fa-solid fa-gamepad" },
};

// A catch-up holds the playtime a store recorded before the import: its date is the last session, or the
// acquisition (Epic), or a placeholder when the store knows neither
const CATCH_UP_DATE_LABELS = {
	"last-session": "dernière session le",
	acquired: "acquis le",
	"last-achievement": "dernier succès le",
} as const;

/** The play's date; a catch-up's date is marked with "*" (details in `catchUpTitle`), "Rattrapage" without date. */
export function formatPlayDate({ date, catchUp }: Pick<GamePlay, "date" | "catchUp">) {
	if (!catchUp) return formatFullDate(date);
	if (catchUp === "unknown") return "Rattrapage";
	return `${formatFullDate(date)}*`;
}

/** Native tooltip (title) of a catch-up's date: what the playtime and the date are. */
export function catchUpTitle({ date, catchUp }: Pick<GamePlay, "date" | "catchUp">) {
	if (!catchUp) return undefined;
	if (catchUp === "unknown") return "Rattrapage : temps enregistré par le magasin avant l'import, date inconnue";
	return `Rattrapage : ${CATCH_UP_DATE_LABELS[catchUp]} ${formatFullDate(date)}`;
}
export const formatPlayDay = ({ date, catchUp }: Pick<GamePlay, "date" | "catchUp">) =>
	catchUp ? "" : formatDay(date);

/** A game's last play date: the placeholder of a catch-up without a known date reads "Rattrapage". */
export const formatLastPlayDate = (date: string) => (date === CATCH_UP_DATE ? "Rattrapage" : formatFullDate(date));
