import type { EntityKind } from "@personal-tracker/shared/entity";

export const MODULE_NAME = "Répertoire";

export const KIND_LABELS: Record<EntityKind, string> = {
	person: "Personne",
	group: "Groupe",
	organization: "Organisation",
};

// the placeholder icon of an entity without portrait
export const KIND_ICONS: Record<EntityKind, string> = {
	person: "fa-user",
	group: "fa-users",
	organization: "fa-building",
};

// whether the entity page groups its performances by spectacle (the key of the former show artist page)
export const GROUP_BY_SPECTACLE_KEY = "show_artist_details_groupBySpectacle";
