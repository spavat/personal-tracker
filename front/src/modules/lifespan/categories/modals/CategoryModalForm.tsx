import { LifespanCategory } from "@personal-tracker/shared/lifespan";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { SubmitHandler, useForm } from "react-hook-form";

import Modal from "../../../../components/modal";
import MutationError from "../../../../components/mutation-error";
import { categoriesQuery, saveCategory } from "../../api";

type CategoryFormInputs = {
	name: string;
	parentId: string;
};

const defaultValues: CategoryFormInputs = {
	name: "",
	parentId: "",
};

export default function CategoryModalForm({ id, returnTo }: { id?: string; returnTo: string }) {
	const isEdit = Boolean(id);
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: categories } = useSuspenseQuery(categoriesQuery());
	const category = categories.find((c) => c.id === id);

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<CategoryFormInputs>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: category
			? {
					name: category.name,
					parentId: category.parentId ?? "",
				}
			: defaultValues,
	});

	const saveMutation = useMutation({
		mutationFn: saveCategory,
		onSuccess: () => {
			reset(defaultValues);
			queryClient.invalidateQueries({ queryKey: ["lifespan", "categories"] });
			closeModal();
		},
	});

	function closeModal() {
		reset(defaultValues);
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	const onSubmit: SubmitHandler<CategoryFormInputs> = (data) => {
		const payload: Partial<LifespanCategory> = {
			...(id ? { id } : {}),
			name: data.name,
			parentId: data.parentId || null,
		};
		saveMutation.mutate(payload);
	};

	// a category cannot be its own parent, nor its own descendant's parent
	const excludedIds = new Set(id ? [id] : []);
	let found = true;
	while (found) {
		found = false;
		for (const c of categories) {
			if (c.parentId && excludedIds.has(c.parentId) && !excludedIds.has(c.id)) {
				excludedIds.add(c.id);
				found = true;
			}
		}
	}
	const parentOptions = categories.filter((c) => !excludedIds.has(c.id));

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
				<div className="dialog-header">
					<h2 id="dialog-title">{isEdit ? "Modifier la catégorie" : "Ajouter une catégorie"}</h2>
				</div>

				<div className="dialog-body">
					<div className="form-grid">
						<label className="form-field full-width">
							<span>Nom</span>
							<input type="text" autoComplete="off" {...register("name", { required: true })} />
							{errors.name && <span className="error">Le nom est obligatoire</span>}
						</label>

						<label className="form-field full-width">
							<span>Catégorie parente</span>
							<select {...register("parentId")}>
								<option value=""></option>
								{parentOptions.map((option) => (
									<option key={option.id} value={option.id}>
										{option.name}
									</option>
								))}
							</select>
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
