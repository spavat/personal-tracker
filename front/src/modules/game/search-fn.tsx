import { GameWithOverview } from "@personal-tracker/shared/game";

export function renderResultItem(item: GameWithOverview, selected: boolean, clickFn: (item: GameWithOverview) => void) {
	return (
		<div key={item.id} className={`result-item ${selected ? "selected" : ""}`} onClick={() => clickFn(item)}>
			<div>🎮</div>
			<div>
				{item.name}
				<br />
				{item.developper}
			</div>
			<div>{item.complete && <i className="complete-color fa-solid fa-circle-check"></i>}</div>
		</div>
	);
}
export function linkItem(item: GameWithOverview) {
	return `/game/details/${item.id}`;
}
