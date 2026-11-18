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

// The first `max` lines of a table of contents (sections and chapters, depth-first),
// with a "…" line where it is cut
export function truncateModel(tree: any[], max: number) {
	let left = max;
	function cut(items: any[]): any[] {
		const kept: any[] = [];
		for (const item of items) {
			if (left <= 0) {
				// once: the levels above stop without their own "…"
				if (left === 0) kept.push({ id: `${item.id}-more`, title: "…" });
				left = -1;
				break;
			}
			left--;
			kept.push(item.content?.length ? { ...item, content: cut(item.content) } : item);
		}
		return kept;
	}
	return cut(tree);
}
