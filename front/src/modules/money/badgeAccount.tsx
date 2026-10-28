import type { ReactElement } from "react";

type BadgeProps = {
	name: string;
	icon: string;
	backgroundColor: string;
	color: string;
	amount: string;
	comment: string;
	panelOpts?: ReactElement;
} & React.HTMLAttributes<HTMLSpanElement>;

export default function AccountBadge({
	name,
	icon,
	backgroundColor,
	color,
	amount,
	comment,
	panelOpts,
	...props
}: BadgeProps) {
	return (
		<div className="accountBadge" style={{ borderColor: backgroundColor }}>
			<div className="colorBadge" style={{ backgroundColor, cursor: "pointer" }} {...props}>
				<i className={icon} />
			</div>
			<div className="textBadge">
				<span className="account" style={{ color: color ?? "black" }}>
					{name}
				</span>{" "}
				<br />
				<span style={{ color: "black" }}>
					<b>{amount} €</b> <i>({comment})</i>
				</span>
			</div>
			{panelOpts && <div className="panelBadge">{panelOpts}</div>}
		</div>
	);
}
