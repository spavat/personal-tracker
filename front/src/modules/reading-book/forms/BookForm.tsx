import { zodResolver } from "@hookform/resolvers/zod";
import { SaveBookResponse } from "@personal-tracker/shared/reading-book";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Controller, useFieldArray, useForm } from "react-hook-form";

import type { FormData } from "./BookForm.utils";

import EntitySearchSelect from "../../../components/EntitySearchSelect";
import Modal from "../../../components/Modal";
import MutationError from "../../../components/MutationError";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { bookDetailsQuery, saveBook } from "../api";
import { BookFormSchema, BookFormSchemaTransformation } from "./BookForm.utils";

export default function BookForm({ bookId, returnTo }: { bookId?: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const data = useOptionalSuspenseQuery(bookId ? bookDetailsQuery(bookId) : undefined);

	const {
		control,
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<FormData>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: {
			...(data as any),
			authors: data?.authors.map(({ entityId, creditedAs }) => ({ entityId, creditedAs: creditedAs ?? "" })) ?? [
				{ entityId: "", creditedAs: "" },
			],
		},
		resolver: zodResolver(BookFormSchema),
	});
	const { fields, append, remove } = useFieldArray({
		control: control,
		name: "authors",
	});

	const saveMutation = useMutation({
		mutationFn: saveBook,
		onSuccess: (data: SaveBookResponse) => {
			reset();
			queryClient.invalidateQueries({ queryKey: ["reading", "books"] });
			if (bookId) {
				closeModal();
			} else {
				// Insert
				navigate({
					to: "/reading-book/book/$bookId",
					params: { bookId: data.id },
					replace: true,
				});
			}
		},
	});

	const onSubmit = (data: FormData) => {
		const finalData = BookFormSchemaTransformation.parse(data);
		saveMutation.mutate(finalData);
	};
	function closeModal() {
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<Modal className={"modal form dialog-medium"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
				<div className="dialog-header">
					<h2 id="dialog-title">{bookId ? "Modifier le livre" : "Ajouter un livre"}</h2>
				</div>
				<div className="dialog-body">
					<div className="panel">
						<h3>Général</h3>
						<div className="form-grid">
							<div className="form-field full-width">
								<span>
									Auteur·ices <span className="req">*</span>
								</span>
								{fields.map((field, index) => (
									<div key={field.id} className="full-fields-row">
										<Controller
											control={control}
											name={`authors.${index}.entityId`}
											render={({ field: { value, onChange } }) => (
												<EntitySearchSelect
													kind="person"
													value={value}
													onChange={(entityId) => onChange(entityId ?? "")}
													aria-label={`Auteur·ice ${index + 1}`}
												/>
											)}
										/>
										<input
											type="text"
											{...register(`authors.${index}.creditedAs` as const)}
											placeholder="Crédité·e comme"
											aria-label={`Auteur·ice ${index + 1} crédité·e comme`}
										/>
										{(index !== 0 || fields.length > 1) && (
											<button type="button" onClick={() => remove(index)} title="Supprimer">
												<i className="fa-regular fa-trash-can"></i>
											</button>
										)}
										{index === fields.length - 1 && (
											<button
												type="button"
												onClick={() => append({ entityId: "", creditedAs: "" })}
												title="Ajouter"
											>
												<i className="fa-regular fa-plus"></i>
											</button>
										)}
									</div>
								))}
								{errors.authors && <span className="error">Au moins un auteur est obligatoire</span>}
							</div>
							<label className="form-field full-width">
								<span>
									Nom <span className="req">*</span>
								</span>
								<input {...register("book", { required: true })} type="text" autoComplete="off" />
								{errors.book && <span className="error">Le nom est obligatoire</span>}
							</label>
							<label className="form-field">
								<span>Langue originale</span>
								<input {...register("originalLanguage")} type="text" />
							</label>
							<label className="form-field">
								<span>Année de publication</span>
								<input
									{...register("originalYear", {
										setValueAs: (v) =>
											v === "" || v === null || v === undefined ? null : Number(v),
									})}
									type="number"
								/>
							</label>
							<label className="form-field">
								<span>Pays</span>
								<input {...register("country")} type="text" />
							</label>
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
