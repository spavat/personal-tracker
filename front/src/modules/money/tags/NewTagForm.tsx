import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type SubmitHandler, useForm, useWatch } from "react-hook-form";

import Badge from "../../../components/badge";
import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { tagQuery, tagsQuery, updateTag } from "../api";

interface Form {
	tagId?: number;
	returnTo: string;
}

type Inputs = {
	name: string;
	icon: string;
	textColor: string;
	backgroundColor: string;
	parentId: number | null;
};

const defaultValues = {
	name: "",
	icon: "",
	textColor: "#000000",
	backgroundColor: "#c0bfbc",
	parentId: null,
};

export default function NewTagForm({ tagId, returnTo }: Form) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const tagData = useOptionalSuspenseQuery(tagId ? tagQuery(tagId) : undefined);
	const { data: tagsList } = useSuspenseQuery(tagsQuery());
	const updateMutation = useMutation({
		mutationFn: updateTag,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["money", "tags"] });
			reset(defaultValues);
			closeModal();
		},
	});
	const { register, handleSubmit, reset, control } = useForm<Inputs>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: tagData ? (tagData as any) : defaultValues,
	});
	const [name, icon, backgroundColor, textColor] = useWatch({
		control,
		name: ["name", "icon", "backgroundColor", "textColor"],
	});

	const onSubmit: SubmitHandler<Inputs> = (data) => {
		const dataToSend = {
			...data,
			parentId: data.parentId || null,
		};
		updateMutation.mutate({ tagId, data: dataToSend });
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
			<Modal
				className="modal form dialog-medium"
				isOpen={true}
				onClose={closeModal}
				hasCloseBtn={true}
				aria-labelledby="dialog-title"
			>
				<div className="dialog-header">
					<h2 id="dialog-title">{tagId ? "Modifier le tag" : "Ajouter un tag"}</h2>
				</div>
				<div className="dialog-body">
					<div className="form-grid">
						<label className="form-field">
							<span>Nom</span>
							<input
								type="text"
								placeholder="Titre"
								{...register("name", { required: true })}
								autoComplete="off"
							/>
						</label>
						<label className="form-field">
							<span>Icône</span>
							<input type="text" {...register("icon")} />
						</label>
						<label className="form-field">
							<span>Couleur du fond</span>
							<input type="color" {...register("backgroundColor")} />
						</label>
						<label className="form-field">
							<span>Couleur du texte</span>
							<input type="color" {...register("textColor")} />
						</label>
						<label className="form-field">
							<span>Parent</span>
							<select {...register("parentId")}>
								<option value=""></option>
								{tagsList
									.filter((c) => !c.parentId)
									.map((tag) => {
										return (
											<option key={tag.id} value={tag.id}>
												{tag.name}
											</option>
										);
									})}
							</select>
						</label>
						<span></span>
						<div>
							<Badge name={name} icon={icon} backgroundColor={backgroundColor} color={textColor} />
						</div>
					</div>
				</div>

				<div className="dialog-footer">
					<MutationError error={updateMutation.error} />
					<button type="button" onClick={closeModal}>
						Fermer
					</button>
					<button type="submit" className="main" disabled={updateMutation.isPending}>
						Enregistrer
					</button>
				</div>
			</Modal>
		</form>
	);
}
