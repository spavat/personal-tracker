import { useNavigate } from "@tanstack/react-router";
import { useOptimistic, useState, useTransition } from "react";

import { HeaderPortal } from "../../components/HeaderPortal";
import { PendingContent } from "../../components/pending-content";
import PeriodSelector from "../../components/period-selector";
import { useYearChanger } from "../../hooks/use-year-changer";
import { formatMonth } from "../../utils";
import { annualRecap } from "./api";
import { getAmountClassName } from "./utils";

export default function MoneyAnnualRecap({ year: initialYear }: { year: string }) {
	const navigate = useNavigate();
	const [regroup, setRegroup] = useState<boolean>(true);
	const [isPending, startTransition] = useTransition();
	const [optimisticRegroup, setOptimisticRegroup] = useOptimistic(regroup);
	const [year, { data }, goPrevious, goNext, canGoPrevious, canGoNext] = useYearChanger({
		...annualRecap(regroup),
		navigationIsDisabled: () => false,
		initialPeriod: initialYear,
	});

	function goNow() {
		navigate({ to: "/money/reports/$year", params: { year: String(Temporal.Now.plainDateISO().year) } });
	}

	function changeRegroup(e: React.ChangeEvent<HTMLInputElement>) {
		// transition: keep the current recap displayed while the new grouping loads
		const checked = e.target.checked;
		startTransition(() => {
			setOptimisticRegroup(checked);
			setRegroup(checked);
		});
	}

	return (
		<>
			<HeaderPortal>
				<PeriodSelector
					period={`Année ${year}`}
					goPrevious={goPrevious}
					goNext={goNext}
					canGoPrevious={canGoPrevious()}
					canGoNext={canGoNext()}
					type="year"
				/>
			</HeaderPortal>
			<h2>
				Synthèse de l'année {year}{" "}
				<label>
					<input type="checkbox" onChange={(e) => changeRegroup(e)} checked={optimisticRegroup} /> Regrouper
					catégories
				</label>
			</h2>

			<PendingContent isPending={isPending}>
				<table className="list alternate recap">
					<thead>
						<tr>
							<th>Catégorie</th>
							{data.allMonths.map((month) => {
								return <th key={month}>{formatMonth(`${month}-01`)}</th>;
							})}

							<th>
								Moyenne <br />({data.nbMonths} mois)
							</th>
							<th>Total</th>
						</tr>
					</thead>
					<tbody>
						{data.data.map((r) => {
							const totalAmount = r.months.total.debit + r.months.total.credit;
							const moyenneAmount = r.months.moyenne.total;
							return (
								<tr key={r.id}>
									<td>{r.name}</td>
									{data.allMonths.map((month) => {
										const data = r.months[month];
										if (!data) {
											return <td key={month}>-</td>;
										}

										const classDebit = getAmountClassName(data.debit);
										const classCredit = getAmountClassName(data.credit);

										if (data.debit && data.credit) {
											return (
												<td key={month}>
													<span className={classCredit}>{data.credit.toFixed(2)}&nbsp;€</span>
													<br />
													<span className={classDebit}>{data.debit.toFixed(2)}&nbsp;€</span>
												</td>
											);
										}
										if (data.debit) {
											return (
												<td className={classDebit} key={month}>
													{data.debit.toFixed(2)}&nbsp;€
												</td>
											);
										}
										return (
											<td className={classCredit} key={month}>
												{data.credit.toFixed(2)}&nbsp;€
											</td>
										);
									})}
									<td className={getAmountClassName(moyenneAmount ?? 0)}>
										{(moyenneAmount ?? 0).toFixed(2)}&nbsp;€
									</td>
									<td className={getAmountClassName(totalAmount)}>{totalAmount.toFixed(2)}&nbsp;€</td>
								</tr>
							);
						})}
					</tbody>
					<tfoot>
						<tr>
							<th>TOTAL</th>
							{data.allMonths.map((month) => {
								const total = data.total[month];
								if (total) {
									return (
										<th key={month} className={getAmountClassName(total)}>
											{total.toFixed(2)}&nbsp;€
										</th>
									);
								} else {
									return <th key={month}></th>;
								}
							})}
							<th></th>
						</tr>
					</tfoot>
				</table>
			</PendingContent>
			<div className="fab-left-container">
				<button type="button" className="fab-main" onClick={goPrevious} title="Previous year">
					<div className="pulse"></div>
					<div className="heart-line">
						<i className="fa-solid fa-angle-left"></i>
					</div>
				</button>
				<button type="button" className="fab-main" onClick={goNow} title="Current year">
					<div className="pulse"></div>
					<div className="heart-line">
						<i className="fa-solid fa-align-justify"></i>
					</div>
				</button>
				<button type="button" className="fab-main" onClick={goNext} title="Next year">
					<div className="pulse"></div>
					<div className="heart-line">
						<i className="fa-solid fa-angle-right"></i>
					</div>
				</button>
			</div>
		</>
	);
}
