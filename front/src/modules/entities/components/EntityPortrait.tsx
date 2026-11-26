import type { Entity } from "@personal-tracker/shared/entity";

import { API_BASE_URL } from "../../../config";
import { KIND_ICONS } from "../constants";

// The portrait, moving between the card and the details page; an icon of the kind without one.
// lazy: in a list of cards; alt: on the details page (a card's portrait is decorative)
export default function EntityPortrait({
	entity,
	className,
	lazy = false,
	alt = "",
}: {
	entity: Entity;
	className: string;
	lazy?: boolean;
	alt?: string;
}) {
	if (!entity.picture) {
		return (
			<div className="portrait-card">
				<i className={`fa-solid ${KIND_ICONS[entity.kind]}`}></i>
			</div>
		);
	}
	return (
		<img
			src={`${API_BASE_URL}${entity.picture}`}
			alt={alt}
			className={className}
			loading={lazy ? "lazy" : undefined}
			style={{ viewTransitionName: `entity-portrait-${entity.id}` }}
		/>
	);
}
