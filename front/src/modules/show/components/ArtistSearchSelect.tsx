import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import SearchSelect from "../../../components/SearchSelect";
import { artistsQuery, saveArtist } from "../api";

type ArtistSearchSelectProps = {
	value?: number;
	onChange: (artistId: number, artistName: string) => void;
	placeholder?: string;
};

export default function ArtistSearchSelect({ value, onChange, placeholder }: ArtistSearchSelectProps) {
	const queryClient = useQueryClient();
	const { data = [] } = useQuery(artistsQuery());

	const createMutation = useMutation({
		mutationFn: saveArtist,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shows", "artists"] }),
	});

	return (
		<SearchSelect
			items={data}
			value={value}
			// no artist = 0
			onChange={(artistId, artistName) => onChange(artistId ?? 0, artistName)}
			onCreate={(name) => createMutation.mutateAsync({ name })}
			createLabel={(name) => `Créer l'artiste « ${name} »`}
			emptyLabel="Aucun artiste"
			clearTitle="Effacer l'artiste"
			placeholder={placeholder}
		/>
	);
}
