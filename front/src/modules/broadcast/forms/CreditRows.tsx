import type { Entity, EntityKind } from "@personal-tracker/shared/entity";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { entitiesQuery, saveEntity } from "../../../components/entity-api";
import EntitySearchSelect from "../../../components/EntitySearchSelect";
import MutationError from "../../../components/MutationError";

// A credit row of a form: the entity picked (or created) of its kind, its role, the name given when it differs
export interface CreditInput {
	entityId: string;
	kind: EntityKind;
	role: string;
	creditedAs: string;
}

export interface CreditRole {
	value: string;
	label: string;
	// the kind a new row of this role picks first
	kind: EntityKind;
}

const KINDS: Array<{ value: EntityKind; label: string }> = [
	{ value: "person", label: "Personne" },
	{ value: "group", label: "Groupe" },
	{ value: "organization", label: "Organisation" },
];

// Edits the picked entity itself (every program, episode or book crediting it sees the change). Another kind keeps
// its credits.
function EntityEditor({ entity, onDone }: { entity: Entity; onDone: (kind: EntityKind) => void }) {
	const queryClient = useQueryClient();
	const [name, setName] = useState(entity.name);
	const [kind, setKind] = useState(entity.kind);
	const [sortName, setSortName] = useState(entity.sortName ?? "");
	const saveMutation = useMutation({
		mutationFn: () =>
			saveEntity(
				{ kind, name: name.trim(), sortName: sortName.trim() || null, realName: entity.realName },
				entity.id,
			),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["entities"] });
			queryClient.invalidateQueries({ queryKey: ["programs"] });
			queryClient.invalidateQueries({ queryKey: ["program"] });
			onDone(kind);
		},
	});

	return (
		<div className="credit-entity-editor">
			<input type="text" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nom de l'entité" />
			<select value={kind} onChange={(e) => setKind(e.target.value as EntityKind)} aria-label="Type d'entité">
				{KINDS.map(({ value, label }) => (
					<option key={value} value={value}>
						{label}
					</option>
				))}
			</select>
			<input
				type="text"
				value={sortName}
				onChange={(e) => setSortName(e.target.value)}
				placeholder="Nom de tri"
				aria-label="Nom de tri"
			/>
			<button type="button" onClick={() => onDone(entity.kind)}>
				Annuler
			</button>
			<button
				type="button"
				className="main"
				disabled={!name.trim() || saveMutation.isPending}
				onClick={() => saveMutation.mutate()}
			>
				Enregistrer
			</button>
			<MutationError error={saveMutation.error} />
		</div>
	);
}

function CreditRow({
	name,
	index,
	roles,
	label,
	onRemove,
}: {
	name: string;
	index: number;
	roles: Array<CreditRole>;
	label: string;
	onRemove: () => void;
}) {
	const { control, register, setValue } = useFormContext();
	const [kind, entityId] = useWatch({ control, name: [`${name}.${index}.kind`, `${name}.${index}.entityId`] });
	const { data: entities = [] } = useQuery(entitiesQuery(kind));
	const [editing, setEditing] = useState(false);
	const entity = entities.find(({ id }) => id === entityId);

	return (
		<>
			<div className="full-fields-row">
				<select
					{...register(`${name}.${index}.role`, {
						// a new row follows its role's kind
						onChange: (e) => {
							if (!entityId) {
								setValue(
									`${name}.${index}.kind`,
									roles.find(({ value }) => value === e.target.value)?.kind,
								);
							}
						},
					})}
					aria-label={`${label} ${index + 1} : rôle`}
				>
					{roles.map(({ value, label: roleLabel }) => (
						<option key={value} value={value}>
							{roleLabel}
						</option>
					))}
				</select>
				<select
					{...register(`${name}.${index}.kind`, {
						// another kind: the entity picked is not of it
						onChange: () => setValue(`${name}.${index}.entityId`, ""),
					})}
					aria-label={`${label} ${index + 1} : type`}
				>
					{KINDS.map(({ value, label: kindLabel }) => (
						<option key={value} value={value}>
							{kindLabel}
						</option>
					))}
				</select>
				<Controller
					control={control}
					name={`${name}.${index}.entityId`}
					render={({ field: { value, onChange } }) => (
						<EntitySearchSelect
							kind={kind}
							value={value}
							onChange={(id) => onChange(id ?? "")}
							aria-label={`${label} ${index + 1}`}
						/>
					)}
				/>
				<input
					type="text"
					{...register(`${name}.${index}.creditedAs`)}
					placeholder="Crédité·e comme"
					aria-label={`${label} ${index + 1} crédité·e comme`}
				/>
				{entity && (
					<button type="button" onClick={() => setEditing(!editing)} title="Modifier l'entité">
						<i className="fa-regular fa-pen-to-square"></i>
					</button>
				)}
				<button type="button" onClick={onRemove} title="Supprimer">
					<i className="fa-regular fa-trash-can"></i>
				</button>
			</div>
			{editing && entity && (
				<EntityEditor
					entity={entity}
					onDone={(newKind) => {
						setEditing(false);
						// the entity moved to another kind: the row follows it
						if (newKind !== kind) setValue(`${name}.${index}.kind`, newKind);
					}}
				/>
			)}
		</>
	);
}

// The credits of a program or an episode, in order
export default function CreditRows({ name, roles, label }: { name: string; roles: Array<CreditRole>; label: string }) {
	const { control } = useFormContext();
	const { fields, append, remove } = useFieldArray({ control, name });

	return (
		<div className="form-field full-width">
			<span>{label}</span>
			{fields.map((field, index) => (
				<CreditRow
					key={field.id}
					name={name}
					index={index}
					roles={roles}
					label={label}
					onRemove={() => remove(index)}
				/>
			))}
			<div>
				<button
					type="button"
					onClick={() =>
						append({
							entityId: "",
							kind: roles[0].kind,
							role: roles[0].value,
							creditedAs: "",
						} satisfies CreditInput)
					}
				>
					<i className="fa-regular fa-plus"></i> Ajouter un crédit
				</button>
			</div>
		</div>
	);
}
