import { useMutation, useQueryClient, useSuspenseQueries } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { useForm, type SubmitHandler, useFieldArray, FormProvider, useWatch } from "react-hook-form";

import Badge from "../../components/badge";
import Modal from "../../components/modal";
import MutationError from "../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../hooks/use-optional-suspense-query";
import { categoriesQuery, paymentTypesQuery, saveTransaction, tagsQuery, transactionQuery } from "./api";
import NewTransactionChildForm from "./NewTransactionChildForm";

type Inputs = {
	name: string;
	description: string;
	amount: number;
	date: string;
	time: string;
	considerationDate: string;
	recurrent: boolean;
	informative: boolean;
	comment: string;
	withChildren: boolean;
	showChildComment: boolean;
	children: Array<SubTransaction>;
	categoryId: number;
	paymentTypeId: number;
	tags: Array<Money.Tag>;
};

type SubTransaction = {
	name: string;
	amount: number;
	categoryId: number;
	paymentTypeId: number;
	comment: string;
	tags: Array<Money.Tag>;
};

interface Form {
	transactionId?: number;
	returnTo: string;
	returnToSearch?: any;
}

const defaultValues = {
	name: "",
	description: "",
	amount: 0,
	date: Temporal.Now.plainDateISO().toString(),
	time: "00:00:00",
	considerationDate: Temporal.Now.plainDateISO().toString(),
	recurrent: false,
	informatif: false,
	withChildren: false,
	children: [],
	categoryId: 0,
	paymentTypeId: 0,
	comment: "",
	tags: [],
};

