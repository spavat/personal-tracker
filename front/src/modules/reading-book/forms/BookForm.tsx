import { zodResolver } from "@hookform/resolvers/zod";
import { type LookupWork, SaveBookResponse } from "@personal-tracker/shared/reading-book";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";

import type { FormData } from "./BookForm.utils";

import EntitySearchSelect from "../../../components/EntitySearchSelect";
import Modal from "../../../components/Modal";
import MutationError from "../../../components/MutationError";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { languageName } from "../../../utils";
import { bookDetailsQuery, saveBook } from "../api";
import BookLookup from "../components/BookLookup";
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
		setValue,
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
	const [originalLanguage, country] = useWatch({ control, name: ["originalLanguage", "country"] });
	const { fields, append, remove, replace } = useFieldArray({
		control: control,
		name: "authors",
	});
	// the ISBN of the Open Library search the form was filled from: its first edition is filled from it next
	const [lookupIsbn, setLookupIsbn] = useState<string | null>(null);

	function fillFromLookup(work: LookupWork, isbn: string | null) {
		setValue("book", work.title, { shouldDirty: true });
		setValue("originalYear", work.originalYear, { shouldDirty: true });
		setValue("externalIds", { [work.source]: work.externalId });
		// an author not matched to an entity: an empty picker, looking for that name
		replace(
			work.authors.length
				? work.authors.map(({ name, entityId }) => ({
						entityId: entityId ?? "",
						creditedAs: "",
						hint: entityId ? undefined : name,
					}))
				: [{ entityId: "", creditedAs: "" }],
		);
		setLookupIsbn(isbn);
	}

	// the fields keep their values, but the book no longer comes from that result
	function clearLookup() {
		setValue("externalIds", {});
		setLookupIsbn(null);
	}

	const saveMutation = useMutation({
		mutationFn: saveBook,
		onSuccess: (data: SaveBookResponse) => {
			reset();
			queryClient.invalidateQueries({ queryKey: ["reading", "books"] });
			if (bookId) {
				closeModal();
			} else if (lookupIsbn && data.editions[0]) {
				// its first edition, filled from that ISBN
				navigate({
					to: "/reading-book/book/$bookId/edition/$editionId/edit",
					params: { bookId: data.id, editionId: data.editions[0].id },
					search: { returnTo: `/reading-book/book/${data.id}`, isbn: lookupIsbn },
					replace: true,
				});
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
					{!bookId && <BookLookup onPick={fillFromLookup} onClear={clearLookup} />}
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
													initialSearch={field.hint}
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
								<div>
									<input
										{...register("originalLanguage")}
										aria-label="Langue originale"
										type="text"
										maxLength={2}
										pattern="[a-z]{2}"
										title="Code ISO 639-1 en minuscules : fr, en, ja…"
										autoComplete="off"
									/>{" "}
									{originalLanguage && languageName(originalLanguage)}
								</div>
								{errors.originalLanguage && (
									<span className="error">Code de langue à 2 lettres (fr, en, ja…)</span>
								)}
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
								<div>
									<input
										{...register("country")}
										aria-label="Pays"
										type="text"
										maxLength={2}
										pattern="[a-z]{2}"
										title="Code ISO 3166-1 en minuscules : fr, us, jp…"
										autoComplete="off"
									/>{" "}
									<span className={`fi fi-${country}`}></span>
								</div>
								{errors.country && (
									<span className="error">Code de pays à 2 lettres (fr, us, jp…)</span>
								)}
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
