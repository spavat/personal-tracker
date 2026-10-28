import { Fragment } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import Badge from "../../components/badge";

interface Form {
	id: string;
	index: number;
	categories: Array<Money.Category>;
	paymentTypes: Array<Money.PaymentType>;
	tags: Array<Money.Tag>;
	removeChild: (index: number) => void;
}

export default function NewTransactionChildForm({ id, index, categories, paymentTypes, tags, removeChild }: Form) {
	const methods = useFormContext();
	const [childCategorieId, childPaymentTypeId, showChildComment] = useWatch({
		control: methods.control,
		name: [`children.${index}.categoryId`, `children.${index}.paymentTypeId`, "showChildComment"],
	});
	const childCategorie = categories?.find((c) => c.id === childCategorieId);
	const childPaymentType = paymentTypes?.find((pt) => pt.id === childPaymentTypeId);

	const { fields, append, remove } = useFieldArray({
		control: methods.control,
		name: `children.${index}.tags`,
		keyName: "_id",
	});

	return (
		<Fragment key={id}>
			<tr>
				<td>#{index + 1}</td>
				<td>
					<input {...methods.register(`children.${index}.name`)} />
				</td>
				<td>
					<input {...methods.register(`children.${index}.amount`, { valueAsNumber: true })} />
				</td>
				<td>
					<select {...methods.register(`children.${index}.categoryId`, { valueAsNumber: true })}>
						{categories.map((c) => {
							return (
								<option key={c.id} value={c.id}>
									{c.name}
								</option>
							);
						})}
					</select>
					{childCategorie && (
						<Badge
							name={childCategorie.name}
							icon={childCategorie.icon}
							backgroundColor={childCategorie.backgroundColor}
							color={childCategorie.textColor}
						/>
					)}
				</td>
				<td>
					<select {...methods.register(`children.${index}.paymentTypeId`, { valueAsNumber: true })}>
						{paymentTypes.map((pt) => {
							return (
								<option key={pt.id} value={pt.id}>
									{pt.name}
								</option>
							);
						})}
					</select>
					{childPaymentType && (
						<Badge
							name={childPaymentType.name}
							icon={childPaymentType.icon}
							backgroundColor={childPaymentType.backgroundColor}
							color={childPaymentType.textColor}
						/>
					)}
				</td>
				<td>
					<button type="button" onClick={() => removeChild(index)}>
						Supprimer
					</button>
				</td>
			</tr>
			{showChildComment && (
				<tr>
					<td></td>
					<td colSpan={2}>
						<textarea key={`comment-${id}`} {...methods.register(`children.${index}.comment`)}></textarea>
					</td>
					<td>
						<select multiple aria-label="tags">
							{tags
								.filter((tag) => !fields.find((t) => (t as any).id === tag.id)) // TODO fix as any
								.map((t) => {
									return (
										<option key={t.id} value={t.id} onDoubleClick={() => append(t)}>
											{t.name}
										</option>
									);
								})}
						</select>
					</td>
					<td>
						tags:{" "}
						{fields.map((f: any, i: number) => (
							<Badge
								key={f.id}
								name={f.name}
								icon={f.icon}
								backgroundColor={f.backgroundColor}
								color={f.textColor}
								onClick={() => remove(i)}
							/>
						))}
					</td>
				</tr>
			)}
		</Fragment>
	);
}
