import {
	ReadingSchema,
	ReadingModelItem,
	type ReadingDetails,
	ReadingContextItem,
} from "@personal-tracker/shared/reading-book";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";

import { saveReading } from "../api";
import { ReadingFormItem } from "../render-reading-fn";
import { FrontReading } from "../types";
import { getReadingDuration } from "../utils";

const ReadingFormSchema = ReadingSchema.extend({
	details: z.array(
		z.object({
			id: z.string(),
			context: z.array(
				z.object({
					date: z.string(),
					tags: z.array(z.object({ value: z.string() })),
				}),
			),
		}),
	),
	quick: z.object({
		date: z.iso.date().optional(),
		contextTag: z.string().optional(),
	}),
});
const ReadingFormSchemaTransformation = ReadingFormSchema.transform((data) => {
	const { quick, ...formData } = data;
	const details = (data.details ?? [])
		.map((detail) => ({
			...detail,
			context: [...(detail.context ?? [])].map((contextItem) => ({
				...contextItem,
				tags: contextItem.tags.map((tag) => tag.value),
			})),
		}))
		.filter((detail) => detail.context.length > 0);
	return {
		...formData,
		details,
	};
});

export function ReadingForm({
	bookId,
	model,
	reading,
	index,
}: {
	bookId: string;
	model: Array<ReadingModelItem>;
	reading: z.infer<typeof ReadingSchema>;
	index: number;
}) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const location = useLocation();
	const saveReadingMutation = useMutation({
		mutationFn: saveReading,
		onSuccess: () => {
			methods.reset();
			queryClient.invalidateQueries({ queryKey: ["reading", "books", bookId] });
		},
	});

	const [showQuickInput, setShowQuickInput] = useState(false);

	const isEditable = reading.status === "in-progress";
	const mapReadingContext: FrontReading.MapReadingContext = new Map<string, Array<ReadingContextItem>>();
	reading.details.forEach((item: ReadingDetails) => {
		mapReadingContext.set(item.id, item.context);
	});

	const dateString = getReadingDuration({ details: reading.details });

	// Browse model to build array of values needed for form
	const formValues: Array<any> = [];
	function browseModel(items: Array<any>, path: Array<string> = []) {
		items.forEach((item) => {
			const currentPath = [...path, item.id];
			if (item.content) {
				browseModel(item.content, currentPath);
			} else {
				formValues.push({
					id: item.id,
					context: (mapReadingContext.get(item.id) ?? []).map(
						({ date, tags }: { date: string; tags: string[] }) => ({
							date,
							tags: tags.map((tag: string) => ({ value: tag })),
						}),
					),
				});
			}
		});
	}
	browseModel(model);

	const methods = useForm<z.Infer<typeof ReadingFormSchema>>({
		values: {
			id: reading.id,
			status: reading.status,
			details: formValues,
			quick: {},
		},
	});
	function onSubmit(data: any) {
		const dataToSend = ReadingFormSchemaTransformation.parse(data);
		saveReadingMutation.mutate({
			id: bookId,
			reading: dataToSend,
		});
	}

	return (
		<div className="card_item">
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<FormProvider {...methods}>
					<div className="sticky-helper">
						{showQuickInput && (
							<>
								<i className="fa-solid fa-crosshairs"></i> Saisie rapide&nbsp;
								<input type="date" {...methods.register("quick.date")} />
								<input
									type="text"
									{...methods.register("quick.contextTag")}
									placeholder="Context tag"
								/>
								<button type="submit" title="Enregistrer" disabled={saveReadingMutation.isPending}>
									<i className="fa-regular fa-floppy-disk"></i>
								</button>
							</>
						)}
						<button
							type="button"
							onClick={() => setShowQuickInput(!showQuickInput)}
							title={showQuickInput ? "Masquer la saisie rapide" : "Activer la saisie rapide"}
						>
							<i className="fa-solid fa-crosshairs"></i>
						</button>
					</div>
					<h3>
						Lecture #{index + 1}{" "}
						{isEditable && !showQuickInput && (
							<button type="submit" title="Enregistrer" disabled={saveReadingMutation.isPending}>
								<i className="fa-regular fa-floppy-disk"></i>
							</button>
						)}{" "}
						{isEditable && (
							<>
								<button
									type="button"
									title="Supprimer"
									onClick={() =>
										navigate({
											to: "/reading-book/book/$bookId/reading/$readingId/delete",
											params: { bookId, readingId: reading.id },
											search: { returnTo: location.pathname },
										})
									}
								>
									<i className="fa-regular fa-trash-can"></i>
								</button>
							</>
						)}
					</h3>

					<p>{dateString}</p>
					<p>
						Statut :{" "}
						{isEditable ? (
							<select {...methods.register("status")}>
								<option value="in-progress">En cours</option>
								<option value="complete">Fini</option>
								<option value="abandoned">Abandonné</option>
							</select>
						) : (
							reading.status
						)}
					</p>

					<ul className="book-tree root">
						<li>
							<details open>
								<summary>Table des matières</summary>
								<ul>
									{model?.map((readingModel) => (
										<ReadingFormItem
											key={readingModel.id}
											modelItem={readingModel}
											mapReadingContext={mapReadingContext}
											status={reading.status}
											formValues={formValues}
											showQuickInput={showQuickInput}
										/>
									))}
								</ul>
							</details>
						</li>
					</ul>
				</FormProvider>
			</form>
		</div>
	);
}
