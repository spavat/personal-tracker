import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Fragment, SubmitEvent, useState } from "react";

import { API_BASE_URL } from "../../../config";
import { formatDate, formatDateTime } from "../../../utils";
import {
	gopodderStatusQuery,
	programsQuery,
	reprocessSync,
	syncGopodder,
	syncQuery,
	unknownFeedsQuery,
	uploadSync,
} from "../api";
import SyncFeedForm from "../forms/SyncFeedForm";
import SyncItemForm from "../forms/SyncItemForm";

function SyncUploadForm() {
	const queryClient = useQueryClient();
	const [file, setFile] = useState<File | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);

	const uploadMutation = useMutation({
		mutationFn: uploadSync,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sync"] }),
	});

	function onSubmit(e: SubmitEvent<HTMLFormElement>) {
		e.preventDefault();
		if (file) uploadMutation.mutate(file);
	}

	return (
		<form className="form panel sync-upload" onSubmit={onSubmit}>
			<h3>AntennaPod</h3>
			<p>Récupération manuelle des écoutes avec un backup de l'application AntennaPod</p>
			<div
				className={["sync-drop-zone", isDragOver ? "drag-over" : "", file ? "has-file" : ""].join(" ").trim()}
				onDragOver={(e) => {
					e.preventDefault();
					setIsDragOver(true);
				}}
				onDragLeave={() => setIsDragOver(false)}
				onDrop={(e) => {
					e.preventDefault();
					setIsDragOver(false);
					setFile(e.dataTransfer.files[0] ?? null);
				}}
			>
				{file ? (
					<>
						<i className="fa-solid fa-check"></i> {file.name}
						&nbsp;
						<button type="button" onClick={() => setFile(null)} title="Supprimer">
							✕
						</button>
					</>
				) : (
					<>
						<i className="fa-solid fa-file-import"></i>
						&nbsp;Glisser-déposer une sauvegarde AntennaPod (.db)
						<br />
						<label>
							ou parcourir
							<input
								type="file"
								accept=".db"
								aria-label="Sauvegarde AntennaPod (.db)"
								onChange={(e) => setFile(e.target.files?.[0] ?? null)}
							/>
						</label>
					</>
				)}
			</div>
			{uploadMutation.error && <div>Erreur : {uploadMutation.error.message}</div>}
			{uploadMutation.data?.count === 0 && <p>Aucun épisode écouté dans cette sauvegarde</p>}
			<div className="form-footer">
				<button type="submit" className="main" disabled={!file || uploadMutation.isPending}>
					{uploadMutation.isPending ? "Analyse en cours…" : "Envoyer"}
				</button>
			</div>
		</form>
	);
}

function SyncGopodderPanel() {
	const queryClient = useQueryClient();
	const { data: status } = useSuspenseQuery(gopodderStatusQuery());

	const syncMutation = useMutation({
		mutationFn: syncGopodder,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sync"] }),
	});

	let message = "";
	if (syncMutation.data?.initialized) {
		message = "Point de départ enregistré : les prochaines écoutes seront proposées";
	} else if (syncMutation.data?.count === 0) {
		message = "Aucun nouvel épisode";
	}

	return (
		<div className="form panel sync-upload">
			<h3>gopodder</h3>
			<p>
				Récupèration des écoutes synchronisées sur gopodder par AntennaPod depuis la dernière synchronisation.
			</p>
			<p className="sync-last">
				Dernière synchronisation :{" "}
				{status.lastSync ? formatDateTime(status.lastSync, { withWeekday: true }) : "jamais"}
			</p>
			{syncMutation.error && <div>Erreur : {syncMutation.error.message}</div>}
			{message && <p>{message}</p>}
			<div className="form-footer">
				<button
					type="button"
					className="main"
					onClick={() => syncMutation.mutate()}
					disabled={syncMutation.isPending}
				>
					{syncMutation.isPending ? "Synchronisation…" : "Synchroniser"}
				</button>
			</div>
		</div>
	);
}

