import { useSuspenseQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

import Badge from "../../../components/badge";
import { formatDate, formatDay, formatMonth } from "../../../utils";
import { groupDetailsQuery, groupTransactionsQuery } from "../api";
import { formatAmount, getAmountClassName } from "../utils";

interface Transaction {
	id: number;
	name: string;
	description: string;
	date: string;
	amount: string;
	category: any;
	paymentType: any;
	children: Array<Transaction>;
	parent?: Transaction;
	informative: boolean;
}

interface RowSeparator {
	type: "year" | "month";
	value: string;
}

interface AmountThreshold {
	date: string;
	value: string;
}

type Rows = Array<(Transaction | RowSeparator | AmountThreshold) & { balance: number | null }>;

function isSeparator(row: Transaction | RowSeparator | AmountThreshold): row is RowSeparator {
	return "type" in row && (row.type === "year" || row.type === "month");
}

function isAmountThreshold(row: Transaction | RowSeparator | AmountThreshold): row is AmountThreshold {
	return !isSeparator(row) && "date" in row && "value" in row;
}

export default function MoneyGroupTransactions({ type, id }: { type: "category" | "tag" | "account"; id: string }) {
	// transactions + the account (with its history, for thresholds), tag or category, loaded in parallel
	const [{ data: transactionData }, { data: details }] = useSuspenseQueries({
		queries: [groupTransactionsQuery(type, id), groupDetailsQuery(type, id)],
	});
	const accountData = type === "account" ? (details as Money.AccountDetails) : undefined;

	// Title
	let title = "";
	if (type === "category") {
		title = `Détails de la catégorie ${details.name}`;
	} else if (type === "account") {
		title = `Détails du compte ${details.name}`;
	} else if (type === "tag") {
		title = `Détails du tag ${details.name}`;
	}

	let currentYear = "";
	let currentYearAndMonth = "";
	let balance = 0;
	let balanceStarted = false;
	const rows: Array<(Transaction | RowSeparator | AmountThreshold) & { balance: number | null }> = [];

	function processTransaction(transaction?: Transaction): Rows {
		if (!transaction) {
			return [];
		}
		const year = transaction.date.substring(0, 4);
		const yearAndMonth = transaction.date.substring(0, 7);
		const rows: Rows = [];

		// Processing Balance
		if (balanceStarted) {
			if (!transaction.informative) {
				balance += parseFloat(transaction.amount ?? "0");
			}
		} else {
			balanceStarted = true;
			balance = parseFloat(transaction.amount ?? "0");
		}

		// Add decorative time rows (year + month)
		if (!currentYear || currentYear !== year) {
			rows.push({
				type: "year",
				value: year.toString(),
				balance: null,
			});
			currentYear = year;
		}

		if (!currentYearAndMonth || currentYearAndMonth !== yearAndMonth) {
			currentYearAndMonth = yearAndMonth;
			rows.push({
				type: "month",
				value: formatMonth(transaction.date),
				balance: null,
			});
		}
		rows.push({ ...transaction, balance });

		return rows;
	}

	function processThreshold(threshold?: Money.AmountHistory) {
		if (!threshold) {
			return [];
		}
		const year = threshold.date.substring(0, 4);
		const yearAndMonth = threshold.date.substring(0, 7);
		const rows: Rows = [];
		if (!balanceStarted) {
			balanceStarted = true;
			balance = threshold.amount;
		}

		// Add decorative time rows (year + month)
		if (!currentYear || currentYear !== year) {
			rows.push({
				type: "year",
				value: year.toString(),
				balance: null,
			});
			currentYear = year;
		}
		if (!currentYearAndMonth || currentYearAndMonth !== yearAndMonth) {
			rows.push({
				type: "month",
				value: formatMonth(threshold.date),
				balance: null,
			});
			currentYearAndMonth = yearAndMonth;
		}
		rows.push({
			date: threshold.date,
			value: String(threshold.amount),
			balance,
		});

		return rows;
	}

	const transactionsToProcess = structuredClone(transactionData);
	const thresholdsToProcess = structuredClone(accountData?.history ?? []);
	while (transactionsToProcess.length || thresholdsToProcess.length) {
		const nextTransaction = transactionsToProcess[0];
		const nextThreshold = thresholdsToProcess[0];
		if (!nextThreshold && nextTransaction) {
			// no more threshold but transaction
			const transaction = transactionsToProcess.shift();
			rows.push(...processTransaction(transaction as any)); // TODO fix as any
		} else if (nextThreshold && !nextTransaction) {
			// threshold exists but no more transaction
			const threshold = thresholdsToProcess.shift();
			rows.push(...processThreshold(threshold));
		} else if (!nextThreshold && !nextTransaction) {
			// end
			console.log("end of process !");
			break;
		} else {
			if (nextThreshold.date <= nextTransaction.date) {
				const threshold = thresholdsToProcess.shift();
				rows.push(...processThreshold(threshold));
			} else {
				const transaction = transactionsToProcess.shift();
				rows.push(...processTransaction(transaction as any)); // TODO fix as any
			}
		}
	}

	let previousWeek = -1;
	let totalAmount = 0;
	return (
		<>
			<h2>{title}</h2>

			<table className="list transactions alternate">
				<thead>
					<tr>
						<th></th>
						<th colSpan={2}>Date</th>
						<th>Transaction</th>
						<th>Montant</th>
						<th>Catégorie(s)</th>
						<th>Paiement</th>
						<th></th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{rows.map((transaction, index) => {
						if (isSeparator(transaction)) {
							return (
								<Fragment key={`${transaction.type}-${transaction.value}`}>
									<tr className={`separator_${transaction.type}`}>
										<td colSpan={7}>
											{transaction.type === "year" ? "ANNEE" : ""} {transaction.value}
										</td>
										<td></td>
										<td></td>
									</tr>
								</Fragment>
							);
						}
						if (isAmountThreshold(transaction)) {
							return (
								<Fragment key={`threshold-${transaction.value}`}>
									<tr className={"threshold"}>
										<td colSpan={7}>
											({transaction.date}) {transaction.value}
										</td>
										<td>{transaction.balance !== null && formatAmount(transaction.balance)}</td>
										<td></td>
									</tr>
								</Fragment>
							);
						}

						const hasParent = Boolean(transaction.parent);
						const hasChildren = (transaction.children ?? []).length > 0;

						const categories = [];
						if (transaction.category) {
							categories.push(transaction.category);
						}
						const paymentTypes = [];
						if (transaction.paymentType) {
							paymentTypes.push(transaction.paymentType);
						}

						// Split des semaines
						const week = Temporal.PlainDate.from(transaction.date).weekOfYear ?? 0;
						const newWeek = previousWeek !== week && index !== 0 ? " new_week" : "";
						previousWeek = week;

						// Calcul du total du mois
						if (hasChildren) {
							totalAmount = transaction.children.reduce((total, child) => {
								return total + parseFloat(child.amount);
							}, totalAmount);
						} else {
							if (!transaction.informative) {
								totalAmount += parseFloat(transaction.amount);
							}
						}
						return (
							<Fragment key={transaction.id}>
								<tr className={`${newWeek}`}>
									<td>{hasParent ? <i className="fa-solid fa-list"></i> : ""}</td>
									<td>{formatDay(transaction.date)}</td>
									<td>{formatDate(transaction.date)}</td>
									<td>
										{transaction.parent ? (
											<>
												<b>
													<Link
														to="/money/transaction/$transactionId"
														params={{ transactionId: String(transaction.parent.id) }}
													>
														{transaction.parent.name}
													</Link>
												</b>{" "}
												{transaction.parent.description && (
													<span className="description">
														- {transaction.parent.description}
													</span>
												)}{" "}
												({transaction.parent.amount}&nbsp;€)&nbsp;
												<i className="fa-solid fa-caret-right"></i>&nbsp;
												{transaction.name}
											</>
										) : (
											<Link
												to="/money/transaction/$transactionId"
												params={{ transactionId: String(transaction.id) }}
											>
												{transaction.name}
											</Link>
										)}{" "}
										{transaction.description && (
											<span className="description">- {transaction.description}</span>
										)}
									</td>
									<td className={getAmountClassName(parseFloat(transaction.amount), transaction)}>
										{transaction.amount}&nbsp;€
									</td>
									<td>
										{categories.map((cat) => (
											<Badge
												key={cat.id}
												name={cat.name}
												icon={cat.icon}
												backgroundColor={cat.backgroundColor}
												color={cat.textColor}
											/>
										))}
									</td>
									<td>
										{paymentTypes.map((pt) => (
											<Badge
												key={pt.id}
												name={pt.name}
												icon={pt.icon}
												backgroundColor={pt.backgroundColor}
												color={pt.textColor}
											/>
										))}
									</td>
									<td>{transaction.balance !== null && formatAmount(transaction.balance)}</td>
									<td>
										<input
											className="row_checkbox"
											type="checkbox"
											aria-label="Sélectionner"
										></input>
									</td>
								</tr>
							</Fragment>
						);
					})}
				</tbody>
				<tfoot>
					<tr>
						<th></th>
						<th colSpan={2}></th>
						<th>{transactionData.length} transactions</th>
						<th className={getAmountClassName(totalAmount)}>{totalAmount.toFixed(2)}&nbsp;€</th>
						<th></th>
						<th></th>
					</tr>
				</tfoot>
			</table>
		</>
	);
}
