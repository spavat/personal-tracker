import { MangaOverview } from "@personal-tracker/shared/reading-manga";

export function renderResultItem(item: MangaOverview, selected: boolean, clickFn: (item: MangaOverview) => void) {
	const status = getStatusIcon(item, { color: true });
	const authors = item.author ?? [];
	const arts = item.art ?? [];
	const scenarios = item.scenario ?? [];
	return (
		<div key={item.id} className={`result-item ${selected ? "selected" : ""}`} onClick={() => clickFn(item)}>
			<div>
				<i className="fa-solid fa-book-open"></i>
			</div>
			<div>
				{item.title}
				<br />
				{authors.length > 0 && authors.join(", ")}
				{arts.length > 0 && (
					<span>
						<i className="fa-solid fa-paintbrush"></i> : {arts.join(", ")}
					</span>
				)}
				<br />
				{scenarios.length > 0 && (
					<span>
						<i className="fa-regular fa-file-lines"></i> : {scenarios.join(", ")}
					</span>
				)}
			</div>
			<div>
				<span>{status}</span>
			</div>
		</div>
	);
}
export function linkItem(item: MangaOverview) {
	return `/reading-manga/manga/${item.id}`;
}

export function getStatusIcon(item: MangaOverview, { color }: { color: boolean }) {
	const colorSuffix = color ? "-color" : "";
	let status;
	if (item.status === "complete") {
		status = <i className={`complete${colorSuffix} fa-solid fa-circle-check`}></i>;
	} else if (item.status === "abandoned") {
		status = <i className={`dev-abandoned${colorSuffix} fa-solid fa-ban`}></i>;
	}
	return status;
}
