import type { EntityDirectoryItem } from "@personal-tracker/shared/entity";

import { Link } from "@tanstack/react-router";

import { KIND_LABELS } from "../constants";
import { creditCounts } from "../utils";
import EntityPortrait from "./EntityPortrait";

export default function CardEntity({ entity }: { entity: EntityDirectoryItem }) {
	return (
		<div className="card_item entity">
			<EntityPortrait entity={entity} className="portrait-card" lazy />
			<div>
				<span className="title">
					<Link to="/entities/$entityId" params={{ entityId: entity.id }} viewTransition>
						{entity.name}
					</Link>
				</span>
				<br />
				<span className="subtitle">{KIND_LABELS[entity.kind]}</span>
				<br />
				{creditCounts(entity)
					.map(({ count, label }) => `${count} ${label}`)
					.join(" · ")}
			</div>
		</div>
	);
}