export default function NewTransactionForm({ transactionId, returnTo, returnToSearch }: Form) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const selectTagRef = useRef<HTMLSelectElement | null>(null);
	const transaction = useOptionalSuspenseQuery(transactionId ? transactionQuery(transactionId) : undefined);
	const updateMutation = useMutation({
		mutationFn: saveTransaction,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["money", "transactions"] }); // TODO invalidate only period of the transaction
			formMethods.reset(defaultValues);
			closeModal();
		},
	});
	const formMethods = useForm<Inputs>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: transaction
			? {
					...(transaction as any),
					categorie: transaction.categoryId,
					paymentType: transaction.paymentTypeId,
					withChildren: Boolean(transaction.children?.length),
				}
			: defaultValues,
	});
	const [categoryId, paymentTypeId, withChildren] = useWatch({
		control: formMethods.control,
		name: ["categoryId", "paymentTypeId", "withChildren"],
	});

	const { fields, append, remove } = useFieldArray({
		control: formMethods.control,
		name: "children",
	});

	const {
		fields: fieldsTags,
		append: appendTag,
		remove: removeTag,
	} = useFieldArray({
		control: formMethods.control,
		name: "tags",
		keyName: "_id",
	});

	const onSubmit: SubmitHandler<Inputs> = (data) => {
		updateMutation.mutate({ transactionId, data });
	};

	function changeDate(e: React.ChangeEvent<HTMLInputElement>) {
		formMethods.setValue("considerationDate", e.target.value);
	}

	function handleSelectIdsChange(name: "categoryId" | "paymentTypeId", e?: React.MouseEvent<HTMLOptionElement>) {
		if (!e) {
			formMethods.setValue(name, 0);
			return;
		}
		const id = parseInt((e.target as HTMLOptionElement).value, 10);
		formMethods.setValue(name, id);
	}

	// parallel: separate useSuspenseQuery calls would load one after the other (when not preloaded)
	const [{ data: categories }, { data: paymentTypes }, { data: tags }] = useSuspenseQueries({
		queries: [categoriesQuery(), paymentTypesQuery(), tagsQuery()],
	});

	const selectedCategorie = categories.find((c) => c.id === categoryId);
	const selectedPaymentType = paymentTypes.find((pt) => pt.id === paymentTypeId);

	function appendChild() {
		append({
			name: "",
			amount: 0,
			categoryId: 0,
			paymentTypeId: 0,
			comment: "",
			tags: [],
		});
	}

	function removeChild(index: number) {
		remove(index);
	}

	function appendTagOnParent(tag: Money.Tag) {
		appendTag(tag);
	}

	function appendTagOnParent2() {
		const selectedId = parseInt(selectTagRef.current?.value ?? "0", 10);
		const tag = tags.find((t) => t.id === selectedId);
		if (tag) {
			appendTag(tag);
		}
	}

	function closeModal() {
		formMethods.reset(defaultValues);
		navigate({
			to: returnTo,
			search: returnToSearch,
			replace: true,
			resetScroll: false,
		});
	}

	return (
		<FormProvider {...formMethods}>
			<form onSubmit={formMethods.handleSubmit(onSubmit)}>
				<Modal className="modal form dialog-extralarge" isOpen={true} onClose={closeModal}>
					<div className="dialog-header">
						<h2 id="dialog-title">{transactionId ? "Modifier" : "Ajouter"} une transaction</h2>
					</div>
					<div className="dialog-body single-panel">
						<div className="panel">
							<h3>Transaction</h3>
							<div className="form-grid">
								<label className="form-field">
									<span>
										Nom <span className="req">*</span>
									</span>
									<input {...formMethods.register("name", { required: true })} autoComplete="off" />
								</label>
								<label className="form-field">
									<span>Description</span>
									<input {...formMethods.register("description")} />
								</label>
								<label className="form-field">
									<span>
										Montant <span className="req">*</span>
									</span>
									<input
										{...formMethods.register("amount", { required: true, valueAsNumber: true })}
										type="number"
										step=".01"
									/>
								</label>
								<span></span>
								<span>
									<div className="form-field">
										<label htmlFor="transaction-date">
											<span>
												Date de la transaction <span className="req">*</span>
											</span>
										</label>
										<div>
											<input
												id="transaction-date"
												type="date"
												{...formMethods.register("date", { required: true })}
												onChange={changeDate}
											/>
											<input type="time" {...formMethods.register("time")} step={60} />
										</div>
									</div>
								</span>
								<label className="form-field">
									<span>Date prise en compte</span>
									<input type="date" {...formMethods.register("considerationDate")} />
								</label>

								<label className="form-field checkbox">
									<input type="checkbox" {...formMethods.register("recurrent")} />
									Récurrent
								</label>

								<label className="form-field checkbox">
									<input type="checkbox" {...formMethods.register("informative")} />
									Informatif
								</label>
							</div>
						</div>

						<div className="form-grid">
							<label className="form-field checkbox">
								<input type="checkbox" {...formMethods.register("withChildren")} />
								Transaction avec enfants
							</label>
						</div>

						{withChildren ? (
							<>
								<h3 className="full_line">Enfants</h3>
								<label>
									<input type="checkbox" {...formMethods.register("showChildComment")} />
									Montrer commentaire & tags
								</label>
								<table className="full_line child">
									<tbody>
										{fields.map((field, index) => (
											<NewTransactionChildForm
												key={field.id}
												id={field.id}
												index={index}
												categories={categories}
												paymentTypes={paymentTypes}
												tags={tags}
												removeChild={removeChild}
											/>
										))}
									</tbody>
								</table>

								<p className="full_line">
									<button type="button" onClick={appendChild}>
										Ajouter un enfant
									</button>
								</p>
							</>
						) : (
							<>
								<div className="panel">
									<h3>Catégorisation de la transaction</h3>
									<div className="form-grid">
										<label className="form-field">
											<span>Catégorie</span>
											<select {...formMethods.register("categoryId", { valueAsNumber: true })}>
												<option value={0}></option>
												{categories.map((c) => (
													<option key={c.id} value={c.id}>
														{c.name}
													</option>
												))}
											</select>
											<p>
												{selectedCategorie && (
													<Badge
														key={selectedCategorie.id}
														name={selectedCategorie.name}
														icon={selectedCategorie.icon}
														backgroundColor={selectedCategorie.backgroundColor}
														color={selectedCategorie.textColor}
														onClick={() => handleSelectIdsChange("categoryId")}
													/>
												)}
											</p>
										</label>

										<label className="form-field">
											<span>Paiement</span>
											<select {...formMethods.register("paymentTypeId", { valueAsNumber: true })}>
												<option value={0}></option>
												{paymentTypes.map((c) => (
													<option key={c.id} value={c.id}>
														{c.name}
													</option>
												))}
											</select>
											<p>
												{selectedPaymentType && (
													<Badge
														key={String(selectedPaymentType.id)}
														name={selectedPaymentType.name}
														icon={selectedPaymentType.icon}
														backgroundColor={selectedPaymentType.backgroundColor}
														color={selectedPaymentType.textColor}
														onClick={() => handleSelectIdsChange("paymentTypeId")}
													/>
												)}
											</p>
										</label>
									</div>
								</div>

								<div className="panel">
									<h3>Tags</h3>
									<div>
										<select ref={selectTagRef} aria-label="tags">
											{tags
												?.filter((tag) => !fieldsTags.find((t) => t.id === tag.id))
												?.map((t) => (
													<option
														key={t.id}
														value={t.id}
														onDoubleClick={() => appendTagOnParent(t)}
													>
														{t.name}
													</option>
												))}
										</select>
										<button type="button" onClick={() => appendTagOnParent2()}>
											Add
										</button>
									</div>
									<div>
										<select multiple style={{ height: "10lh", display: "none" }}>
											{tags
												?.filter((tag) => !fieldsTags.find((t) => t.id === tag.id))
												?.map((t) => (
													<option
														key={t.id}
														value={t.id}
														onDoubleClick={() => appendTagOnParent(t)}
													>
														{t.name}
													</option>
												))}
										</select>
										<p>
											{fieldsTags.map((t, index) => (
												<Badge
													key={String(t.id)}
													name={t.name}
													icon={t.icon}
													backgroundColor={t.backgroundColor}
													color={t.textColor}
													onClick={() => removeTag(index)}
												/>
											))}
										</p>
									</div>
								</div>
							</>
						)}

						<div className="panel">
							<h3 className="full_line">
								<label htmlFor="comment">Commentaire</label>
							</h3>
							<textarea
								id="comment"
								className="full_line"
								{...formMethods.register("comment")}
							></textarea>
						</div>
					</div>

					<div className="dialog-footer">
						<MutationError error={updateMutation.error} />
						<button type="button" onClick={closeModal}>
							Fermer
						</button>
						<button type="submit" className="main" disabled={updateMutation.isPending}>
							Enregister
						</button>
					</div>
				</Modal>
			</form>
		</FormProvider>
	);
}
