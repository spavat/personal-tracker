import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { getCurrentOrPreviousDate } from "../../../utils";
import { save } from "../api";
import ListeningForm from "../forms/ListeningsForm";
import { type MusicListeningForm, MusicListeningFormSchema, onSubmitListening } from "../forms/ListeningsForm.utils";

const defaultValues = {
	artist: [{ value: "" }],
	album: "",
	genre: "",
	duration: 0,
	listeningDate: getCurrentOrPreviousDate(),
	releaseDate: "",
};

export type CopyProps = {
	artist: string[];
	album: string;
	releaseDate: string;
	genre: string;
	duration: number;
};

export default function AddListeningModalForm({ copyObject, returnTo }: { copyObject?: CopyProps; returnTo?: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const focusInputRef = useRef<HTMLInputElement>(null);

	const saveMutation = useMutation({
		mutationFn: save,
		onSuccess: () => {
			methods.reset(defaultValues);
			queryClient.invalidateQueries({ queryKey: ["music", "listenings"] });
			closeModal();
		},
	});
	const methods = useForm<MusicListeningForm>({
		resolver: zodResolver(MusicListeningFormSchema),
		defaultValues: {
			...defaultValues,
		},
		values: {
			...defaultValues,
			...(copyObject
				? {
						artist: copyObject.artist.map((a) => ({ value: a })),
						album: copyObject.album,
						releaseDate: copyObject.releaseDate,
						genre: copyObject.genre,
						duration: copyObject.duration,
					}
				: {}),
		} as any,
	});

	function closeModal() {
		methods.reset();
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	const onSubmit: SubmitHandler<MusicListeningForm> = (data) => {
		const parsedListening = onSubmitListening(data);
		saveMutation.mutate({
			...parsedListening,
		});
	};

	const processPasteData = async (e: React.ChangeEvent<HTMLInputElement>) => {
		let data;
		try {
			data = JSON.parse(e.target.value);
		} catch {
			// not (yet) the Navidrome JSON: nothing to fill
			return;
		}
		["listeningDate", "artist", "album", "releaseDate", "genre", "duration"].forEach((field) => {
			if (field === "artist") {
				const artists = data[field].split(" • ");
				methods.setValue(
					field as any,
					artists.map((name: string) => ({ value: name })),
				);
			} else {
				methods.setValue(field as any, data[field]);
			}
		});
	};

	return (
		<FormProvider {...methods}>
			<Modal
				className={"modal form dialog-medium"}
				isOpen={true}
				onClose={closeModal}
				hasCloseBtn={true}
				initialFocusRef={focusInputRef}
			>
				<form onSubmit={methods.handleSubmit(onSubmit)}>
					<div className="dialog-header">
						<h2 id="dialog-title">Ajouter une écoute</h2>
					</div>
					<div className="dialog-body">
						<div className="single-panel">
							<div className="panel">
								<h3>Navidrome</h3>
								<input
									type="text"
									onChange={processPasteData}
									ref={focusInputRef}
									aria-label="Coller les données de Navidrome"
								/>
								&nbsp;&lt;-- Coller données de Navidrome local
							</div>

							<ListeningForm />
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
				</form>
			</Modal>
		</FormProvider>
	);
}
