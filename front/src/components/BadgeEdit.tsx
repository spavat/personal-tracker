type BadgeProps = {
	icon: string;
	backgroundColor?: string;
	color: string;
	className?: string;
	onClickRemove: () => void;
} & React.HTMLAttributes<HTMLSpanElement>;

export default function BadgeEdit({
	icon,
	backgroundColor,
	color,
	className,
	onClickRemove,
	children,
	...props
}: BadgeProps) {
	return (
		<span
			className={`badge ${className}`}
			style={{
				backgroundColor: backgroundColor,
				color: color,
			}}
			{...props}
		>
			<i className={icon} />
			&nbsp;{children}
			&nbsp;
			<span onClick={onClickRemove}>✕</span>
		</span>
	);
}
