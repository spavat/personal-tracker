export function renderShowResultItem(item: any, selected: boolean, clickFn: (item: any) => void) {
	return (
		<div
			key={`${item.type}-${item.id}`}
			className={`result-item ${selected ? "selected" : ""}`}
			onClick={() => clickFn(item)}
		>
			<div>
				{item.type === "spectacle" && <i className="fa-solid fa-masks-theater"></i>}
				{item.type === "artist" && <i className="fa-solid fa-user"></i>}
				{item.type === "place" && <i className="fa-solid fa-house"></i>}
			</div>
			<div>
				{item.name}
				{item.author ? ` - ${item.author}` : ""}
				<br />
				{item.description}
			</div>
			<div>
				<span className={`fi fi-${item.country}`}></span>
			</div>
		</div>
	);
}
export function linkItem(item: any) {
	let thepath = "";
	switch (item.type) {
		case "spectacle":
			thepath = `/shows/spectacles/${item.id}`;
			break;
		case "artist":
			thepath = `/shows/artists/${item.id}`;
			break;
		case "place":
			thepath = `/shows/places/${item.id}`;
			break;
	}
	return thepath;
}
