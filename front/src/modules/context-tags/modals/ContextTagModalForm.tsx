import { ContextTag } from "@personal-tracker/shared/context-tag";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { SubmitHandler, useFieldArray, useForm } from "react-hook-form";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { contextTagsQuery, save } from "../api";

type ContextTagFormInputs = {
	name: string;
	tags: Array<{ value: string }>;
};

const defaultValues: ContextTagFormInputs = {
	name: "",
	tags: [{ value: "" }],
};

export default function ContextTagModalForm({ id, returnTo }: { id?: string; returnTo: string }) {
	const isEdit = Boolean(id);
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const contextTags = useOptionalSuspenseQuery(isEdit ? contextTagsQuery() : undefined);
	const contextTag = contextTags?.find((c) => c.id === id);

	const {
		control,
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<ContextTagFormInputs>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: contextTag
			? {
					name: contextTag.name,
					tags: contextTag.tags.map((tag) => ({ value: tag })),
				}
			: defaultValues,
	});

	const { fields, append, remove } = useFieldArray({ control, name: "tags" });

	const saveMutation = useMutation({
		mutationFn: save,
		onSuccess: () => {
			reset(defaultValues);
			queryClient.invalidateQueries({ queryKey: ["context-tags"] });
			closeModal();
		},
	});

	function closeModal() {
		reset(defaultValues);
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	const onSubmit: SubmitHandler<ContextTagFormInputs> = (data) => {
		const payload: Partial<ContextTag> = {
			...(id ? { id } : {}),
			name: data.name,
			tags: data.tags.flatMap((tag) => (tag.value ? [tag.value] : [])),
		};
		saveMutation.mutate(payload);
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
				<div className="dialog-header">
					<h2 id="dialog-title">{isEdit ? "Modifier le tag principal" : "Ajouter un tag principal"}</h2>
				</div>

				<div className="dialog-body">
					<div className="form-grid">
						<label className="form-field full-width">
							<span>Nom</span>
							<input type="text" autoComplete="off" {...register("name", { required: true })} />
							{errors.name && <span className="error">Le nom est obligatoire</span>}
						</label>

						<label className="form-field full-width">
							<span>Tags</span>
							{fields.map((field, index) => (
								<div key={field.id} className="full-fields-row">
									<input
										type="text"
										autoComplete="off"
										{...register(`tags.${index}.value` as const, {
											validate: (value, form) =>
												!value || form.tags.filter((tag) => tag.value === value).length === 1,
										})}
										className="flex"
									/>
									{(index !== 0 || fields.length > 1) && (
										<button type="button" onClick={() => remove(index)} title="Supprimer">
											<i className="fa-regular fa-trash-can"></i>
										</button>
									)}
									{index === fields.length - 1 && (
										<button type="button" onClick={() => append({ value: "" })} title="Ajouter">
											<i className="fa-regular fa-plus"></i>
										</button>
									)}
								</div>
							))}
							{errors.tags && <span className="error">Ce tag est en double</span>}
						</label>
					</div>
				</div>

				<div className="dialog-footer">
					<MutationError error={saveMutation.error} />
					<button type="button" onClick={closeModal}>
						Annuler
					</button>
					<button type="submit" className="main" disabled={saveMutation.isPending}>
						{saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
					</button>
				</div>
			</Modal>
		</form>
	);
}
