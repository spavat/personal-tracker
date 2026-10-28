import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useForm, type SubmitHandler, useWatch } from "react-hook-form";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { accountQuery, banksQuery, updateAccount } from "../api";
import AccountBadge from "../badgeAccount";

type Inputs = {
	name: string;
	icon: string;
	textColor: string;
	backgroundColor: string;
	bankId: number;
};

interface Form {
	accountId?: number;
	returnTo: string;
}

const defaultValues: Inputs = {
	name: "",
	icon: "",
	textColor: "#000000",
	backgroundColor: "#000000",
	bankId: 0,
};

export default function NewBankForm({ accountId, returnTo }: Form) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const accountData = useOptionalSuspenseQuery(accountId ? accountQuery(accountId) : undefined);
	const { data: bankkList } = useSuspenseQuery(banksQuery());
	const updateMutation = useMutation({
		mutationFn: updateAccount,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["money", "banks"] });
			queryClient.invalidateQueries({ queryKey: ["money", "accounts"] });
			closeModal();
		},
	});

	const { register, handleSubmit, reset, control } = useForm<Inputs>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: accountData ? (accountData as any) : defaultValues,
	});
	const [name, icon, backgroundColor, textColor] = useWatch({
		control,
		name: ["name", "icon", "backgroundColor", "textColor"],
	});

	const onSubmit: SubmitHandler<Inputs> = (data) => {
		updateMutation.mutate({ accountId, data });
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
					<h2 id="dialog-title">{accountId ? "Editer un compte" : "Ajouter un compte"}</h2>
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
							<span>Banque</span>
							<select {...register("bankId")}>
								<option value=""></option>
								{bankkList.map((bank) => (
									<option key={bank.id} value={bank.id}>
										{bank.name}
									</option>
								))}
							</select>
						</label>
					</div>

					<div className="full-width bank_accounts">
						<AccountBadge
							name={name || "Spécimen"}
							color={textColor}
							backgroundColor={backgroundColor}
							amount={"21212"}
							icon={icon}
							comment={"2024-01-01"}
						/>
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
