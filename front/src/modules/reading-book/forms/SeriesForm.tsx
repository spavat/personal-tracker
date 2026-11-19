import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { type Control, Controller, useFieldArray, useForm, type UseFormRegister, useWatch } from "react-hook-form";

import Modal from "../../../components/Modal";
import MutationError from "../../../components/MutationError";
import SearchSelect from "../../../components/SearchSelect";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { allBooksQuery, saveSeries, seriesDetailsQuery, seriesListQuery } from "../api";
import { ancestorIds, nextSeriesLabel } from "./SeriesForm.utils";

type ItemKind = "book" | "series";
type SeriesFormData = {
	title: string;
	// the direct items of the series, in its order: a book or a sub-series (refId)
	items: Array<{ kind: ItemKind; refId: string; positionLabel: string }>;
};

export default function SeriesForm({ seriesId, returnTo }: { seriesId?: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const series = useOptionalSuspenseQuery(seriesId ? seriesDetailsQuery(seriesId) : undefined);
	const { data: allBooks = [] } = useQuery(allBooksQuery());
	const { data: allSeries = [] } = useQuery(seriesListQuery());

	const {
		control,
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<SeriesFormData>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: {
			title: series?.title ?? "",
			items:
				series?.items.map((item) => ({
					kind: item.kind,
					refId: item.kind === "book" ? item.book.id : item.series.id,
					positionLabel: item.positionLabel ?? "",
				})) ?? [],
		},
	});
	const { fields, append, remove, move } = useFieldArray({ control, name: "items" });
	const rows = useWatch({ control, name: "items" });

	// a book or a sub-series is only once in a series; a series can't hold itself nor a series holding it
	const pickedIds = (kind: ItemKind, index: number) =>
		new Set(rows.filter((row, i) => row.kind === kind && i !== index).map((row) => row.refId));
	const notHoldable = seriesId ? new Set([seriesId, ...ancestorIds(seriesId, allSeries)]) : new Set<string>();
	function choices(kind: ItemKind, index: number) {
		const picked = pickedIds(kind, index);
		return kind === "book"
			? allBooks.filter((book) => !picked.has(book.id)).map((book) => ({ id: book.id, name: book.book }))
			: allSeries
					.filter((item) => !picked.has(item.id) && !notHoldable.has(item.id))
					.map((item) => ({ id: item.id, name: item.title }));
	}

	function addItem(kind: ItemKind) {
		append(
			{ kind, refId: "", positionLabel: nextSeriesLabel(rows.map((row) => row.positionLabel)) },
			// the picker of the new row, not its label
			{ focusName: `items.${fields.length}.refId` },
		);
	}

	const saveMutation = useMutation({
		mutationFn: saveSeries,
		onSuccess: ({ id }) => {
			queryClient.invalidateQueries({ queryKey: ["reading"] });
			if (seriesId) {
				closeModal();
			} else {
				navigate({ to: "/reading-book/series/$seriesId", params: { seriesId: id }, replace: true });
			}
		},
	});

	function closeModal() {
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	function onSubmit(data: SeriesFormData) {
		saveMutation.mutate({
			id: seriesId,
			series: {
				title: data.title.trim(),
				// a row left without book or series is dropped
				items: data.items
					.filter(({ refId }) => refId)
					.map(({ kind, refId, positionLabel }) => {
						const label = positionLabel.trim() || null;
						return kind === "book"
							? { kind, bookId: refId, positionLabel: label }
							: { kind, seriesId: refId, positionLabel: label };
					}),
			},
		});
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<Modal className={"modal form dialog-medium"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
				<div className="dialog-header">
					<h2 id="dialog-title">{seriesId ? "Modifier la série" : "Ajouter une série"}</h2>
				</div>
				<div className="dialog-body">
					<div className="panel">
						<h3>Général</h3>
						<div className="form-grid">
							<label className="form-field full-width">
								<span>
									Titre <span className="req">*</span>
								</span>
								<input
									{...register("title", { validate: (v) => v.trim() !== "" })}
									type="text"
									autoComplete="off"
								/>
								{errors.title && <span className="error">Le titre est obligatoire</span>}
							</label>
						</div>
					</div>
					<div className="panel">
						<h3>Contenu</h3>
						<DragDropProvider
							onDragEnd={(event) => {
								const { source } = event.operation ?? {};
								if (isSortable(source) && source.index !== source.initialIndex) {
									move(source.initialIndex, source.index);
								}
							}}
						>
							<ul className="series-books">
								{fields.map((field, index) => (
									<SeriesItemRow
										key={field.id}
										id={field.id}
										index={index}
										kind={field.kind}
										control={control}
										register={register}
										onRemove={() => remove(index)}
										choices={choices(field.kind, index)}
									/>
								))}
							</ul>
						</DragDropProvider>
						<div className="full-fields-row">
							<button type="button" onClick={() => addItem("book")}>
								<i className="fa-regular fa-plus"></i> Ajouter un livre
							</button>
							<button type="button" onClick={() => addItem("series")}>
								<i className="fa-regular fa-plus"></i> Ajouter une série
							</button>
						</div>
					</div>
				</div>
				<div className="dialog-footer">
					<MutationError error={saveMutation.error} />
					<button type="button" onClick={closeModal}>
						Annuler
					</button>
					<button type="submit" className="main" disabled={saveMutation.isPending}>
						Enregistrer
					</button>
				</div>
			</Modal>
		</form>
	);
}

// a book or a sub-series; its own items are edited on its page
function SeriesItemRow({
	id,
	index,
	kind,
	control,
	register,
	onRemove,
	choices,
}: {
	id: string;
	index: number;
	kind: ItemKind;
	control: Control<SeriesFormData>;
	register: UseFormRegister<SeriesFormData>;
	onRemove: () => void;
	choices: Array<{ id: string; name: string }>;
}) {
	const handleRef = useRef(null);
	const { ref } = useSortable({
		id: `series-item-${id}`,
		index,
		handle: handleRef,
		modifiers: [RestrictToVerticalAxis],
	});
	const what = kind === "book" ? "Livre" : "Série";

	return (
		<li ref={ref} className="full-fields-row">
			<i className="fa-solid fa-grip-vertical drag-handle" ref={handleRef} title="Déplacer"></i>
			<i className={kind === "book" ? "fa-solid fa-book" : "fa-solid fa-layer-group"} title={what}></i>
			<Controller
				control={control}
				name={`items.${index}.refId`}
				render={({ field: { value, onChange, ref } }) => (
					<SearchSelect
						inputRef={ref}
						items={choices}
						value={value}
						onChange={(refId) => onChange(refId ?? "")}
						emptyLabel={kind === "book" ? "Aucun livre" : "Aucune série"}
						aria-label={`${what} ${index + 1}`}
					/>
				)}
			/>
			<input
				type="text"
				{...register(`items.${index}.positionLabel`)}
				placeholder="N°"
				aria-label={`Numéro ${index + 1}`}
				className="series-label-input"
			/>
			<button type="button" onClick={onRemove} title="Retirer">
				<i className="fa-regular fa-trash-can"></i>
			</button>
		</li>
	);
}
