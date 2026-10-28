import { EpisodeDataFromSource, ExtractedData } from "@personal-tracker/shared/internet";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";

import FoldablePanel from "../../../components/foldable-panel";
import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { formatDate, formatDateTime, getCurrentOrPreviousDate } from "../../../utils";
import {
	getDirectLatestEpisodes,
	getInfoFromLink,
	getLatestEpisodes,
	programDetailsQuery,
	programsQuery,
	save,
} from "../api";
import EpisodeForm from "../forms/EpisodeForm";
import { type EpisodeInputs, onSubmitEpisode } from "../forms/EpisodeForm.utils";
import ProgramForm from "../forms/ProgramForm";
import { onSubmitProgram, type ProgramInputs } from "../forms/ProgramForm.utils";

interface Inputs extends EpisodeInputs, ProgramInputs {
	programId: string;
}

export default function AddEpisodeModalForm({ programId, returnTo }: { programId?: string; returnTo: string }) {
	const navigate = useNavigate();
	const forceLatestRef = useRef("");
	const [initialLink, setInitialLink] = useState("");
	const [directLatestParams, setDirectLatestParams] = useState("");
	const [directLinkFolded, setDirectLinkFolded] = useState(false);
	const [latestEpisodesFolded, setLatestEpisodesFolded] = useState(false);
	const latestEpisodesKey = programId || directLatestParams;

	const queryClient = useQueryClient();
	const { data: programs } = useSuspenseQuery(programsQuery());
	const programData = useOptionalSuspenseQuery(programId ? programDetailsQuery(programId) : undefined);
	const {
		data: latestEpisodesData,
		isEnabled,
		isSuccess,
		isError,
		isFetching,
		refetch: refetchLatestEpisodes,
		// forceLatestRef is left out of the queryKey on purpose: a forced refresh must update the same cache entry
		// oxlint-disable-next-line @tanstack/query/exhaustive-deps
	} = useQuery({
		queryKey: ["program", "latest", programId || directLatestParams],
		queryFn: () => {
			if (programId) {
				return getLatestEpisodes(programId, forceLatestRef.current);
			} else if (directLatestParams) {
				return getDirectLatestEpisodes(directLatestParams);
			}
		},
		enabled: Boolean((programId && Object.keys(programData?.refs ?? {}).length > 0) || directLatestParams),
	});

	const extractMutation = useMutation({
		mutationFn: getInfoFromLink,
	});
	const saveMutation = useMutation({
		mutationFn: save,
		onSuccess: () => {
			methods.reset();
			queryClient.invalidateQueries({ queryKey: ["programs"] });
			queryClient.invalidateQueries({ queryKey: ["program", programId] });
			closeModal();
		},
	});

	const [searchText, setSearchText] = useState("");

	const methods = useForm<Inputs>({
		defaultValues: {
			episode: {
				date: getCurrentOrPreviousDate(),
				tags: [],
				contextTags: [],
			},
			programId,
		},
	});

	const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
	const [showAddProgramPanel, setShowAddProgramPanel] = useState(false);

	function changeInitialLink(e: React.ChangeEvent<HTMLInputElement>) {
		setInitialLink(e.target.value);
	}

	function selectSuggestedProgram(programId: string) {
		methods.setValue("programId", programId);
	}
	function addNewProgram(b: boolean) {
		methods.setValue("programId", "");
		if (extractedData?.author) {
			methods.setValue("program.name", extractedData.author?.name ?? "");
			methods.setValue("program.description", extractedData.author?.description ?? "");
			methods.setValue("program.type", extractedData.author?.type ?? "");
			methods.setValue(
				"program.refs",
				extractedData.author.type === "youtube"
					? [{ key: "youtubeChannelId", value: extractedData.author.channelId ?? "" }]
					: [],
			);
			methods.setValue("program.links", [{ value: extractedData.author?.url ?? "" }]);
		}
		setShowAddProgramPanel(b);
	}

	function extractLink() {
		setExtractedData(null);
		extractMutation.mutate(initialLink, {
			onSuccess: (data) => {
				if (data) {
					methods.setValue("episode.name", data.title);
					methods.setValue("episode.duration", data.durationInMinutes);
					methods.setValue("episode.type", data.type);
					methods.setValue("episode.link", data.link ?? "");
					methods.setValue("episode.externalId", data.id ?? "");
					setExtractedData(data);
				}
			},
		});
	}

	function onChangeProgramId() {
		setShowAddProgramPanel(false);
		methods.setValue("program", { name: "" });
	}

	function closeModal() {
		setShowAddProgramPanel(false);
		methods.reset();
		setExtractedData(null);
		setInitialLink("");
		setSearchText("");
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	const onSubmit: SubmitHandler<Inputs> = (data) => {
		const dataEpisode = onSubmitEpisode(data);
		let dataProgram = null;
		if (showAddProgramPanel) {
			dataProgram = onSubmitProgram(data);
		}
		console.log("sauvegarde episode", dataEpisode, "et programme", dataProgram);
		saveMutation.mutate({
			episode: {
				...dataEpisode,
			},
			programId: data.programId,
			...(!data.programId
				? {
						program: {
							...dataProgram,
						},
					}
				: {}),
		} as any);
	};

	function selectEpisode(id: string) {
		const selectedEpisode = latestEpisodesData?.latestEpisodes.find((episode) => episode.id === id);
		if (selectedEpisode) {
			setLatestEpisodesFolded(true);
			const link = selectedEpisode.link ?? "";
			methods.setValue("episode.name", selectedEpisode.title);
			methods.setValue("episode.duration", selectedEpisode.durationInMinutes);
			methods.setValue("episode.date", getCurrentOrPreviousDate());
			methods.setValue("episode.link", selectedEpisode.link ?? "");
			methods.setValue("episode.type", selectedEpisode.type);
			methods.setValue("episode.externalId", selectedEpisode.id);

			if (!selectedEpisode.durationInMinutes) {
				extractMutation.mutate(link, {
					onSuccess: (data) => {
						if (data && data.durationInMinutes) {
							methods.setValue("episode.duration", data.durationInMinutes);
						}
					},
				});
			}
		}
	}

	// Process episodes to display in the quick zone
	let quickAccessEpisodes: Array<EpisodeDataFromSource> = (latestEpisodesData?.latestEpisodes ?? []).slice();
	if (searchText) {
		quickAccessEpisodes = quickAccessEpisodes.filter((ep) =>
			ep.title.toLocaleLowerCase().includes(searchText.toLocaleLowerCase()),
		);
	}
	quickAccessEpisodes = quickAccessEpisodes.splice(0, 5);

	function askLatestEpisodes(type: string, url: string) {
		setDirectLatestParams(`?url=${url}&type=${type}`);
	}

	async function refreshLatestEpisodes(type: string) {
		forceLatestRef.current = type;
		await refetchLatestEpisodes();
		forceLatestRef.current = "";
	}

	return (
		<FormProvider {...methods}>
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<Modal
					className={`form modal ${showAddProgramPanel ? "dialog-extralarge" : "dialog-medium"}`}
					isOpen={true}
					onClose={closeModal}
					hasCloseBtn={true}
				>
					<div className="dialog-header">
						<h2 id="dialog-title">Ajouter épisode</h2>
					</div>

					<div className="dialog-body double-panel">
						<div className="form_part_1">
							{latestEpisodesKey && isEnabled && (
								<FoldablePanel
									className={"latest"}
									folded={latestEpisodesFolded}
									onToggle={() => setLatestEpisodesFolded(!latestEpisodesFolded)}
									titleContent={
										!isError && (
											<h3>
												Accès rapide :&nbsp;
												<span>
													<input
														type="text"
														value={searchText}
														onChange={(e) => setSearchText(e.target.value ?? "")}
														placeholder={
															!isFetching
																? `Recherche dans ${latestEpisodesData?.latestEpisodes?.length} épisodes`
																: ""
														}
														disabled={isFetching}
													/>{" "}
												</span>
												{Object.keys(programData?.refs ?? {}).map((key) => {
													return (
														<span key={key}>
															<button
																type="button"
																onClick={() => refreshLatestEpisodes(key)}
																disabled={isFetching}
																className={`button-${key}`}
															>
																<span className="icon-badge-wrap">
																	{key === "youtubeChannelId" && (
																		<i className="fa-brands fa-youtube"></i>
																	)}
																	{key === "youtubePlaylistId" && (
																		<i className="fa-solid fa-list"></i>
																	)}
																	{key === "rss" && (
																		<i className="fa-solid fa-rss"></i>
																	)}
																	{key === latestEpisodesData?.type && (
																		<i className="fa-solid fa-circle-check icon-badge lightgreen"></i>
																	)}
																</span>
															</button>
															{key === latestEpisodesData?.type && (
																<span className={`tooltip tooltip-${key}`}>
																	Dernier refresh : <br />
																	{formatDateTime(latestEpisodesData.dateTimeUtc)}
																</span>
															)}
														</span>
													);
												})}
											</h3>
										)
									}
									panelContent={
										<>
											{isFetching && <div className="loading">Chargement en cours&hellip;</div>}
											{isError && !isFetching && (
												<div className="error">
													Impossible de récupérer les derniers épisodes.
												</div>
											)}
											{isSuccess && !isFetching && (
												<>
													<ul className="monospace">
														{quickAccessEpisodes.map((episode) => (
															<li key={episode.id}>
																<a onClick={() => selectEpisode(episode.id)}>
																	<span
																		className={
																			episode.view ? "icon-badge-wrap" : ""
																		}
																	>
																		<span className="date smalltext">
																			{formatDate(episode.date)}
																		</span>
																		{Boolean(episode.view) && (
																			<i className="fa-solid fa-circle-check icon-badge lightgreen"></i>
																		)}
																	</span>

																	<span className="titleName">{episode.title}</span>
																	{Boolean(episode.duration) && (
																		<span className="duration">
																			{episode.duration}
																		</span>
																	)}
																</a>
															</li>
														))}
													</ul>
												</>
											)}
										</>
									}
								></FoldablePanel>
							)}
							<FoldablePanel
								className={"directLink"}
								folded={directLinkFolded}
								onToggle={() => setDirectLinkFolded(!directLinkFolded)}
								titleContent={
									<h3>
										Lien direct :&nbsp;
										<span>
											<input
												id="new-link"
												type="text"
												onChange={changeInitialLink}
												value={initialLink}
												autoComplete="off"
											/>
											<button
												type="button"
												onClick={extractLink}
												disabled={!initialLink || extractMutation.isPending}
											>
												Extraire
											</button>
										</span>
									</h3>
								}
								panelContent={
									<ul>
										{(extractedData?.suggestedPrograms ?? []).map((channel) => (
											<li key={channel.id}>
												<a onClick={() => selectSuggestedProgram(channel.id)}>{channel.name}</a>{" "}
												{Boolean(channel.author) && <>({channel.author})</>}
											</li>
										))}
									</ul>
								}
							></FoldablePanel>
							<div className="panel program">
								<div className="title">
									<h3>Programme</h3>
									<button
										type="button"
										onClick={() => addNewProgram(true)}
										title="Ajouter un nouveau programme"
									>
										+
									</button>
								</div>
								<label>
									<select {...methods.register("programId", { onChange: onChangeProgramId })}>
										<option value=""></option>
										{programs.map((channel) => (
											<option value={channel.id} key={channel.id}>
												{channel.name}
											</option>
										))}
									</select>
								</label>
							</div>
							<EpisodeForm />
							<MutationError error={extractMutation.error} />
						</div>
						{showAddProgramPanel && (
							<div className="form_part_2">
								<h3>Nouveau programme</h3>
								<ProgramForm onLatestAsked={askLatestEpisodes} />
							</div>
						)}
					</div>

					<div className="dialog-footer">
						<MutationError error={saveMutation.error} />
						<button type="button" onClick={closeModal}>
							Annuler
						</button>
						<button type="submit" className="main" disabled={saveMutation.isPending}>
							Enregistrer
						</button>
					</div>
				</Modal>
			</form>
		</FormProvider>
	);
}