export default function Sync() {
	const queryClient = useQueryClient();
	const { data } = useSuspenseQuery(syncQuery());
	const { data: unknownFeeds } = useSuspenseQuery(unknownFeedsQuery());
	const { data: programs } = useSuspenseQuery(programsQuery());
	const [displayForm, setDisplayForm] = useState(false);

	const reprocessMutation = useMutation({
		mutationFn: () => reprocessSync(),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sync"] }),
	});

	if (!data.length) {
		return (
			<>
				<h2>Synchronisation</h2>
				<div className="sync-sources">
					<SyncUploadForm />
					<SyncGopodderPanel />
				</div>
			</>
		);
	}

	// Step 1: every feed must match a program before the episodes are reviewed
	if (unknownFeeds.length) {
		return (
			<>
				<h2>Étape 1 : podcasts inconnus ({unknownFeeds.length})</h2>
				<div className="sync-list">
					{unknownFeeds.map((feed) => (
						<SyncFeedForm
							key={feed.rssUrl}
							feed={feed}
							onDone={() => queryClient.invalidateQueries({ queryKey: ["sync"] })}
						/>
					))}
				</div>
			</>
		);
	}

	return (
		<>
			<h2>
				Étape 2 : épisodes ({data.length})
				<label>
					<input type="checkbox" checked={displayForm} onChange={(e) => setDisplayForm(e.target.checked)} />{" "}
					Afficher formulaire
				</label>
			</h2>
			<div className="sync-list">
				{data.map((item) => {
					const program = programs.find((p) => p.id === item.proposition?.programId);

					const localDateTime = item.origin.datetime.split("Z")[0];
					const [weekday, date, time] = formatDateTime(localDateTime, { withWeekday: true }).split(" ");

					const useDurationReal = item.proposition?.durationReal !== undefined;
					return (
						<Fragment key={item.id}>
							<div className="card_item card_sync_item">
								<div className="date">
									<p>{weekday}</p>
									<p>
										<b>{date}</b>
									</p>
									<p>{time}</p>
								</div>
								<p className="info">
									<span>
										<b>{item.origin.program}</b>
									</span>
									<br />
									{item.origin.episode}
									{item.alreadySaved && (
										<>
											{" "}
											<i
												className="fa-solid fa-circle-info"
												title={`Épisode déjà enregistré le ${formatDate(item.alreadySaved.date)}`}
												aria-label={`Épisode déjà enregistré le ${formatDate(item.alreadySaved.date)}`}
											></i>
										</>
									)}
								</p>
								<div className="arrow">
									<i className="fa-solid fa-right-long fa-2xl"></i>
								</div>
								<div className="proposition">
									{item.proposition?.programProfile && (
										<img
											src={`${API_BASE_URL}${item.proposition?.programProfile}`}
											alt=""
											className="profile-thumbnail"
											loading="lazy"
										/>
									)}
								</div>
								<div className="proposition-details">
									{item.proposition && (
										<>
											{program && (
												<Link to={`/internet/$programId`} params={{ programId: program.id }}>
													{program.name}
												</Link>
											)}
											<br />
											{item.proposition.name}
											<br />
											Durée :{" "}
											{useDurationReal
												? item.proposition.durationReal
												: item.proposition.duration}
											{useDurationReal && "*"}
											{item.proposition.durationReal === 0 && (
												<i className="fa-solid fa-triangle-exclamation"></i>
											)}
											<br />
											Date : {formatDate(item.proposition.date)}
										</>
									)}
								</div>
							</div>
							{displayForm && (
								<div className="panel sync-item">
									<SyncItemForm
										item={item}
										onDone={() => queryClient.invalidateQueries({ queryKey: ["sync"] })}
									/>
								</div>
							)}
						</Fragment>
					);
				})}
			</div>

			<div className="fab-container">
				<button
					type="button"
					className="fab-main"
					title="Recalculer les propositions"
					onClick={() => reprocessMutation.mutate()}
					disabled={reprocessMutation.isPending}
				>
					<div className="pulse"></div>
					<div className="heart-line">
						<i className={`fa-solid fa-arrows-rotate${reprocessMutation.isPending ? " fa-spin" : ""}`}></i>
					</div>
				</button>
			</div>
		</>
	);
}
