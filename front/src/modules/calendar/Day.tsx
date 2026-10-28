import { useNavigate, useLocation } from "@tanstack/react-router";
import { ReactNode } from "react";

export interface DayProps {
	children?: ReactNode;
	title?: string;
	disabled?: boolean;
	date: string;
	period: string;
}

export default function Day({ children, title, date, period, disabled = false }: DayProps) {
	const navigate = useNavigate();
	const location = useLocation();

	if (disabled) {
		return <div></div>;
	}

	function openModal() {
		navigate({
			to: `/calendar/$period/$date`,
			params: { period, date },
			search: { returnTo: location.pathname },
			replace: true,
			resetScroll: false,
			mask: {
				to: `/calendar/$period`,
				params: { period },
			},
		});
	}

	const currentDate = Temporal.PlainDate.from(date);
	const today = Temporal.PlainDate.compare(currentDate, Temporal.Now.plainDateISO()) === 0;
	const weekend = currentDate.dayOfWeek === 6 || currentDate.dayOfWeek === 7;

	let className = "";
	if (today) {
		className = "today";
	} else if (weekend) {
		className = "weekend";
	}

	return (
		<div className={`day ${className}`} onDoubleClick={openModal}>
			<p>{title}</p>
			{children}
		</div>
	);
}
