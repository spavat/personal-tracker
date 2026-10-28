type BadgeProps = {
	name: string;
	icon: string;
	backgroundColor?: string;
	color: string;
	className?: string;
} & React.HTMLAttributes<HTMLSpanElement>;

export default function Badge({ name, icon, backgroundColor, color, className, ...props }: BadgeProps) {
	return (
		<span
			className={`badge ${className ?? ""}`}
			style={{
				backgroundColor: backgroundColor,
				color: color,
			}}
			{...props}
		>
			<i className={icon} />
			&nbsp;{name}
		</span>
	);
}
