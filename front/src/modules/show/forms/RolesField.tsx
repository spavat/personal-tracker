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

import EntitySearchSelect from "../../../components/EntitySearchSelect";
import DraggableItemRow from "./DraggableItemRow";

interface RolesFieldProps<T extends FieldValues> {
	control: Control<T>;
	register: UseFormRegister<T>;
	setValue: UseFormSetValue<T>;
	name: ArrayPath<T>;
	variant: "model" | "cast";
}

export function RolesField<T extends FieldValues>({ control, register, setValue, name, variant }: RolesFieldProps<T>) {
	const { fields, append, remove, move } = useFieldArray({ control, name });

	const {
		register: registerTemp,
		setValue: setValueTemp,
		control: controlTemp,
		setFocus: setFocusTemp,
		handleSubmit: handleSubmitTemp,
	} = useForm();

	const tempEntityId = useWatch({ control: controlTemp, name: "entityId" });

	const addModelRole = handleSubmitTemp((values) => {
		if (values.role && (values.entityId || variant === "model")) {
			append({
				order: 0,
				name: values.role,
				main: values.main,
				entityId: values.entityId,
			} as any);
			setValueTemp("entityId", null);
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
							/>
						))}
						{fields.length === 0 && (
							<tr>
								<td className="empty-table" colSpan={variant === "cast" ? 7 : 6}>
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
							<EntitySearchSelect
								kind="person"
								value={tempEntityId}
								onChange={(id) => setValueTemp("entityId", id)}
								aria-label="Artiste du nouveau rôle"
							/>
						</td>
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
