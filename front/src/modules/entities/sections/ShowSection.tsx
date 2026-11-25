import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useOptimistic, useTransition } from "react";

import { PendingContent } from "../../../components/PendingContent";
import { useStoredValue } from "../../../hooks/stored-value";
import { artistDetailsQuery } from "../../show/api";
import ArtistPerformanceTable from "../../show/components/ArtistPerformanceTable";
import { GROUP_BY_SPECTACLE_KEY } from "../constants";

// The entity's performances, as on its show artist page, and its roles in the spectacles' cast models
export default function ShowSection({ entityId }: { entityId: string }) {
	const [groupBySpectacle, setGroupBySpectacle] = useStoredValue(GROUP_BY_SPECTACLE_KEY, false);
	const [isPending, startTransition] = useTransition();
	const [optimisticGroupBySpectacle, setOptimisticGroupBySpectacle] = useOptimistic(groupBySpectacle);
	function changeGroupBySpectacle(e: React.ChangeEvent<HTMLInputElement>) {
		// transition: keep the current performances displayed while the new grouping loads
		const checked = e.target.checked;
		startTransition(() => {
			setOptimisticGroupBySpectacle(checked);
			setGroupBySpectacle(checked);
		});
	}

	const { data: artist } = useSuspenseQuery(artistDetailsQuery(entityId, groupBySpectacle));

	return (
		<section className="shows">
			<h2>🎭 Spectacles</h2>
			{artist.stats.nbPerformances > 0 && (
				<>
					<h3>
						Représentations
						<label>
							<input
								type="checkbox"
								checked={optimisticGroupBySpectacle}
								onChange={changeGroupBySpectacle}
							/>{" "}
							Grouper par spectacle
						</label>
					</h3>
					<PendingContent isPending={isPending}>
						<ArtistPerformanceTable groups={artist.groups} groupBySpectacle={groupBySpectacle} />
					</PendingContent>
				</>
			)}
			{artist.models.length > 0 && (
				<>
					<h3>Modèles</h3>
					<table className="list alternate responsive">
						<thead>
							<tr>
								<th className="cell-text">Spectacle</th>
								<th className="cell-text">Modèle</th>
								<th className="cell-text">Rôle</th>
							</tr>
						</thead>
						<tbody>
							{artist.models.map((model) => (
								<tr key={model.id}>
									<td className="cell-text" data-label="Spectacle">
										<Link
											to="/shows/spectacles/$spectacleId"
											params={{ spectacleId: model.spectacle.id }}
											viewTransition
										>
											{model.spectacle.name}
										</Link>
									</td>
									<td className="cell-text" data-label="Modèle">
										{model.model}
									</td>
									<td className="cell-text" data-label="Rôle">
										{model.role}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</>
			)}
		</section>
	);
}
