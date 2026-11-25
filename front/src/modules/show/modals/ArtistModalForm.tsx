import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { saveEntity } from "../../../components/entity-api";
import Modal from "../../../components/Modal";
import MutationError from "../../../components/MutationError";
import PortraitField from "../../../components/PortraitField";
import { artistDetailsQuery } from "../api";

type ArtistFormData = {
	name: string;
	// the server's URL (unchanged), an image URL or a data URI (new), empty (no portrait)
	picture: string;
};

// An artist is an entity: saved through /entities, its other fields (kind, sort name) sent back unchanged
export default function ArtistModalForm({ artistId, returnTo }: { artistId: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: artist } = useSuspenseQuery(artistDetailsQuery(artistId, false));

	const {
		control,
		register,
		handleSubmit,
		setValue,
		formState: { errors },
	} = useForm<ArtistFormData>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: { name: artist.name, picture: artist.picture ?? "" },
	});
	const picture = useWatch({ control, name: "picture" });
	const [isCropping, setIsCropping] = useState(false);

	const saveMutation = useMutation({
		mutationFn: (data: ArtistFormData) =>
			saveEntity(
				{
					kind: artist.kind,
					name: data.name.trim(),
					sortName: artist.sortName,
					picture: data.picture.trim() || null,
				},
				artist.id,
			),
		onSuccess: () => {
			// the name and the portrait show on the casts, the cards and the pickers
			queryClient.invalidateQueries({ queryKey: ["shows"] });
			queryClient.invalidateQueries({ queryKey: ["entities"] });
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
					<h2 id="dialog-title">Modifier l'artiste</h2>
				</div>
				<div className="dialog-body">
					<div className="panel">
						<h3>Général</h3>
						<div className="form-grid">
							<label className="form-field full-width">
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
