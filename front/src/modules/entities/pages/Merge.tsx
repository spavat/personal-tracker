import type { EntityDirectoryItem } from "@personal-tracker/shared/entity";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import MutationError from "../../../components/MutationError";
import PageTitle from "../../../components/PageTitle";
import { entityDetailsQuery, entityNamesQuery, mergeEntities } from "../api";
import { KIND_LABELS, MODULE_NAME } from "../constants";
import { creditCounts } from "../utils";

const summary = (entity: EntityDirectoryItem) =>
	creditCounts(entity)
		.map(({ count, label }) => `${count} ${label}`)
		.join(", ");

/** An entity picker: a filter on the name narrowing a select. */
function EntityPicker({
	label,
	entities,
	value,
	exclude,
	onChange,
}: {
	label: string;
	entities: EntityDirectoryItem[];
	value?: string;
	exclude?: string;
	onChange: (id: string | undefined) => void;
}) {
	const [filter, setFilter] = useState("");
	const wanted = filter.trim().toLowerCase();
	const options = entities.filter(
		(entity) => entity.id !== exclude && (entity.id === value || entity.name.toLowerCase().includes(wanted)),
	);

	return (
		<div className="form-field">
			<label htmlFor={`merge-${label}`}>
				<span>{label}</span>
			</label>
			<input
				type="search"
				placeholder="Filtrer par nom…"
				aria-label={`Filtrer : ${label}`}
				value={filter}
				onChange={(e) => setFilter(e.target.value)}
			/>
			<select id={`merge-${label}`} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
				<option value="">Choisir une entité</option>
				{options.map((entity) => (
					<option key={entity.id} value={entity.id}>
						{entity.name} ({KIND_LABELS[entity.kind]}
						{summary(entity) && ` · ${summary(entity)}`})
					</option>
				))}
			</select>
		</div>
	);
}

/**
 * Merges two entities into one: the main one keeps its name and kind and gets every credit of the secondary one
 * (books, shows, programs, episodes), its external ids and, when it has none, its sort name and portrait; the
 * secondary is deleted.
 */
export default function Merge({ keepId, removeId }: { keepId?: string; removeId?: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: entities } = useSuspenseQuery(entityNamesQuery());
	const keep = entities.find((entity) => entity.id === keepId);
	const remove = entities.find((entity) => entity.id === removeId);

	const mergeMutation = useMutation({
		mutationFn: () => mergeEntities({ keepId: keepId!, removeId: removeId! }),
		onSuccess: ({ id }) => {
			// the secondary is deleted: refetching it would only retry a 404
			queryClient.removeQueries({ queryKey: entityDetailsQuery(removeId!).queryKey });
			// the credits moved: every module crediting them, and the pickers
			for (const queryKey of [["entities"], ["shows"], ["reading"], ["programs"], ["program"]]) {
				queryClient.invalidateQueries({ queryKey });
			}
			navigate({ to: "/entities/$entityId", params: { entityId: id } });
		},
	});

	function select(ids: { keepId?: string; removeId?: string }) {
		navigate({ to: "/entities/merge", search: ids, replace: true, resetScroll: false });
	}

	return (
		<div className="merge">
			<PageTitle title={`${MODULE_NAME} > Fusionner`} />
			<p className="info">
				L'entité principale garde son nom et son type et reçoit tous les crédits de l'entité secondaire (livres,
				spectacles, émissions, épisodes). L'entité secondaire est ensuite supprimée.
			</p>
			<div className="form panel">
				<div className="form-grid">
					<EntityPicker
						label="Entité principale"
						entities={entities}
						value={keepId}
						exclude={removeId}
						onChange={(id) => select({ keepId: id, removeId })}
					/>
					<EntityPicker
						label="Entité secondaire"
						entities={entities}
						value={removeId}
						exclude={keepId}
						onChange={(id) => select({ keepId, removeId: id })}
					/>
				</div>
				<button
					type="button"
					disabled={!keep && !remove}
					onClick={() => select({ keepId: removeId, removeId: keepId })}
				>
					<i className="fa-solid fa-right-left"></i> Inverser
				</button>
			</div>

			{keep && remove && (
				<div className="form panel">
					<h3>Résultat</h3>
					<ul>
						<li>
							<b>{keep.name}</b> garde son nom et son type ({KIND_LABELS[keep.kind]}).
						</li>
						<li>
							Il reçoit les crédits de <b>{remove.name}</b>
							{summary(remove) ? ` (${summary(remove)})` : ""}. Un crédit qu'il a déjà sur la même œuvre
							et avec le même rôle n'est pas doublé.
						</li>
						{!keep.sortName && remove.sortName && <li>Il prend son nom de tri : {remove.sortName}.</li>}
						{!keep.picture && remove.picture && <li>Il prend son portrait.</li>}
						<li>
							<b>{remove.name}</b> est supprimé.
						</li>
					</ul>
					{keep.kind !== remove.kind && (
						<p className="error">
							Les deux entités n'ont pas le même type ({KIND_LABELS[keep.kind]} /{" "}
							{KIND_LABELS[remove.kind]}) : les crédits de {remove.name} passent sous le type «{" "}
							{KIND_LABELS[keep.kind]} ».
						</p>
					)}
					<MutationError error={mergeMutation.error} />
					<div className="form-footer">
						<button
							type="button"
							className="main"
							disabled={mergeMutation.isPending}
							onClick={() => mergeMutation.mutate()}
						>
							<i className="fa-solid fa-code-merge"></i> Fusionner
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
