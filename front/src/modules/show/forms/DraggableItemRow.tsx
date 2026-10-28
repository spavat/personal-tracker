import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { Control, FieldValues, UseFormRegister, Path, UseFormSetValue, useWatch } from "react-hook-form";

import { artistsQuery } from "../api";
import ArtistSearchSelect from "../ArtistSearchSelect";

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

	const { data = [] } = useQuery(artistsQuery());
	const artistId = useWatch({ control, name: `${name}.artistId` as Path<T> });

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
				<ArtistSearchSelect
					value={artistId}
					onChange={(artistId: number) => setValue(`${name}.artistId` as Path<T>, artistId as any)}
				/>
				<br />
				<select {...register(`${name}.artistId` as Path<T>, { valueAsNumber: true })} hidden>
					<option key="empty" value={0}></option>
					{data?.map((artist) => (
						<option key={artist.id} value={artist.id}>
							{artist.name}
						</option>
					))}
				</select>
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
