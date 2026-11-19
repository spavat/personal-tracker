import type { Category, PaymentType, Transaction, TransactionChild } from "@personal-tracker/shared/money";

import { useFormContext } from "react-hook-form";

import type { QuickEditInputs } from "./TransactionsTable";

import Badge from "../../../components/Badge";
import { getAmountClassName } from "../utils";

export default function TransactionChildRow({
	child,
	parentTransaction,
	expanded,
	editInProgress,
	categories,
	paymentTypes,
	onQuickEdit,
}: {
	child: TransactionChild;
	parentTransaction: Transaction;
	expanded: boolean;
	editInProgress: boolean;
	categories: Array<Category> | undefined;
	paymentTypes: Array<PaymentType> | undefined;
	onQuickEdit: (id: number) => void;
}) {
	const { register } = useFormContext<QuickEditInputs>();
	const childCategory = child.category;
	const childPaymentType = child.paymentType;

	return (
		<tr id={`transaction-${child.id}`} className={`${expanded ? "" : "hidden"} ${editInProgress ? "edit" : ""}`}>
			<td></td>
			<td></td>
			<td className="cell-text">
				{editInProgress ? (
					<>
						<i className="fa-solid fa-caret-right"></i>
						<input type="text" {...register("name", { required: true })} />
					</>
				) : (
					<>
						<i className="fa-solid fa-caret-right"></i> {child.name}
					</>
				)}
			</td>
			<td className={`cell-number ${getAmountClassName(child.amount, parentTransaction)}`}>
				{editInProgress ? (
					<input type="text" {...register("amount", { valueAsNumber: true })} />
				) : (
					<>{child.amount}&nbsp;€</>
				)}
			</td>
			<td className="cell-text">
				{editInProgress ? (
					<select {...register("categoryId", { valueAsNumber: true })}>
						<option value={0}></option>
						{categories?.map((c) => (
							<option key={c.id} value={c.id} selected={c.id === child.categoryId}>
								{c.name}
							</option>
						))}
					</select>
				) : (
					childCategory && (
						<Badge
							key={childCategory.id}
							name={childCategory.name}
							icon={childCategory.icon}
							backgroundColor={childCategory.backgroundColor}
							color={childCategory.textColor}
						/>
					)
				)}
			</td>

			<td className="cell-text">
				{editInProgress ? (
					<select {...register("paymentTypeId", { valueAsNumber: true })}>
						<option value={0}></option>
						{paymentTypes?.map((c) => (
							<option key={c.id} value={c.id} selected={c.id === child.paymentTypeId}>
								{c.name}
							</option>
						))}
					</select>
				) : (
					childPaymentType && (
						<Badge
							key={childPaymentType.id}
							name={childPaymentType.name}
							icon={childPaymentType.icon}
							backgroundColor={childPaymentType.backgroundColor}
							color={childPaymentType.textColor}
						/>
					)
				)}
			</td>
			<td>
				{editInProgress ? (
					<>
						<button key="valid-child-changes" type="submit" title="Enregistrer">
							<i className="fa-solid fa-check"></i>
						</button>
						&nbsp;
						<button key="cancel-child-changes" type="button" onClick={() => onQuickEdit(0)} title="Annuler">
							<i className="fa-solid fa-ban"></i>
						</button>
						&nbsp;
					</>
				) : (
					<>
						<button
							key="quick-child-edit"
							type="button"
							onClick={() => onQuickEdit(child.id)}
							title="Modifier"
						>
							<i className="fa-solid fa-pencil"></i>
						</button>
						&nbsp;
					</>
				)}
			</td>
		</tr>
	);
}
