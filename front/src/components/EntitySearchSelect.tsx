import type { EntityKind } from "@personal-tracker/shared/entity";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { entitiesQuery, saveEntity } from "./entity-api";
import SearchSelect from "./SearchSelect";

const CREATE_LABEL: Record<EntityKind, (name: string) => string> = {
	person: (name) => `Créer la personne « ${name} »`,
	group: (name) => `Créer le groupe « ${name} »`,
	organization: (name) => `Créer l'organisation « ${name} »`,
};

type EntitySearchSelectProps = {
	kind: EntityKind;
	value?: string | null;
	onChange: (entityId: string | null, name: string) => void;
	placeholder?: string;
	"aria-label"?: string;
};

// Picks an entity of a kind, or creates it from the name typed
export default function EntitySearchSelect({ kind, value, onChange, ...props }: EntitySearchSelectProps) {
	const queryClient = useQueryClient();
	const { data = [] } = useQuery(entitiesQuery(kind));

	const createMutation = useMutation({
		mutationFn: (name: string) => saveEntity({ kind, name, sortName: null }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["entities", kind] }),
	});

	return (
		<SearchSelect
			items={data}
			value={value}
			onChange={onChange}
			onCreate={(name) => createMutation.mutateAsync(name)}
			createLabel={CREATE_LABEL[kind]}
			emptyLabel="Aucun résultat"
			clearTitle="Effacer"
			{...props}
		/>
	);
}
