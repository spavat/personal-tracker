import type { EntityDirectoryItem } from "@personal-tracker/shared/entity";

import { KIND_ICONS, KIND_LABELS } from "./constants";
import { creditCounts } from "./utils";

export function renderEntityResultItem(
	item: EntityDirectoryItem,
	selected: boolean,
	clickFn: (item: EntityDirectoryItem) => void,
) {
	return (
		<div key={item.id} className={`result-item ${selected ? "selected" : ""}`} onClick={() => clickFn(item)}>
			<div>
				<i className={`fa-solid ${KIND_ICONS[item.kind]}`}></i>
			</div>
			<div>
				{item.name}
				<br />
				{KIND_LABELS[item.kind]}
				{creditCounts(item).map(({ field, count, label }) => (
					<span key={field}>
						{" · "}
						{count} {label}
					</span>
				))}
			</div>
		</div>
	);
}

export function linkEntityItem(item: EntityDirectoryItem) {
	return `/entities/${item.id}`;
}
