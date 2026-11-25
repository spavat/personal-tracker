import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import MutationError from "../../../components/MutationError";
import { formatDate, getDurationString } from "../../../utils";
import { addView, setEpisodeStatus, watchlistQuery } from "../api";
import EpisodeTitle from "../components/EpisodeTitle";

// "À voir": the planned episodes of every program, oldest release first
export default function Watchlist() {
	const queryClient = useQueryClient();
	const { data } = useSuspenseQuery(watchlistQuery());
	const onSuccess = () => queryClient.invalidateQueries({ queryKey: ["programs"] });
	// a view takes the episode off the list
	const viewMutation = useMutation({
		mutationFn: ({ programId, episodeId }: { programId: string; episodeId: string }) =>
			addView(programId, episodeId),
		onSuccess,
	});
	const removeMutation = useMutation({
		mutationFn: ({ programId, episodeId }: { programId: string; episodeId: string }) =>
			setEpisodeStatus(programId, episodeId, null),
		onSuccess,
	});

	if (data.length === 0) return <p>Aucun épisode à voir</p>;
	return (
		<>
			<MutationError error={viewMutation.error ?? removeMutation.error} />
			<table className="list watchlist alternate responsive">
				<thead>
					<tr data-title={`${data.length} épisode(s) à voir`}>
						<th className="cell-text">Programme</th>
						<th className="cell-text">Nom</th>
						<th className="cell-date">Sortie</th>
						<th className="cell-duration">Durée</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{data.map(({ programId, programName, episode }) => {
						const ids = { programId, episodeId: episode.id };
						return (
							<tr key={episode.id}>
								<td className="cell-text" data-label="Programme">
									<Link to="/broadcast/$programId" params={{ programId }}>
										{programName}
									</Link>
								</td>
								<td className="cell-text">
									<EpisodeTitle
										episode={episode}
										prefix={
											episode.numberLabel && (
												<span className="number-label">{episode.numberLabel} · </span>
											)
										}
									>
										{episode.views.length > 0 && (
											<span className="episode-status"> (déjà vu ×{episode.views.length})</span>
										)}
									</EpisodeTitle>
								</td>
								<td className="cell-date" data-label="Sortie">
									{episode.releaseDate && formatDate(episode.releaseDate)}
								</td>
								<td className="cell-duration" data-label="Durée">
									{episode.duration > 0 && getDurationString(episode.duration)}
								</td>
								<td data-label="Actions">
									<button
										type="button"
										title="Vu aujourd'hui"
										disabled={viewMutation.isPending}
										onClick={() => viewMutation.mutate(ids)}
									>
										<i className="fa-regular fa-eye"></i> Vu
									</button>
									&nbsp;
									<button
										type="button"
										disabled={removeMutation.isPending}
										onClick={() => removeMutation.mutate(ids)}
									>
										<i className="fa-solid fa-xmark"></i> Retirer
									</button>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</>
	);
}
