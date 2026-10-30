import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Fragment, SubmitEvent, useState } from "react";

import { API_BASE_URL } from "../../config";
import { formatDate, formatDateTime } from "../../utils";
import { programsQuery, reprocessSync, syncQuery, uploadSync } from "./api";
import SyncItemForm from "./forms/SyncItemForm";

function SyncUploadForm() {
	const queryClient = useQueryClient();
	const [file, setFile] = useState<File | null>(null);

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
			<label>
				Sauvegarde AntennaPod (.db)
				<input type="file" accept=".db" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
			</label>
			{uploadMutation.error && <div>Erreur : {uploadMutation.error.message}</div>}
			<div className="form-footer">
				<button type="submit" className="main" disabled={!file || uploadMutation.isPending}>
					{uploadMutation.isPending ? "Analyse en cours…" : "Envoyer"}
				</button>
			</div>
		</form>
	);
}

export default function Sync() {
	const queryClient = useQueryClient();
	const { data } = useSuspenseQuery(syncQuery());
	const { data: programs } = useSuspenseQuery(programsQuery());

	const reprocessMutation = useMutation({
		mutationFn: reprocessSync,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sync"] }),
	});

	if (!data.length) {
		return (
			<>
				<h2>Sync</h2>
				<SyncUploadForm />
			</>
		);
	}

	return (
		<>
			<h2>Sync ({data.length})</h2>
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
							<div className="panel sync-item">
								<SyncItemForm
									item={item}
									onDone={() => queryClient.invalidateQueries({ queryKey: ["sync"] })}
								/>
							</div>
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
