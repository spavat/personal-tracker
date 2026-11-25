import type { Entity } from "@personal-tracker/shared/entity";

import { API_BASE_URL } from "../../../config";
import { KIND_ICONS } from "../constants";

// The portrait, moving between the card and the details page; an icon of the kind without one.
// lazy: in a list of cards
export default function EntityPortrait({
	entity,
	className,
	lazy = false,
}: {
	entity: Entity;
	className: string;
	lazy?: boolean;
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
			alt=""
			className={className}
			loading={lazy ? "lazy" : undefined}
			style={{ viewTransitionName: `entity-portrait-${entity.id}` }}
		/>
	);
}
