import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Fragment } from "react";
import { useFormContext } from "react-hook-form";

import type { QuickEditInputs } from "./TransactionsTable";

import Badge from "../../../components/badge";
import { formatDate, formatDay } from "../../../utils";
import { getAmountClassName } from "../utils";
import TransactionChildRow from "./TransactionChildRow";

function TagBadges({ tags }: { tags: Array<Money.Tag> }) {
	return (
		<>
			{tags
				.toSorted((a, b) => a.name.localeCompare(b.name))
				.map((t) => (
					<Badge
						key={t.id}
						name={t.name}
						icon={t.icon}
						backgroundColor={t.backgroundColor}
						color={t.textColor}
					/>
				))}
		</>
	);
}

export default function TransactionRow({
	transaction,
	hasChildren,
	expanded,
	recurrent,
	newWeek,
	editInProgress,
	quickUpdateId,
	showTags,
	categories,
	paymentTypes,
	categoriesToDisplay,
	paymentTypesToDisplay,
	tagsToDisplay,
	period,
	onToggleExpand,
	onQuickEdit,
}: {
	transaction: Money.Transaction;
	hasChildren: boolean;
	expanded: boolean;
	recurrent: boolean;
	newWeek: string;
	editInProgress: boolean;
	quickUpdateId: number;
	showTags: boolean;
	categories: Array<Money.Category> | undefined;
	paymentTypes: Array<Money.PaymentType> | undefined;
	categoriesToDisplay: Array<Money.Category>;
	paymentTypesToDisplay: Array<Money.PaymentType>;
	tagsToDisplay: Array<Money.Tag>;
	period?: string;
	onToggleExpand: (id: number) => void;
	onQuickEdit: (id: number) => void;
}) {
	const navigate = useNavigate();
	const location = useLocation();
	const { register } = useFormContext<QuickEditInputs>();

	// Build link
	let linkOptions: any = {
		to: "/money/transactions/$period/transaction/$transactionId/edit",
		params: {
			period: period ?? "",
			transactionId: String(transaction.id),
		},
		search: { returnTo: location.pathname },
		replace: true,
		resetScroll: false,
		mask: {
			to: "/money/transactions/$period",
			params: {
				period: period ?? "",
			},
		},
	};
	if (!period) {
		linkOptions = {
			to: "/money/transactions/search/transaction/$transactionId/edit",
			params: {
				transactionId: String(transaction.id),
			},
			search: {
				returnTo: location.pathname,
				returnToSearch: { ...location.search, abc: "def" },
				...location.search,
			},
			replace: true,
			resetScroll: false,
		};
	}

	return (
		<Fragment>
			<tr className={`${newWeek} ${editInProgress ? "edit" : ""}`}>
				<td>
					{hasChildren ? (
						<button
							type="button"
							className="expand"
							onClick={() => onToggleExpand(transaction.id)}
							aria-label={expanded ? "Collapse transaction" : "Expand transaction"}
						>
							{expanded ? (
								<i className="fa-solid fa-chevron-down"></i>
							) : (
								<i className="fa-solid fa-chevron-right"></i>
							)}
						</button>
					) : (
						""
					)}
				</td>
				<td>{formatDay(transaction.date)}</td>
				<td>{formatDate(transaction.date)}</td>
				<td>
					{recurrent && (
						<>
							<i className="fa-solid fa-rotate"></i>&nbsp;
						</>
					)}
					{editInProgress ? (
						<>
							<input type="text" {...register("name", { required: true })} aria-label="name" /> -{" "}
							<input type="text" {...register("description")} aria-label="description" />
						</>
					) : (
						<>
							<Link
								to="/money/transaction/$transactionId"
								params={{ transactionId: String(transaction.id) }}
							>
								{transaction.name}
							</Link>{" "}
							{transaction.description && (
								<span className="description">- {transaction.description}</span>
							)}
							{transaction.comment && (
								<>
									<span
										className="tooltip-anchor"
										style={{ anchorName: `--comment-${transaction.id}` }}
									>
										📋
									</span>
									<span
										className="tooltip-content"
										style={{ positionAnchor: `--comment-${transaction.id}` }}
									>
										{transaction.comment}
									</span>
								</>
							)}{" "}
							{showTags && <TagBadges tags={tagsToDisplay} />}
						</>
					)}
				</td>
				<td className={getAmountClassName(transaction.amount, transaction)}>
					{editInProgress ? (
						<input type="text" {...register("amount", { valueAsNumber: true })} aria-label="amount" />
					) : (
						<>{transaction.amount}&nbsp;€</>
					)}
				</td>
				<td>
					{editInProgress && !hasChildren ? (
						<select {...register("categoryId", { valueAsNumber: true })} aria-label="category">
							<option value={0}></option>
							{categories?.map((c) => (
								<option key={c.id} value={c.id} selected={c.id === transaction.categoryId}>
									{c.name}
								</option>
							))}
						</select>
					) : (
						categoriesToDisplay.map((cat) => (
							<Badge
								key={cat.id}
								name={cat.name}
								icon={cat.icon}
								backgroundColor={cat.backgroundColor}
								color={cat.textColor}
							/>
						))
					)}
				</td>
				<td>
					{editInProgress && !hasChildren ? (
						<select {...register("paymentTypeId", { valueAsNumber: true })} aria-label="payment type">
							<option value={0}></option>
							{paymentTypes?.map((c) => (
								<option key={c.id} value={c.id} selected={c.id === transaction.paymentTypeId}>
									{c.name}
								</option>
							))}
						</select>
					) : (
						paymentTypesToDisplay.map((pt) => (
							<Badge
								key={pt.id}
								name={pt.name}
								icon={pt.icon}
								backgroundColor={pt.backgroundColor}
								color={pt.textColor}
							/>
						))
					)}
				</td>
				<td>
					{editInProgress ? (
						<>
							<button key="valid-changes" type="submit" aria-label="Save changes">
								<i className="fa-solid fa-check"></i>
							</button>
							&nbsp;
							<button
								key="cancel-changes"
								type="button"
								onClick={() => onQuickEdit(0)}
								aria-label="Cancel changes"
							>
								<i className="fa-solid fa-ban"></i>
							</button>
							&nbsp;
						</>
					) : (
						<>
							<button
								key="quick-edit"
								type="button"
								onClick={() => onQuickEdit(transaction.id)}
								aria-label="Quick edit transaction"
							>
								<i className="fa-solid fa-pencil"></i>
							</button>
							&nbsp;
							<button
								key="edit"
								type="button"
								onClick={() => navigate(linkOptions)}
								aria-label="Edit transaction"
							>
								<i className="fa-regular fa-pen-to-square"></i>
							</button>
							&nbsp;
							<button
								key="delete-transaction"
								type="button"
								onClick={() =>
									navigate({
										to: "/money/transactions/$period/transaction/$transactionId/delete",
										params: {
											period: period ?? "",
											transactionId: String(transaction.id),
										},
										search: { returnTo: location.pathname },
										replace: true,
										resetScroll: false,
										mask: {
											to: "/money/transactions/$period",
											params: {
												period: period ?? "",
											},
										},
									})
								}
								aria-label="Delete transaction"
							>
								<i className="fa-regular fa-trash-can"></i>
							</button>
							&nbsp;
						</>
					)}
				</td>
			</tr>
			{hasChildren &&
				transaction.children.map((child) => (
					<TransactionChildRow
						key={child.id}
						child={child}
						parentTransaction={transaction}
						expanded={expanded}
						editInProgress={quickUpdateId === child.id}
						categories={categories}
						paymentTypes={paymentTypes}
						onQuickEdit={onQuickEdit}
					/>
				))}
		</Fragment>
	);
}
