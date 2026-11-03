import { DragDropProvider } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import {
	useFieldArray,
	Control,
	UseFormRegister,
	FieldValues,
	ArrayPath,
	Path,
	useForm,
	UseFormSetValue,
	useWatch,
} from "react-hook-form";

import ArtistSearchSelect from "../components/ArtistSearchSelect";
import DraggableItemRow from "./DraggableItemRow";

interface RolesFieldProps<T extends FieldValues> {
	control: Control<T>;
	register: UseFormRegister<T>;
	setValue: UseFormSetValue<T>;
	name: ArrayPath<T>;
	variant: "model" | "cast";
	spectacleId?: number;
}

export function RolesField<T extends FieldValues>({
	control,
	register,
	setValue,
	name,
	variant,
	spectacleId,
}: RolesFieldProps<T>) {
	const { fields, append, remove, move } = useFieldArray({ control, name });

	const {
		register: registerTemp,
		setValue: setValueTemp,
		control: controlTemp,
		setFocus: setFocusTemp,
		handleSubmit: handleSubmitTemp,
	} = useForm();

	const tempArtistId = useWatch({ control: controlTemp, name: "artistId" });

	const addModelRole = handleSubmitTemp((values) => {
		if (values.role && (values.artistId || variant === "model")) {
			append({
				order: 0,
				name: values.role,
				main: values.main,
				artistId: values.artistId,
			} as any);
			setValueTemp("artistId", 0);
			setValueTemp("role", "");
		}
	});

	return (
		<>
			<table className="list casting alternate">
				<thead>
					<tr>
						<th></th>
						<th>Rôle</th>
						<th>Principal</th>
						<th>Artiste</th>
						<th>Portrait</th>
						{variant === "cast" && <th>Statut</th>}
						<th>Actions</th>
						<th></th>
					</tr>
				</thead>
				<DragDropProvider
					onDragEnd={(event) => {
						const { source } = event.operation ?? {};
						if (isSortable(source)) {
							if (source.index !== source.initialIndex) {
								move(source.initialIndex, source.index);
							}
						}
					}}
				>
					<tbody>
						{fields.map((field, index) => (
							<DraggableItemRow
								key={field.id}
								id={field.id}
								index={index}
								register={register}
								control={control}
								setValue={setValue}
								name={`${name}.${index}` as Path<T>}
								onRemove={() => remove(index)}
								variant={variant}
								spectacleId={spectacleId}
							/>
						))}
						{fields.length === 0 && (
							<tr>
								<td className="empty-table" colSpan={variant === "cast" ? 8 : 7}>
									Aucun rôle enregistré
								</td>
							</tr>
						)}
					</tbody>
				</DragDropProvider>
				<tfoot>
					<tr
						className="add-in-footer"
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								addModelRole();
								setFocusTemp("role");
							}
						}}
					>
						<td></td>
						<td>
							<input {...registerTemp("role")} autoComplete="off" />
						</td>
						<td>
							<input type="checkbox" {...registerTemp("main")} />
						</td>
						<td>
							<ArtistSearchSelect
								value={tempArtistId}
								onChange={(artistId: number) => setValueTemp("artistId", artistId)}
							/>
						</td>
						<td></td>
						{variant === "cast" && <td></td>}
						<td>
							<button type="button" onClick={addModelRole}>
								<i className="fa-regular fa-plus"></i> Ajouter
							</button>
						</td>
					</tr>
				</tfoot>
			</table>
		</>
	);
}
