import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { type SubmitHandler, type UseFormRegister, useFieldArray, useForm } from "react-hook-form";

import Modal from "../../../components/Modal";
import MutationError from "../../../components/MutationError";
import { programDetailsQuery, saveFormats, saveSeasons } from "../api";

interface Inputs {
	items: Array<{ id?: string; label: string; match: string }>;
}

const TEXTS = {
	seasons: { title: "Saisons", add: "Ajouter une saison", placeholder: "Saison 1, 2024-2025…" },
	formats: { title: "Formats", add: "Ajouter un format", placeholder: "Vlog, Review…" },
};

// The ordered list of a program's seasons (time grouping) or formats (kind grouping, with a title match rule
// pre-selecting it). An item removed leaves its episodes without season / format.
export default function GroupsModalForm({
	programId,
	kind,
	returnTo,
}: {
	programId: string;
	kind: "seasons" | "formats";
	returnTo: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data } = useSuspenseQuery(programDetailsQuery(programId));
	const texts = TEXTS[kind];

	const { control, register, handleSubmit, formState } = useForm<Inputs>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: {
			items:
				kind === "seasons"
					? data.seasons.map(({ id, label }) => ({ id, label, match: "" }))
					: data.formats.map(({ id, label, match }) => ({ id, label, match: match ?? "" })),
		},
	});
	const { fields, append, remove, move } = useFieldArray({ control, name: "items" });

	const saveMutation = useMutation({
		mutationFn: ({ items }: Inputs) =>
			kind === "seasons"
				? saveSeasons(programId, { seasons: items.map(({ id, label }) => ({ id, label })) })
				: saveFormats(programId, {
						formats: items.map(({ id, label, match }) => ({ id, label, match: match.trim() || null })),
					}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["program", programId] });
			closeModal();
		},
	});

	function closeModal() {
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	const onSubmit: SubmitHandler<Inputs> = (inputs) => saveMutation.mutate(inputs);

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<Modal className="form modal dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
				<div className="dialog-header">
					<h2 id="dialog-title">{texts.title}</h2>
				</div>
				<div className="dialog-body">
					<div className="panel">
						<DragDropProvider
							onDragEnd={(event) => {
								const { source } = event.operation ?? {};
								if (isSortable(source) && source.index !== source.initialIndex) {
									move(source.initialIndex, source.index);
								}
							}}
						>
							<ul className="group-items">
								{fields.map((field, index) => (
									<GroupRow
										key={field.id}
										id={field.id}
										index={index}
										withMatch={kind === "formats"}
										placeholder={texts.placeholder}
										register={register}
										onRemove={() => remove(index)}
									/>
								))}
							</ul>
						</DragDropProvider>
						{formState.errors.items && <span className="error">Chaque élément a un nom</span>}
						<button type="button" onClick={() => append({ label: "", match: "" })}>
							<i className="fa-regular fa-plus"></i> {texts.add}
						</button>
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

function GroupRow({
	id,
	index,
	withMatch,
	placeholder,
	register,
	onRemove,
}: {
	id: string;
	index: number;
	withMatch: boolean;
	placeholder: string;
	register: UseFormRegister<Inputs>;
	onRemove: () => void;
}) {
	const handleRef = useRef(null);
	const { ref } = useSortable({
		id: `group-item-${id}`,
		index,
		handle: handleRef,
		modifiers: [RestrictToVerticalAxis],
	});

	return (
		<li ref={ref} className="full-fields-row">
			<i className="fa-solid fa-grip-vertical drag-handle" ref={handleRef} title="Déplacer"></i>
			<input
				type="text"
				{...register(`items.${index}.label`, { validate: (value) => value.trim() !== "" })}
				placeholder={placeholder}
				aria-label={`Nom ${index + 1}`}
			/>
			{withMatch && (
				<input
					type="text"
					{...register(`items.${index}.match`, {
						validate: (value) => {
							try {
								new RegExp(value);
								return true;
							} catch {
								return false;
							}
						},
					})}
					placeholder="Titre contenant (regex)"
					aria-label={`Règle ${index + 1}`}
				/>
			)}
			<button type="button" onClick={onRemove} title="Supprimer">
				<i className="fa-regular fa-trash-can"></i>
			</button>
		</li>
	);
}
