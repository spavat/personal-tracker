import type { RefIdsEnum } from "@personal-tracker/shared/broadcast";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import MutationError from "../../../../components/MutationError";
import { useIsOwner } from "../../../../hooks/use-is-owner";
import { importCatalog, programDetailsQuery } from "../../api";
import CatalogEpisodes from "./CatalogEpisodes";
import FeedEpisodes from "./FeedEpisodes";
import ProgramHeader from "./ProgramHeader";

// the sources a catalog is imported from (one at a time: their episodes never match each other's)
const IMPORT_SOURCES: Array<{ source: RefIdsEnum; label: string; icon: string }> = [
	{ source: "rss", label: "RSS", icon: "fa-solid fa-rss" },
	{ source: "youtubeChannelId", label: "chaîne YouTube", icon: "fa-brands fa-youtube" },
	{ source: "youtubePlaylistId", label: "playlist YouTube", icon: "fa-solid fa-list" },
];

export default function ProgramDetails({ programId }: { programId: string }) {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();

	function openListModal(to: "/broadcast/$programId/seasons" | "/broadcast/$programId/formats") {
		navigate({
			to,
			params: { programId },
			search: { returnTo: location.pathname },
			replace: true,
			resetScroll: false,
			mask: { to: "/broadcast/$programId", params: { programId } },
		});
	}

	function goToCreationModal() {
		navigate({
			to: "/broadcast/$programId/add",
			params: { programId },
			search: { returnTo: location.pathname },
			replace: true,
			resetScroll: false,
			mask: { to: "/broadcast/$programId", params: { programId } },
		});
	}

	useHotkeys(
		"ctrl+shift+n",
		(e) => {
			e.preventDefault();
			goToCreationModal();
		},
		{ enabled: isOwner },
	);

	const { data: program } = useSuspenseQuery(programDetailsQuery(programId));
	const isCatalog = program.tracking === "catalog";
	const [showAsFeed, setShowAsFeed] = useState(false); // Toggle Catalogue / Feed
	const [hideSkipped, setHideSkipped] = useState(true); // Catalogue view: Hide skipped episodes
	const [groupBySeason, setGroupBySeason] = useState(true); // Feed view: Group episodes by season (or flat)
	const showCatalogueView = isCatalog && !showAsFeed;

	const queryClient = useQueryClient();
	const importMutation = useMutation({
		mutationFn: (source: RefIdsEnum) => importCatalog(programId, source),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["programs"] });
			queryClient.invalidateQueries({ queryKey: ["program", programId] });
		},
	});

	function openView(action: "edit" | "delete", viewId: string) {
		navigate({
			to:
				action === "edit"
					? "/broadcast/$programId/view/$viewId/edit"
					: "/broadcast/$programId/view/$viewId/delete",
			params: { programId, viewId },
			search: { returnTo: location.pathname },
			replace: true,
			resetScroll: false,
			mask: { to: "/broadcast/$programId", params: { programId } },
		});
	}

	// the episode's details, read only
	function openEpisode(episodeId: string) {
		navigate({
			to: "/broadcast/$programId/episode/$episodeId",
			params: { programId, episodeId },
			search: { returnTo: location.pathname },
			replace: true,
			resetScroll: false,
			mask: { to: "/broadcast/$programId", params: { programId } },
		});
	}

	const [formatFilter, setFormatFilter] = useState("");

	return (
		<>
			<ProgramHeader program={program} />
			<h2>
				{isCatalog && (
					<button type="button" onClick={() => setShowAsFeed(!showAsFeed)} aria-label="Switch view">
						<i className="fa-solid fa-right-left"></i>
					</button>
				)}
				{showCatalogueView ? "Catalogue" : "Flux de visionnage"}
				{showCatalogueView && (
					<label>
						<input
							type="checkbox"
							checked={hideSkipped}
							onChange={(e) => setHideSkipped(e.target.checked)}
						/>{" "}
						Cacher épisodes ignorés
					</label>
				)}
				{!showCatalogueView && program.seasons.length > 0 && (
					<label>
						<input
							type="checkbox"
							checked={groupBySeason}
							onChange={(e) => setGroupBySeason(e.target.checked)}
						/>{" "}
						Grouper par saisons
					</label>
				)}
				<span className="right">
					{program.formats.length > 0 && (
						<label>
							Format :{" "}
							<select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}>
								<option value="">Tous</option>
								{program.formats.map((format) => (
									<option key={format.id} value={format.id}>
										{format.label}
									</option>
								))}
							</select>
						</label>
					)}
					{/* a catalog imports every release, a feed completes its episodes */}
					{isOwner &&
						IMPORT_SOURCES.filter(({ source }) => program.refs?.[source]).map(({ source, label, icon }) => (
							<button
								key={source}
								type="button"
								disabled={importMutation.isPending}
								onClick={() => importMutation.mutate(source)}
							>
								<i className={icon}></i>{" "}
								{isCatalog ? "Importer le catalogue" : "Compléter les épisodes"} ({label})
							</button>
						))}
					{importMutation.data && (
						<span className="import-result">
							{isCatalog && <>{importMutation.data.created} ajouté(s), </>}
							{importMutation.data.updated} mis à jour
						</span>
					)}
					<MutationError error={importMutation.error} />
					{isOwner && (
						<>
							<button type="button" onClick={() => openListModal("/broadcast/$programId/seasons")}>
								<i className="fa-solid fa-layer-group"></i> Saisons
							</button>
							<button type="button" onClick={() => openListModal("/broadcast/$programId/formats")}>
								<i className="fa-solid fa-tags"></i> Formats
							</button>
						</>
					)}
				</span>
			</h2>

			{showCatalogueView ? (
				<CatalogEpisodes
					program={program}
					formatFilter={formatFilter}
					hideSkipped={hideSkipped}
					openView={openView}
					openEpisode={openEpisode}
				/>
			) : (
				<FeedEpisodes
					program={program}
					formatFilter={formatFilter}
					groupBySeason={groupBySeason}
					openView={openView}
					openEpisode={openEpisode}
				/>
			)}

			{isOwner && (
				<div className="fab-container">
					<button type="button" className="fab-main" onClick={goToCreationModal} title="Ajouter un épisode">
						<div className="pulse"></div>
						<div className="heart-line">
							<i className="fa-solid fa-plus"></i>
						</div>
					</button>
				</div>
			)}

			<Outlet />
		</>
	);
}
