import type { ArtistMedia, SpectacleMedia, SpectacleMediaKind } from "@personal-tracker/shared/show";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import MutationError from "../../../components/MutationError";
import { useIsOwner } from "../../../hooks/use-is-owner";
import { deleteMedia, type MediaOwner, reorderMedia, spectaclesQuery, updateMedia, uploadMedia } from "../api";
import { mediaSrc, readFile } from "../utils";
import ImageCropper from "./ImageCropper";

const MEDIA_KIND_LABELS: Record<SpectacleMediaKind, string> = {
	poster: "Affiche",
	photo: "Photo",
	programme: "Programme",
	recording: "Enregistrement",
};

type UploadInputs = {
	url: string;
	label: string;
	kind: SpectacleMediaKind;
	spectacleId: string;
};

export default function MediaGallery({
	owner,
	media,
	invalidateKey,
	mainPictureId,
	onSetMain,
	cropAspect,
}: {
	owner: MediaOwner;
	// width / height of the crop frame (1 = square)
	cropAspect: number;
	media: Array<SpectacleMedia | ArtistMedia>;
	// details query to refresh after a change
	invalidateKey: Array<unknown>;
	// artist only: main photo
	mainPictureId?: string | null;
	onSetMain?: (mediaId: string | null) => void;
}) {
	const isOwner = useIsOwner();
	const queryClient = useQueryClient();
	const isArtist = "artistId" in owner;
	const { data: spectacleList = [] } = useQuery({ ...spectaclesQuery(), enabled: isOwner && isArtist });

	function refresh() {
		queryClient.invalidateQueries({ queryKey: invalidateKey });
		queryClient.invalidateQueries({ queryKey: ["shows", "media"] });
	}

	const [file, setFile] = useState<File | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);
	const [cropSrc, setCropSrc] = useState<string | null>(null);
	const { register, handleSubmit, reset, control, setValue } = useForm<UploadInputs>({
		defaultValues: { url: "", label: "", kind: "poster", spectacleId: "" },
	});
	const url = useWatch({ control, name: "url" });

	function openCropper(src: string) {
		setCropSrc((previous) => {
			if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
			return src;
		});
	}

	// a pasted image goes straight to the cropper; text pastes are left alone
	useEffect(() => {
		if (!isOwner) return;
		function onPaste(e: ClipboardEvent) {
			const image = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
			// a modal opened over the page handles its own pastes
			if (!image || (e.target instanceof Element && e.target.closest("dialog"))) return;
			e.preventDefault();
			setFile(image);
			openCropper(URL.createObjectURL(image));
		}
		window.addEventListener("paste", onPaste);
		return () => window.removeEventListener("paste", onPaste);
	}, [isOwner]);

	function closeCropper() {
		if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
		setCropSrc(null);
	}
	const uploadMutation = useMutation({
		mutationFn: async (values: UploadInputs) => {
			const source = file ? await readFile(file) : values.url;
			return uploadMedia(owner, {
				source,
				label: values.label,
				kind: values.kind,
				spectacleId: values.spectacleId ? Number(values.spectacleId) : null,
			});
		},
		onSuccess: () => {
			reset();
			setFile(null);
			refresh();
		},
	});

	function onDrop(e: React.DragEvent) {
		e.preventDefault();
		setIsDragOver(false);
		const dropped = e.dataTransfer.files[0];
		if (dropped) setFile(dropped);
	}

	function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const picked = e.target.files?.[0];
		if (picked) setFile(picked);
		// lets the same file be picked again after removing it
		e.target.value = "";
	}

	const dropZoneClass = ["media-drop-zone", isDragOver ? "drag-over" : "", file ? "has-file" : ""]
		.filter(Boolean)
		.join(" ");
	const updateMutation = useMutation({
		mutationFn: ({ item, label }: { item: SpectacleMedia | ArtistMedia; label: string }) =>
			updateMedia(owner, item.id, { label, spectacleId: "spectacleId" in item ? item.spectacleId : undefined }),
		onSuccess: refresh,
	});
	const reorderMutation = useMutation({
		mutationFn: (mediaIds: Array<string>) => reorderMedia(owner, mediaIds),
		onSuccess: refresh,
	});
	const deleteMutation = useMutation({
		mutationFn: (mediaId: string) => deleteMedia(owner, mediaId),
		onSuccess: refresh,
	});

	function rename(item: SpectacleMedia | ArtistMedia) {
		const label = window.prompt("Libellé", item.label);
		if (label !== null) {
			updateMutation.mutate({ item, label });
		}
	}

	// the server takes the whole gallery in its new order
	function move(index: number, offset: -1 | 1) {
		const ids = media.map((item) => item.id);
		[ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
		reorderMutation.mutate(ids);
	}

	function remove(item: SpectacleMedia | ArtistMedia) {
		if (window.confirm(`Supprimer « ${item.label || "ce média"} » ?`)) {
			deleteMutation.mutate(item.id);
		}
	}

	if (media.length === 0 && !isOwner) {
		return null;
	}

	return (
		<div className="base_content">
			<h3>Médias ({media.length})</h3>
			<div className="media-gallery">
				{media.map((item, index) => (
					<figure key={item.id} className={item.id === mainPictureId ? "main" : ""}>
						<a href={mediaSrc(item.url)} target="_blank" rel="noreferrer">
							{item.contentType.startsWith("image/") ? (
								<img src={mediaSrc(item.url)} alt={item.label} loading="lazy" />
							) : (
								<i className="fa-regular fa-file-pdf"></i>
							)}
						</a>
						{isOwner && onSetMain && item.contentType.startsWith("image/") && (
							<button
								type="button"
								className="set-main"
								title={item.id === mainPictureId ? "Retirer la photo principale" : "Photo principale"}
								onClick={() => onSetMain(item.id === mainPictureId ? null : item.id)}
							>
								<i className={`${item.id === mainPictureId ? "fa-solid" : "fa-regular"} fa-star`}></i>
							</button>
						)}
						<figcaption>
							{"kind" in item && <span className="smalltext">{MEDIA_KIND_LABELS[item.kind]} </span>}
							{item.label}
							{isOwner && (
								<span className="actions">
									<button
										type="button"
										title="Déplacer avant"
										disabled={index === 0 || reorderMutation.isPending}
										onClick={() => move(index, -1)}
									>
										<i className="fa-solid fa-arrow-left"></i>
									</button>
									<button
										type="button"
										title="Déplacer après"
										disabled={index === media.length - 1 || reorderMutation.isPending}
										onClick={() => move(index, 1)}
									>
										<i className="fa-solid fa-arrow-right"></i>
									</button>
									<button type="button" title="Renommer" onClick={() => rename(item)}>
										<i className="fa-regular fa-pen-to-square"></i>
									</button>
									<button type="button" title="Supprimer" onClick={() => remove(item)}>
										<i className="fa-regular fa-trash-can"></i>
									</button>
								</span>
							)}
						</figcaption>
					</figure>
				))}
				{isOwner && (
					<form className="media-upload" onSubmit={handleSubmit((values) => uploadMutation.mutate(values))}>
						{cropSrc ? (
							<ImageCropper
								src={cropSrc}
								aspect={cropAspect}
								onCancel={closeCropper}
								onConfirm={(cropped) => {
									setFile(cropped);
									setValue("url", "");
									closeCropper();
								}}
							/>
						) : (
							<div
								className={dropZoneClass}
								onDragOver={(e) => {
									e.preventDefault();
									setIsDragOver(true);
								}}
								onDragLeave={() => setIsDragOver(false)}
								onDrop={onDrop}
							>
								{file ? (
									<>
										<i className="fa-solid fa-check"></i> {file.name}
										&nbsp;
										<button type="button" onClick={() => setFile(null)} title="Supprimer">
											✕
										</button>
									</>
								) : (
									<>
										<i className="fa-solid fa-file-import"></i>
										&nbsp;Glisser-déposer une image ou un PDF
										<br />
										<label>
											ou parcourir
											<input
												type="file"
												accept="image/*,application/pdf"
												onChange={onFileChange}
											/>
										</label>
										<br />
										ou coller une image (Ctrl+V)
									</>
								)}
							</div>
						)}
						<input type="text" placeholder="ou https://…" autoComplete="off" {...register("url")} />
						{!cropSrc && (file?.type.startsWith("image/") || (!file && url)) && (
							<button type="button" onClick={() => openCropper(file ? URL.createObjectURL(file) : url)}>
								<i className="fa-solid fa-crop-simple"></i> Recadrer
							</button>
						)}
						<input
							type="text"
							placeholder="Libellé (Saison 2…)"
							autoComplete="off"
							{...register("label")}
						/>
						{isArtist ? (
							<select {...register("spectacleId")} title="Spectacle">
								<option value="">Aucun spectacle</option>
								{spectacleList.map((spectacle) => (
									<option key={spectacle.id} value={spectacle.id}>
										{spectacle.name}
									</option>
								))}
							</select>
						) : (
							<select {...register("kind")}>
								{(["poster", "photo", "programme"] as const).map((kind) => (
									<option key={kind} value={kind}>
										{MEDIA_KIND_LABELS[kind]}
									</option>
								))}
							</select>
						)}
						<button type="submit" disabled={uploadMutation.isPending}>
							<i className="fa-regular fa-plus"></i> {uploadMutation.isPending ? "Envoi…" : "Ajouter"}
						</button>
						<MutationError error={uploadMutation.error} />
					</form>
				)}
			</div>
			<MutationError error={updateMutation.error ?? reorderMutation.error ?? deleteMutation.error} />
		</div>
	);
}
