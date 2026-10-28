import { useLocation, useNavigate } from "@tanstack/react-router";

import { formatMonth } from "../../../utils";

type PeriodDelta = "previous" | "next" | "previousYear" | "nextYear" | "now";

export default function PeriodNavigation({ basePeriod }: { basePeriod: string }) {
	const navigate = useNavigate();
	const location = useLocation();

	const monthsOfYear = Array.from(Array(12).keys()).map((i) => {
		return `${basePeriod.substring(0, 4)}-${String(i + 1).padStart(2, "0")}`;
	});

	function navigateToPeriod(newPeriod: string) {
		navigate({ to: location.pathname.replace(`/${basePeriod}`, `/${newPeriod}`) });
	}

	function changePeriod(delta: PeriodDelta) {
		const baseMonth = Temporal.PlainYearMonth.from(basePeriod);
		let newBaseMonth: Temporal.PlainYearMonth;
		if (delta === "previous" || delta === "next") {
			newBaseMonth = baseMonth.add({ months: delta === "previous" ? -1 : 1 });
		} else if (delta === "previousYear" || delta === "nextYear") {
			newBaseMonth = baseMonth.add({ years: delta === "previousYear" ? -1 : 1 });
		} else {
			newBaseMonth = Temporal.Now.plainDateISO().toPlainYearMonth();
		}
		navigateToPeriod(newBaseMonth.toString());
	}

	return (
		<>
			<div>
				{/* <button type="button" onClick={() => changePeriod("previous")} title="Mois précédent">
					<i className="fa-solid fa-arrow-left"></i>
				</button> */}
				{monthsOfYear.map((month) => (
					<button
						type="button"
						key={month}
						className={month === basePeriod ? "currentMonth month" : "month"}
						onClick={() => navigateToPeriod(month)}
					>
						{formatMonth(`${month}-01`)}
					</button>
				))}
				{/* <button type="button" onClick={() => changePeriod("next")} title="Mois suivant">
					<i className="fa-solid fa-arrow-right"></i>
				</button> */}
			</div>

			<div className="fab-left-container">
				<button
					type="button"
					className="fab-main"
					onClick={() => changePeriod("previousYear")}
					title="Année précédente"
				>
					<div className="pulse"></div>
					<div className="heart-line">
						<i className="fa-solid fa-angles-left"></i>
					</div>
				</button>
				<button
					type="button"
					className="fab-main"
					onClick={() => changePeriod("previous")}
					title="Mois précédent"
				>
					<div className="pulse"></div>
					<div className="heart-line">
						<i className="fa-solid fa-angle-left"></i>
					</div>
				</button>
				<button type="button" className="fab-main" onClick={() => changePeriod("now")} title="Mois courant">
					<div className="pulse"></div>
					<div className="heart-line">
						<i className="fa-solid fa-align-justify"></i>
					</div>
				</button>
				<button type="button" className="fab-main" onClick={() => changePeriod("next")} title="Mois suivant">
					<div className="pulse"></div>
					<div className="heart-line">
						<i className="fa-solid fa-angle-right"></i>
					</div>
				</button>
				<button
					type="button"
					className="fab-main"
					onClick={() => changePeriod("nextYear")}
					title="Année suivante"
				>
					<div className="pulse"></div>
					<div className="heart-line">
						<i className="fa-solid fa-angles-right"></i>
					</div>
				</button>
			</div>
		</>
	);
}
