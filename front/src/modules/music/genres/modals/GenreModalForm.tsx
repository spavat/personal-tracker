import { MusicGenre } from "@personal-tracker/shared/music";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { SubmitHandler, useFieldArray, useForm } from "react-hook-form";

import Modal from "../../../../components/modal";
import MutationError from "../../../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../../../hooks/use-optional-suspense-query";
import { genresQuery, saveGenre } from "../../api";

type GenreFormInputs = {
	name: string;
	genres: Array<{ value: string }>;
};

const defaultValues: GenreFormInputs = {
	name: "",
	genres: [{ value: "" }],
};

export default function GenreModalForm({ id, returnTo }: { id?: string; returnTo: string }) {
	const isEdit = Boolean(id);
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const musicGenres = useOptionalSuspenseQuery(isEdit ? genresQuery() : undefined);
	const musicGenre = musicGenres?.find((g) => g.id === id);

	const {
		control,
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<GenreFormInputs>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: musicGenre
			? {
					name: musicGenre.name,
					genres: musicGenre.genres.map((genre) => ({ value: genre })),
				}
			: defaultValues,
	});

	const { fields, append, remove } = useFieldArray({ control, name: "genres" });

	const saveMutation = useMutation({
		mutationFn: saveGenre,
		onSuccess: () => {
			reset(defaultValues);
			queryClient.invalidateQueries({ queryKey: ["music", "genres"] });
			closeModal();
		},
	});

	function closeModal() {
		reset(defaultValues);
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	const onSubmit: SubmitHandler<GenreFormInputs> = (data) => {
		const payload: Partial<MusicGenre> = {
			...(id ? { id } : {}),
			name: data.name,
			genres: data.genres.flatMap((genre) => (genre.value ? [genre.value] : [])),
		};
		saveMutation.mutate(payload);
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
				<div className="dialog-header">
					<h2 id="dialog-title">{isEdit ? "Modifier le genre principal" : "Ajouter un genre principal"}</h2>
				</div>

				<div className="dialog-body">
					<div className="form-grid">
						<label className="form-field full-width">
							<span>Nom</span>
							<input type="text" autoComplete="off" {...register("name", { required: true })} />
							{errors.name && <span className="error">Le nom est obligatoire</span>}
						</label>

						<label className="form-field full-width">
							<span>Genres</span>
							{fields.map((field, index) => (
								<div key={field.id} className="full-fields-row">
									<input
										type="text"
										autoComplete="off"
										{...register(`genres.${index}.value` as const)}
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
