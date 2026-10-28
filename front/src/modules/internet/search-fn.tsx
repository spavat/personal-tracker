import Badge from "../../components/badge";

export function renderInternetResultItem(item: any, selected: boolean, clickFn: (item: any) => void) {
	const icon = getIconType(item);
	return (
		<div key={item.id} className={`result-item ${selected ? "selected" : ""}`} onClick={() => clickFn(item)}>
			<div>{icon}</div>
			<div>
				{item.name}
				{item.author ? ` - ${item.author}` : ""}
				<br />
				{(item.tags ?? []).length > 0 && (
					<>
						<span>
							{item.tags?.map((t: string) => (
								<Badge
									key={t}
									icon="fa-solid fa-tag"
									name={t}
									color="white"
									backgroundColor="green"
								></Badge>
							))}
						</span>
					</>
				)}
			</div>
			<div>
				<span className={`fi fi-${item.country}`}></span>
			</div>
		</div>
	);
}
export function linkItem(item: any) {
	return `/internet/${item.id}`;
}
export function getIconType({ type }: { type?: string }) {
	switch (type) {
		case "podcast":
			return <i className="fa-solid fa-podcast"></i>;
		case "youtube":
			return <i className="fa-brands fa-youtube"></i>;
		case "radio":
			return <i className="fa-solid fa-radio"></i>;
		case "media":
			return <i className="fa-solid fa-video"></i>;
		case "twitch":
			return <i className="fa-brands fa-twitch"></i>;
		case "tv":
			return <i className="fa-solid fa-tv"></i>;
		default:
			return null;
	}
}
