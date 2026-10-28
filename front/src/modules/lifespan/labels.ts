import type {
	LifespanDisposeCause,
	LifespanEventType,
	LifespanPossessionStatus,
	LifespanUsageStatus,
} from "@personal-tracker/shared/lifespan";

export const EVENT_TYPE_LABELS: Record<LifespanEventType, string> = {
	bought: "Achat",
	received: "Réception",
	start_usage: "Début d'utilisation",
	pause_usage: "Pause",
	end_usage: "Fin d'utilisation",
	dispose: "Sortie",
	note: "Note",
};

export const DISPOSE_CAUSE_LABELS: Record<LifespanDisposeCause, string> = {
	thrown: "Jeté",
	given_away: "Donné",
	sold: "Vendu",
	lost: "Perdu",
	recycled: "Recyclé",
	other: "Autre",
};

export const USAGE_STATUS_LABELS: Record<LifespanUsageStatus, string> = {
	not_started: "Pas encore utilisé",
	in_use: "En cours",
	paused: "En pause",
	ended: "Utilisation terminée",
};

export const POSSESSION_STATUS_LABELS: Record<LifespanPossessionStatus, string> = {
	owned: "Possédé",
	disposed: "Sorti",
};
