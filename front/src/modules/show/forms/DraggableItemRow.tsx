import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { Control, FieldValues, UseFormRegister, Path, UseFormSetValue, useWatch } from "react-hook-form";

import { artistMediaQuery } from "../api";
import ArtistSearchSelect from "../components/ArtistSearchSelect";
import MediaPicker from "../components/MediaPicker";
import ArtistPhotoButton from "./ArtistPhotoButton";

interface DraggableItemRowProps<T extends FieldValues> {
	id: string;
	index: number;
	register: UseFormRegister<T>;
	control: Control<T>;
	setValue: UseFormSetValue<T>;
	name: Path<T>; // e.g. "roles.0"
	onRemove: () => void;
	variant: "model" | "cast";
	// portraits taken for this spectacle are listed first
	spectacleId?: number;
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
	spectacleId,
}: DraggableItemRowProps<T>) {
	const handleRef = useRef(null);
	const { ref } = useSortable({
		id: `draggable-${id}`,
		index,
		handle: handleRef,
		modifiers: [RestrictToVerticalAxis],
	});

	const artistId = useWatch({ control, name: `${name}.artistId` as Path<T> });
	const pictureId = useWatch({ control, name: `${name}.pictureId` as Path<T> });
	const roleName = useWatch({ control, name: `${name}.name` as Path<T> });
	const { data: artistMedia = [] } = useQuery({ ...artistMediaQuery(artistId), enabled: !!artistId });
	const portraits = artistMedia.toSorted(
		(a, b) => Number(b.spectacleId === spectacleId) - Number(a.spectacleId === spectacleId),
	);

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
					onChange={(artistId: number) => {
						setValue(`${name}.artistId` as Path<T>, artistId as any);
						// a portrait belongs to its artist
						setValue(`${name}.pictureId` as Path<T>, null as any);
					}}
				/>
			</td>
			<td>
				<div className="role-portrait">
					<MediaPicker
						media={portraits}
						value={pictureId}
						onChange={(mediaId) => setValue(`${name}.pictureId` as Path<T>, mediaId as any)}
					/>
					{!!artistId && (
						<ArtistPhotoButton
							artistId={artistId}
							spectacleId={spectacleId}
							label={roleName}
							onRolePortrait={(mediaId) => setValue(`${name}.pictureId` as Path<T>, mediaId as any)}
						/>
					)}
				</div>
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
