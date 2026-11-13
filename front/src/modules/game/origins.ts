import { CATCH_UP_DATE, type GameOrigin } from "@personal-tracker/shared/game";

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

// The catch-up play holds the playtime recorded by a store before the first sync: its date isn't real
export const formatPlayDate = (date: string) => (date === CATCH_UP_DATE ? "Rattrapage" : formatFullDate(date));
export const formatPlayDay = (date: string) => (date === CATCH_UP_DATE ? "" : formatDay(date));
