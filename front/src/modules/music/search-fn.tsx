import { MusicListening } from "@personal-tracker/shared/music";

export function renderResultItem(item: MusicListening, selected: boolean, clickFn: (item: MusicListening) => void) {
	return (
		<div key={item.id} className={`result-item ${selected ? "selected" : ""}`} onClick={() => clickFn(item)}>
			<div>
				<i className="fa-solid fa-compact-disc"></i>
			</div>
			<div>
				{item.artist.join(", ")}
				<br />
				{item.album}
			</div>
			<div>{item.duration}</div>
		</div>
	);
}
export function linkItem() {
	return null;
}
