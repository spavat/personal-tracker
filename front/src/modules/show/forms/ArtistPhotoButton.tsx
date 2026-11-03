import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { artistsQuery, saveArtist, uploadMedia } from "../api";
import { readFile } from "../utils";

// Adds a photo to an artist from a role row, from a file or a URL: the artist's main photo
// if it has none yet (a just-created artist), else the portrait of this role.
export default function ArtistPhotoButton({
	artistId,
	spectacleId,
	label,
	onRolePortrait,
}: {
	artistId: number;
	spectacleId?: number;
	label?: string;
	onRolePortrait: (mediaId: string) => void;
}) {
	const queryClient = useQueryClient();
	const { data: artists = [] } = useQuery(artistsQuery());
	const artist = artists.find((item) => item.id === artistId);

	// source: data URI of a picked file, or an image URL the server downloads
	const uploadMutation = useMutation({
		mutationFn: async (source: string) => {
			const media = await uploadMedia({ artistId }, { source, label, spectacleId });
			if (artist && !artist.pictureId) {
				await saveArtist({ id: artist.id, name: artist.name, pictureId: media.id });
			} else {
				onRolePortrait(media.id);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["shows", "artists"] });
			queryClient.invalidateQueries({ queryKey: ["shows", "media", "artists", artistId] });
		},
	});

	const target = artist?.pictureId ? "un portrait pour ce rôle" : "la photo de l'artiste";
	const className = `artist-photo-button ${uploadMutation.isError ? "error" : ""}`;

	function fromUrl() {
		const url = window.prompt("URL à utiliser")?.trim();
		if (url) {
			uploadMutation.mutate(url);
		}
	}

	if (uploadMutation.isPending) {
		return <i className="artist-photo-button fa-solid fa-spinner fa-spin" title="Envoi…"></i>;
	}

	return (
		<>
			<label className={className} title={uploadMutation.error?.message ?? `Ajouter ${target}`}>
				<i className="fa-solid fa-camera"></i>
				<input
					type="file"
					accept="image/*"
					hidden
					onChange={async (e) => {
						const file = e.target.files?.[0];
						e.target.value = "";
						if (file) {
							uploadMutation.mutate(await readFile(file));
						}
					}}
				/>
			</label>
			<button
				type="button"
				className={className}
				title={uploadMutation.error?.message ?? `Ajouter ${target} depuis une URL`}
				onClick={fromUrl}
			>
				<i className="fa-solid fa-link"></i>
			</button>
		</>
	);
}
