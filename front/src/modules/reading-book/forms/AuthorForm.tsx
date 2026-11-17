import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { saveEntity } from "../../../components/entity-api";
import ImageCropper from "../../../components/ImageCropper";
import ImageDropZone from "../../../components/ImageDropZone";
import Modal from "../../../components/Modal";
import MutationError from "../../../components/MutationError";
import { authorDetailsQuery } from "../api";
import { coverSrc } from "../utils";

type AuthorFormData = {
	name: string;
	sortName: string;
	// the server's URL (unchanged), an image URL or a data URI (new), empty (no portrait)
	picture: string;
};

function readFile(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => resolve(e.target?.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

export default function AuthorForm({ authorId, returnTo }: { authorId: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: author } = useSuspenseQuery(authorDetailsQuery(authorId));

	const {
		control,
		register,
		handleSubmit,
		setValue,
		formState: { errors },
	} = useForm<AuthorFormData>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: { name: author.name, sortName: author.sortName ?? "", picture: author.picture ?? "" },
	});
	const picture = useWatch({ control, name: "picture" });
	// image being cropped: blob: of a picked or pasted file, or the URL typed
	const [cropSrc, setCropSrc] = useState<string | null>(null);

	function openCropper(src: string) {
		setCropSrc((previous) => {
			if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
			return src;
		});
	}
	function closeCropper() {
		if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
		setCropSrc(null);
	}

	const saveMutation = useMutation({
		mutationFn: (data: AuthorFormData) =>
			saveEntity({
				id: author.id,
				kind: author.kind,
				name: data.name.trim(),
				sortName: data.sortName.trim() || null,
				picture: data.picture.trim() || null,
			}),
		onSuccess: () => {
			// the name shows on the books, the cards and the pickers
			queryClient.invalidateQueries({ queryKey: ["reading"] });
			queryClient.invalidateQueries({ queryKey: ["entities"] });
			closeModal();
		},
	});

	function closeModal() {
		closeCropper();
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	const isUrl = /^https?:\/\//.test(picture.trim());

	return (
		<form onSubmit={handleSubmit((data) => saveMutation.mutate(data))}>
			<Modal className={"modal form dialog-medium"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
				<div className="dialog-header">
					<h2 id="dialog-title">Modifier l'auteur·ice</h2>
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
								<span>Nom de tri</span>
								<input
									{...register("sortName")}
									type="text"
									placeholder="Carroll, Lewis"
									autoComplete="off"
								/>
							</label>
						</div>
					</div>
					<div className="panel">
						<h3>Portrait</h3>
						{cropSrc ? (
							<ImageCropper
								src={cropSrc}
								aspect={1}
								onCancel={closeCropper}
								onConfirm={async (file) => {
									setValue("picture", await readFile(file), { shouldDirty: true });
									closeCropper();
								}}
							/>
						) : (
							<div className="form-grid">
								<div className="form-field full-width">
									{/* the current portrait, left of the zone that replaces it */}
									<div className="portrait-input">
										{picture && (
											<img src={coverSrc(picture)} alt="Portrait" className="portrait-preview" />
										)}
										{/* a dropped, picked or pasted image goes straight to the cropper */}
										<ImageDropZone onImage={(file) => openCropper(URL.createObjectURL(file))} />
									</div>
									<div className="full-fields-row">
										<input
											{...register("picture")}
											type="text"
											placeholder="ou https://…"
											aria-label="URL de l'image"
											autoComplete="off"
											className="flex"
										/>
										{isUrl && (
											<button type="button" onClick={() => openCropper(picture.trim())}>
												Recadrer
											</button>
										)}
										{picture && (
											<button
												type="button"
												onClick={() => setValue("picture", "", { shouldDirty: true })}
												title="Retirer le portrait"
											>
												<i className="fa-regular fa-trash-can"></i>
											</button>
										)}
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
				<div className="dialog-footer">
					<MutationError error={saveMutation.error} />
					<button type="button" onClick={closeModal}>
						Annuler
					</button>
					<button type="submit" className="main" disabled={saveMutation.isPending || cropSrc !== null}>
						Enregistrer
					</button>
				</div>
			</Modal>
		</form>
	);
}
