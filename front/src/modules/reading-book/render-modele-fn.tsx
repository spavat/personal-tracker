export function renderItemModel(modeleItem: any) {
	if (modeleItem.content && modeleItem.content.length > 0) {
		return renderNode(modeleItem);
	} else {
		return renderLeaf(modeleItem);
	}
}

function renderNode(modeleItem: any) {
	return (
		<li key={modeleItem.id}>
			<div>
				<summary>
					<b>{modeleItem.title}</b>
				</summary>
				<ul>
					{(modeleItem.content ?? []).map((c: any) => {
						return renderItemModel(c);
					})}
				</ul>
			</div>
		</li>
	);
}

function renderLeaf(modeleItem: any) {
	return (
		<li key={modeleItem.id}>
			<span>{modeleItem.title || "-"}</span>
		</li>
	);
}
