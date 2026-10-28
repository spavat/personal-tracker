import { zodResolver } from "@hookform/resolvers/zod";
import { ModelSchema } from "@personal-tracker/shared/reading-book";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FormProvider, Resolver, useFieldArray, useForm, useFormContext, useWatch } from "react-hook-form";
import { z } from "zod";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { bookDetailsQuery, saveModel } from "../api";
import { renderItemModel } from "../render-modele-fn";
import { parseTocText } from "../utils";

type Part = {
	id?: string;
	title: string;
	content?: Part[];
};

type InputValues = {
	root: Array<Part>;
};

export default function ModelForm({ bookId, returnTo }: { bookId: string; returnTo: string }) {
	const navigate = useNavigate();
	const { data } = useSuspenseQuery(bookDetailsQuery(bookId));
	const modele = data.model;
	const queryClient = useQueryClient();
	const saveMutation = useMutation({
		mutationFn: saveModel,
		onSuccess: () => {
			methods.reset();
			queryClient.invalidateQueries({ queryKey: ["reading", "books", bookId] });
			closeModal();
		},
	});

	const methods = useForm<InputValues>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: { root: (modele as any) ?? [] },
		// ModelSchema is a recursive ZodType<ReadingModelItem>: its input is typed unknown
		resolver: zodResolver(z.object({ root: ModelSchema })) as Resolver<InputValues>,
	});
	// watched (not getValues) so the preview follows every change, nested ones included
	const root = useWatch({ control: methods.control, name: "root" });

	const { fields, remove, insert } = useFieldArray({
		control: methods.control,
		name: "root",
	});

	function convert(text: string) {
		const tree = parseTocText(text);
		methods.setValue("root", tree as any);
	}

	function onSubmit(data: InputValues) {
		saveMutation.mutate({ id: bookId ?? "", model: data.root });
	}

	function closeModal() {
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	return (
		<>
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<Modal className={"modal form dialog-extralarge"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
					<div className="dialog-header">
						<h2 id="dialog-title">Modèle</h2>
					</div>
					<div className="dialog-body">
						<h3>Modele Form</h3>
						<div className="modele-form">
							<FormProvider {...methods}>
								<div>
									<h3>
										<label htmlFor="toc-textarea">Texte</label>
									</h3>
									<textarea
										id="toc-textarea"
										className="modelText"
										onChange={(e) => convert(e.target.value)}
									></textarea>
								</div>
								<div>
									<h3>Saisie</h3>
									<ul className="book-tree root">
										<li>
											<div>
												<summary>Table des matières</summary>
												<ul>
													{fields?.map((mod, index: number) => {
														return (
															<ItemModele
																key={mod.id}
																nestedKey="root"
																index={index}
																insert={insert}
																remove={remove}
																siblings={fields.length}
																parentKey={"root"}
															/>
														);
													})}
												</ul>
											</div>
										</li>
									</ul>
								</div>
								<div>
									<h3>Prévisualisation</h3>
									<ul className="book-tree root">
										<li>
											<div>
												<summary>Table des matières</summary>
												<ul>
													{root?.map((mod: any) => {
														return renderItemModel(mod);
													})}
												</ul>
											</div>
										</li>
									</ul>
								</div>
							</FormProvider>
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
		</>
	);
}

function ItemModele({
	nestedKey,
	index,
	insert,
	remove,
	siblings,
	parentKey,
}: {
	nestedKey: string;
	index: number;
	insert: any;
	remove: any;
	siblings: number;
	parentKey: string;
}) {
	const { register, setValue, control, getFieldState, formState } = useFormContext();

	const fieldName = `${nestedKey}.${index}`;
	const titleFieldName = `${fieldName}.title`;
	const contentFieldName = `${fieldName}.content`;
	const titleError = getFieldState(titleFieldName, formState).error && (
		<span className="error">Titre obligatoire</span>
	);

	const contentChildren = useWatch({ control, name: contentFieldName });

	function handleSwitchType() {
		if (contentChildren) {
			setValue(contentFieldName, undefined); // Node -> Leaf
		} else {
			setValue(contentFieldName, [{ id: crypto.randomUUID(), title: "" }]); // Leaf -> Node
		}
	}

	function handleAddChapter() {
		insert(index + 1, { id: crypto.randomUUID(), title: "" });
	}

	function handleDeleteChapter() {
		remove(index);

		if (index === 0 && siblings === 1) {
			if (nestedKey === "root") {
				setValue(`root`, [{ id: crypto.randomUUID(), title: "" }]);
			} else {
				setValue(`${parentKey}.content`, undefined);
			}
		}
	}

	if (contentChildren && contentChildren.length > 0) {
		// Node
		return (
			<li>
				<div>
					<summary>
						<input type="text" {...register(titleFieldName)} />{" "}
						<button type="button" onClick={() => handleSwitchType()}>
							Switch
						</button>
						{titleError}
					</summary>

					<ListItemModele contentFieldName={contentFieldName} parentKey={nestedKey + "." + index} />
				</div>
			</li>
		);
	}
	// Leaf
	return (
		<>
			<li>
				<input type="text" {...register(titleFieldName)} />{" "}
				<button type="button" onClick={() => handleSwitchType()}>
					Switch
				</button>
				<button type="button" onClick={() => handleAddChapter()} title="Ajouter un chapitre">
					+
				</button>
				<button type="button" onClick={() => handleDeleteChapter()} title="Supprimer le chapitre">
					-
				</button>
				{titleError}
			</li>
		</>
	);
}

function ListItemModele({ contentFieldName, parentKey }: { contentFieldName: string; parentKey: string }) {
	const { control } = useFormContext();
	const { fields, remove, insert } = useFieldArray({
		control: control,
		name: contentFieldName,
	});
	return (
		<ul>
			{fields.map((field: any, i: number) => {
				return (
					<ItemModele
						key={field.id}
						nestedKey={contentFieldName}
						index={i}
						insert={insert}
						remove={remove}
						siblings={fields.length}
						parentKey={parentKey}
					/>
				);
			})}
		</ul>
	);
}
