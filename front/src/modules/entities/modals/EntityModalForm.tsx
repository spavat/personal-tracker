import type { EntityKind } from "@personal-tracker/shared/entity";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { saveEntity } from "../../../components/entity-api";
import Modal from "../../../components/Modal";
import MutationError from "../../../components/MutationError";
import PortraitField from "../../../components/PortraitField";
import { entityDetailsQuery } from "../api";
import { KIND_LABELS } from "../constants";

type EntityFormData = {
	kind: EntityKind;
	name: string;
	sortName: string;
	realName: string;
	// the server's URL (unchanged), an image URL or a data URI (new), empty (no portrait)
	picture: string;
};

// The fields of the show artist and reading-book author forms, and the kind: another kind moves the entity to it
// (its credits are kept, the fields specific to its former kind are lost)
export default function EntityModalForm({ entityId, returnTo }: { entityId: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: entity } = useSuspenseQuery(entityDetailsQuery(entityId));

	const {
		control,
		register,
		handleSubmit,
		setValue,
		formState: { errors },
	} = useForm<EntityFormData>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: {
			kind: entity.kind,
			name: entity.name,
			sortName: entity.sortName ?? "",
			realName: entity.realName ?? "",
			picture: entity.picture ?? "",
		},
	});
	const picture = useWatch({ control, name: "picture" });
	const kind = useWatch({ control, name: "kind" });
	const [isCropping, setIsCropping] = useState(false);

	const saveMutation = useMutation({
		mutationFn: (data: EntityFormData) =>
			saveEntity(
				{
					kind: data.kind,
					name: data.name.trim(),
					sortName: data.sortName.trim() || null,
					realName: data.realName.trim() || null,
					picture: data.picture.trim() || null,
				},
				entity.id,
			),
		onSuccess: () => {
			// the name and the portrait show in every module crediting the entity, and in the pickers
			for (const queryKey of [["entities"], ["shows"], ["reading"], ["programs"], ["program"]]) {
				queryClient.invalidateQueries({ queryKey });
			}
			closeModal();
		},
	});

	function closeModal() {
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	return (
		<form onSubmit={handleSubmit((data) => saveMutation.mutate(data))}>
			<Modal className="form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
				<div className="dialog-header">
					<h2 id="dialog-title">Modifier {entity.name}</h2>
				</div>
				<div className="dialog-body">
					<div className="panel">
						<h3>Général</h3>
						<div className="form-grid">
							<label className="form-field">
								<span>
									Nom <span className="req">*</span>
								</span>
								<input
									{...register("name", { validate: (v) => v.trim() !== "" })}
									type="text"
									autoComplete="off"
								/>
								{errors.name && <span className="error">Le nom est obligatoire</span>}
							</label>
							<label className="form-field">
								<span>Type</span>
								<select {...register("kind")}>
									{Object.entries(KIND_LABELS).map(([value, label]) => (
										<option key={value} value={value}>
											{label}
										</option>
									))}
								</select>
								{kind !== entity.kind && (
									<span className="smalltext">
										Les informations propres à « {KIND_LABELS[entity.kind]} » seront perdues
									</span>
								)}
							</label>
							<label className="form-field">
								<span>Nom de tri</span>
								<input
									{...register("sortName")}
									type="text"
									placeholder="Carroll, Lewis"
									autoComplete="off"
								/>
							</label>
							<label className="form-field">
								<span>Nom réel</span>
								<input
									{...register("realName")}
									type="text"
									placeholder="Charles Lutwidge Dodgson"
									autoComplete="off"
								/>
							</label>
						</div>
					</div>
					<div className="panel">
						<h3>Portrait</h3>
						<PortraitField
							value={picture}
							onChange={(value) => setValue("picture", value, { shouldDirty: true })}
							onCroppingChange={setIsCropping}
							urlInput={
								<input
									{...register("picture")}
									type="text"
									placeholder="ou https://…"
									aria-label="URL de l'image"
									autoComplete="off"
									className="flex"
								/>
							}
						/>
					</div>
				</div>
				<div className="dialog-footer">
					<MutationError error={saveMutation.error} />
					<button type="button" onClick={closeModal}>
						Annuler
					</button>
					<button type="submit" className="main" disabled={saveMutation.isPending || isCropping}>
						Enregistrer
					</button>
				</div>
			</Modal>
		</form>
	);
}
