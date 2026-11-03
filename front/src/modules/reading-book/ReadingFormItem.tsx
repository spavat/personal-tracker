import { ReadingModelItem } from "@personal-tracker/shared/reading-book";
import { useFieldArray, useFormContext } from "react-hook-form";

import { formatFullDate } from "../../utils";
import { FrontReading } from "./types";
import { getReadingDurationFromDates, getReadingIcons } from "./utils";

type ItemProps = {
	modelItem: ReadingModelItem;
	mapReadingContext: FrontReading.MapReadingContext;
	status: string;
	formValues: any[];
	showQuickInput: boolean;
};

function getDatesFormModel(
	modelItem: ReadingModelItem,
	mapReadingContext: FrontReading.MapReadingContext,
): Array<string> {
	if (!modelItem.content) {
		const context = mapReadingContext.get(modelItem.id);
		return context?.map(({ date }: { date: string; tags: string[] }) => date) ?? [];
	} else {
		return modelItem.content
			.map((subItem) => {
				return getDatesFormModel(subItem, mapReadingContext);
			})
			.flat();
	}
}

export function ReadingFormItem({ modelItem, mapReadingContext, status, formValues, showQuickInput }: ItemProps) {
	if (modelItem.content && modelItem.content.length > 0) {
		return (
			<ReadingFormItemNode
				modelItem={modelItem}
				mapReadingContext={mapReadingContext}
				status={status}
				formValues={formValues}
				showQuickInput={showQuickInput}
			/>
		);
	} else {
		return (
			<ReadingFormItemLeaf
				modelItem={modelItem}
				mapReadingContext={mapReadingContext}
				status={status}
				formValues={formValues}
				showQuickInput={showQuickInput}
			/>
		);
	}
}

function ReadingFormItemNode({ modelItem, mapReadingContext, status, formValues, showQuickInput }: ItemProps) {
	const content = modelItem.content ?? [];
	const dates: Array<string> = content.reduce((acc: Array<string>, item) => {
		acc.push(...getDatesFormModel(item, mapReadingContext));
		return acc;
	}, []);
	const duration = getReadingDurationFromDates(dates);

	if (status === "abandoned") {
		// Display the node only if content has some dates, otherwise it means that the node was not started and should not be displayed in the form
		if (dates.length === 0) {
			return null;
		}
	}

	return (
		<li>
			<details open>
				<summary>
					<b>{modelItem.title}</b> {duration}
				</summary>
				<ul>
					{content.map((item) => (
						<ReadingFormItem
							key={item.id}
							modelItem={item}
							mapReadingContext={mapReadingContext}
							status={status}
							formValues={formValues}
							showQuickInput={showQuickInput}
						/>
					))}
				</ul>
			</details>
		</li>
	);
}

function ReadingFormItemLeaf({ modelItem, mapReadingContext, status, formValues, showQuickInput }: ItemProps) {
	const pos = (formValues ?? []).findIndex((v) => v.id === modelItem.id) ?? -1;
	const contextKey = `details.${pos}.context`;
	const { control, getValues } = useFormContext();
	const { fields, append, replace, remove } = useFieldArray({ control, name: contextKey });
	const context = mapReadingContext.get(modelItem.id);

	function applyQuickInput() {
		replace({
			date: getValues("quick.date"),
			tags: [{ value: getValues("quick.contextTag") }],
		});
	}

	if (!context) {
		if (status === "in-progress") {
			return (
				<li>
					{showQuickInput && (
						<>
							<button
								type="button"
								onClick={() => applyQuickInput()}
								title="Appliquer le contexte rapide"
							>
								<i className="fa-solid fa-crosshairs"></i>
							</button>{" "}
						</>
					)}
					<span>{modelItem.title}</span>{" "}
					{fields.map((field, index: number) => {
						return (
							<ReadingFormItemLeafContext
								key={field.id}
								nestedKey={contextKey}
								index={index}
								remove={() => remove(index)}
							/>
						);
					})}{" "}
					<button
						type="button"
						onClick={() => append({ date: "", tags: [{ value: "" }] })}
						title="Ajouter un contexte"
					>
						<i className="fa-regular fa-calendar"></i>
					</button>
					<br />
				</li>
			);
		} else if (status === "complete") {
			return (
				<li>
					<span>{modelItem.title}</span> <br />
				</li>
			);
		} else {
			return <></>;
		}
	}

	const datedToShow = context
		.map(({ date, tags }: { date: string; tags: string[] }) => {
			return formatFullDate(date) + " " + getReadingIcons(tags ?? [], { displayIcon: true });
		})
		.join(", ");

	return (
		<li>
			<span>
				{modelItem.title} : {datedToShow}
			</span>{" "}
			<br />
		</li>
	);
}

function ReadingFormItemLeafContext({
	nestedKey,
	index,
	remove,
}: {
	nestedKey: string;
	index: number;
	remove: () => void;
}) {
	const { control, register } = useFormContext();
	const { fields, append } = useFieldArray({
		control,
		name: `${nestedKey}.${index}.tags`,
	});
	return (
		<div>
			<button type="button" onClick={() => remove()} title="Supprimer le contexte">
				<i className="fa-regular fa-trash-can"></i>
			</button>
			<input type="date" {...register(`${nestedKey}.${index}.date`)} />
			{fields.map((field, i: number) => (
				<input
					key={field.id}
					type="text"
					className="tag"
					placeholder="Tag"
					{...register(`${nestedKey}.${index}.tags.${i}.value`)}
				/>
			))}
			<button type="button" onClick={() => append({ value: "" })} title="Ajouter un tag">
				<i className="fa-solid fa-tag"></i>
			</button>
		</div>
	);
}
