export default function FoldablePanel({
	folded,
	onToggle,
	titleContent,
	panelContent,
	className,
}: {
	folded: boolean;
	onToggle: () => void;
	titleContent: any;
	panelContent: any;
	className?: string;
}) {
	return (
		<div className={`panel ${className}`}>
			<div style={{ position: "relative" }}>
				{titleContent}
				<button
					type="button"
					onClick={onToggle}
					style={{ position: "absolute", right: 0, top: 0 }}
					title={folded ? "Ouvrir" : "Réduire"}
				>
					<span>{folded ? "▲" : "▼"}</span>
				</button>
			</div>
			{!folded && <div>{panelContent}</div>}
		</div>
	);
}
