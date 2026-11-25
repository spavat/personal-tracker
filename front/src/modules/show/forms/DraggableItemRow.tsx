import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import { useRef } from "react";
import { Control, FieldValues, UseFormRegister, Path, UseFormSetValue, useWatch } from "react-hook-form";

import EntitySearchSelect from "../../../components/EntitySearchSelect";

interface DraggableItemRowProps<T extends FieldValues> {
	id: string;
	index: number;
	register: UseFormRegister<T>;
	control: Control<T>;
	setValue: UseFormSetValue<T>;
	name: Path<T>; // e.g. "roles.0"
	onRemove: () => void;
	variant: "model" | "cast";
}

export default function DraggableItemRow<T extends FieldValues>({
	index,
	onRemove,
	register,
	control,
	setValue,
	name,
	id,
	variant,
}: DraggableItemRowProps<T>) {
	const handleRef = useRef(null);
	const { ref } = useSortable({
		id: `draggable-${id}`,
		index,
		handle: handleRef,
		modifiers: [RestrictToVerticalAxis],
	});

	const entityId = useWatch({ control, name: `${name}.entityId` as Path<T> });

	return (
		<tr ref={ref}>
			<td className="smalltext monospace">#{index + 1}</td>
			<td>
				<label>
					<input
						style={{ width: "100%" }}
						type="text"
						{...register(`${name}.name` as Path<T>)}
						placeholder="Rôle"
					/>
				</label>
			</td>
			<td>
				<input type="checkbox" {...register(`${name}.main` as Path<T>)} />
			</td>
			<td>
				<EntitySearchSelect
					kind="person"
					value={entityId}
					onChange={(id) => setValue(`${name}.entityId` as Path<T>, id as any)}
					aria-label={`Artiste ${index + 1}`}
				/>
			</td>
			{variant === "cast" && (
				<td>
					<input type="text" {...register(`${name}.status` as Path<T>)} />
				</td>
			)}
			<td>
				<button type="button" onClick={onRemove} title="Supprimer">
					<i className="fa-regular fa-trash-can"></i>
				</button>
			</td>
			<td>
				<i className="fa-solid fa-grip-vertical" ref={handleRef}></i>
			</td>
		</tr>
	);
}
