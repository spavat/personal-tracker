import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useForm, SubmitHandler, useWatch } from "react-hook-form";

import Badge from "../../../components/badge";
import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { banksTreeQuery, paymentTypeQuery, updatePaymentType } from "../api";

type Inputs = {
	name: string;
	icon: string;
	textColor: string;
	backgroundColor: string;
	accountId: number;
};

interface Form {
	paymentTypeId?: number;
	returnTo: string;
}

const defaultValues = {
	name: "",
	icon: "",
	textColor: "#000000",
	backgroundColor: "#c0bfbc",
	accountId: 0,
};

export default function NewPaymentTypeForm({ paymentTypeId, returnTo }: Form) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const paymentTypeData = useOptionalSuspenseQuery(paymentTypeId ? paymentTypeQuery(paymentTypeId) : undefined);
	const { data: bankTree } = useSuspenseQuery(banksTreeQuery());
	const updateMutation = useMutation({
		mutationFn: updatePaymentType,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["money", "banks"] });
			queryClient.invalidateQueries({ queryKey: ["money", "accounts"] });
			queryClient.invalidateQueries({ queryKey: ["money", "paymentTypes"] });
			closeModal();
		},
	});

	const { register, handleSubmit, reset, control } = useForm<Inputs>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: paymentTypeData ? (paymentTypeData as any) : defaultValues,
	});
	const [name, icon, backgroundColor, textColor] = useWatch({
		control,
		name: ["name", "icon", "backgroundColor", "textColor"],
	});

	const onSubmit: SubmitHandler<Inputs> = (data) => {
		updateMutation.mutate({ paymentTypeId, data });
	};

	function closeModal() {
		reset(defaultValues);
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
				<div className="dialog-header">
					<h2 id="dialog-title">
						{paymentTypeId ? "Editer un type de paiement" : "Ajouter un type de paiement"}
					</h2>
				</div>
				<div className="dialog-body">
					<div className="form-grid">
						<label className="form-field">
							<span>Nom</span>
							<input {...register("name", { required: true })} autoComplete="off" />
						</label>
						<label className="form-field">
							<span>Icone</span>
							<input {...register("icon")} autoComplete="off" />
						</label>
						<label className="form-field">
							<span>Couleur du fond</span>
							<input type="color" {...register("backgroundColor")} />
						</label>
						<label className="form-field">
							<span>Couleur du texte</span>
							<input type="color" {...register("textColor")} />
						</label>
						<label className="form-field full-width">
							<span>Compte</span>
							<select {...register("accountId")}>
								<option value=""></option>
								{bankTree.map((bank) => (
									<optgroup key={bank.id} label={bank.name}>
										{bank.accounts?.map((account) => {
											return (
												<option key={account.id} value={account.id}>
													{account.name}
												</option>
											);
										})}
									</optgroup>
								))}
							</select>
						</label>
						<div>
							<Badge
								name={name || "Spécimen"}
								icon={icon}
								backgroundColor={backgroundColor}
								color={textColor}
							/>
						</div>
					</div>
				</div>

				<div className="dialog-footer">
					<MutationError error={updateMutation.error} />
					<button type="button" onClick={closeModal}>
						Annuler
					</button>
					<button type="submit" className="main" disabled={updateMutation.isPending}>
						Enregistrer
					</button>
				</div>
			</Modal>
		</form>
	);
}
