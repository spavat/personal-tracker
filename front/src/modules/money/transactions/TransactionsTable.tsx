import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FormProvider, type SubmitHandler, useForm } from "react-hook-form";

import MutationError from "../../../components/mutation-error";
import { quickSaveTransaction } from "../api";
import { getAmountClassName } from "../utils";
import TransactionRow from "./TransactionRow";

export interface QuickEditInputs {
	id: number;
	name: string;
	description: string;
	amount: number;
	categoryId: number;
	paymentTypeId: number;
}

export default function TransactionsTable({
	transactions,
	categories,
	paymentTypes,
	showTags,
	period,
	from,
	to,
}: {
	transactions: Array<Money.Transaction> | undefined;
	categories: Array<Money.Category> | undefined;
	paymentTypes: Array<Money.PaymentType> | undefined;
	showTags: boolean;
	period?: string;
	from: string;
	to: string;
}) {
	const queryClient = useQueryClient();
	const [openedTransactions, setOpenedTransactions] = useState(new Set<number>());
	const [quickUpdateId, setQuickUpdateId] = useState<number>(0);

	const methods = useForm<QuickEditInputs>();
	const { setValue, handleSubmit } = methods;

	const updateMutation = useMutation({
		mutationFn: quickSaveTransaction,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["money", "transactions", from, to] });
			setQuickUpdateId(0);
		},
	});

	function toggleDetails(rowId: number) {
		setOpenedTransactions((prev) => {
			const next = new Set(prev);
			if (next.has(rowId)) {
				next.delete(rowId);
			} else {
				next.add(rowId);
			}
			return next;
		});
	}

	function quickUpdateTransaction(transactionId: number) {
		setQuickUpdateId(transactionId);
		let transaction: Money.Transaction | null = null;
		if (transactions) {
			for (const t of transactions) {
				if (t.id === transactionId) {
					transaction = t;
				} else if (t?.children.length) {
					const child = t?.children.find((c) => c.id === transactionId);
					if (child) {
						transaction = child;
					}
				}
			}
		}

		if (transaction) {
			setValue("id", transactionId);
			setValue("name", transaction.name);
			setValue("description", transaction.description);
			setValue("amount", transaction.amount);
			setValue("categoryId", transaction.categoryId);
			setValue("paymentTypeId", transaction.paymentTypeId);
		}
	}

	const onSubmit: SubmitHandler<QuickEditInputs> = (data) => {
		updateMutation.mutate(data);
	};

	let previousWeek = -1;
	let totalAmount = 0;

	return (
		<FormProvider {...methods}>
			<form onSubmit={handleSubmit(onSubmit)}>
				<MutationError error={updateMutation.error} />
				<table className="list transactions alternate">
					<thead>
						<tr>
							<th className="left-actions"></th>
							<th className="date" colSpan={2}>
								Date
							</th>
							<th className="transaction">Transaction</th>
							<th className="amount">Montant</th>
							<th className="category">Catégorie</th>
							<th className="paiement">Paiement</th>
							<th className="right-actions">Actions</th>
						</tr>
					</thead>
					<tbody>
						{transactions?.map((transaction, index) => {
							const hasChildren = transaction.children.length > 0;
							const expanded = hasChildren && openedTransactions.has(transaction.id);
							const recurrent = Boolean(transaction.recurrent);

							const rawCategories = [];
							if (hasChildren && !expanded) {
								rawCategories.push(
									...transaction.children.flatMap(({ category }) => category).filter(Boolean),
								);
							} else if (transaction.category) {
								rawCategories.push(transaction.category);
							}

							const rawPaymentTypes = [];
							if (hasChildren && !expanded) {
								rawPaymentTypes.push(
									...transaction.children.flatMap(({ paymentType }) => paymentType).filter(Boolean),
								);
							} else if (transaction.paymentType) {
								rawPaymentTypes.push(transaction.paymentType);
							}

							const rawTags = [];
							if (hasChildren && !expanded) {
								rawTags.push(...transaction.children.flatMap(({ tags }) => tags).filter(Boolean));
							} else if (transaction.tags.length) {
								rawTags.push(...transaction.tags);
							}

							// Split des semaines
							const week = Temporal.PlainDate.from(transaction.date).weekOfYear ?? 0;
							const newWeek = previousWeek !== week && index !== 0 ? " new_week" : "";
							previousWeek = week;

							// Calcul du total du mois
							if (hasChildren) {
								totalAmount = transaction.children.reduce((total, child) => {
									return total + child.amount;
								}, totalAmount);
							} else {
								if (!transaction.informative) {
									totalAmount += transaction.amount;
								}
							}

							const categoriesToDisplay = [
								...new Map(rawCategories.map((item) => [item.id, item])).values(),
							];
							const paymentTypesToDisplay = [
								...new Map(rawPaymentTypes.map((item) => [item.id, item])).values(),
							];
							const tagsToDisplay = [...new Map(rawTags.map((item) => [item.id, item])).values()];
							const editInProgress = quickUpdateId === transaction.id;

							return (
								<TransactionRow
									key={transaction.id}
									transaction={transaction}
									hasChildren={hasChildren}
									expanded={expanded}
									recurrent={recurrent}
									newWeek={newWeek}
									editInProgress={editInProgress}
									quickUpdateId={quickUpdateId}
									showTags={showTags}
									categories={categories}
									paymentTypes={paymentTypes}
									categoriesToDisplay={categoriesToDisplay}
									paymentTypesToDisplay={paymentTypesToDisplay}
									tagsToDisplay={tagsToDisplay}
									period={period}
									onToggleExpand={toggleDetails}
									onQuickEdit={quickUpdateTransaction}
								/>
							);
						})}
					</tbody>
					<tfoot>
						<tr>
							<th></th>
							<th colSpan={2}></th>
							<th>{transactions?.length} transactions</th>
							<th className={getAmountClassName(totalAmount)}>{totalAmount.toFixed(2)}&nbsp;€</th>
							<th></th>
							<th></th>
						</tr>
					</tfoot>
				</table>
			</form>
		</FormProvider>
	);
}
