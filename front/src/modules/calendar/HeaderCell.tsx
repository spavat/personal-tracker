export default function HeaderCell({
	title,
	disabled = false,
}: {
	children?: React.ReactNode;
	title?: string;
	disabled?: boolean;
}) {
	if (disabled) {
		return <div></div>;
	}

	return (
		<div className="header">
			<p>{title}</p>
		</div>
	);
}
