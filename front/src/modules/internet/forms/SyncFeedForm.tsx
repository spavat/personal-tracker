import { SyncUnknownFeedsResponse } from "@personal-tracker/shared/internet";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";

import MutationError from "../../../components/MutationError";
import { ignoreFeed, linkFeed, programsQuery, reprocessSync, save } from "../api";
import ProgramForm from "./ProgramForm";
import { onSubmitProgram, type ProgramInputs } from "./ProgramForm.utils";

type Feed = SyncUnknownFeedsResponse[number];

// case and accents ignored, to preselect the program named like the feed
const normalize = (text: string) =>
	text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.trim();

// Step 1 of a sync: a feed without program is linked to an existing program, or a new program is created for it
export default function SyncFeedForm({ feed, onDone }: { feed: Feed; onDone: () => void }) {
	const queryClient = useQueryClient();
	const { data: programs } = useSuspenseQuery(programsQuery());
	const podcasts = programs
		.filter((program) => program.type === "podcast")
		.sort((a, b) => a.name.localeCompare(b.name));
	const preselected = podcasts.find((program) => normalize(program.name) === normalize(feed.title));

	const [showNewProgram, setShowNewProgram] = useState(false);
	const [programId, setProgramId] = useState(preselected?.id ?? "");

	const methods = useForm<ProgramInputs>({
		defaultValues: {
			program: { name: feed.title, type: "podcast", refs: [{ key: "rss", value: feed.rssUrl }] },
		},
	});

	const linkMutation = useMutation({
		mutationFn: () => linkFeed({ rssUrl: feed.rssUrl, programId }),
		onSuccess: onDone,
	});

	const createMutation = useMutation({
		mutationFn: async (data: ProgramInputs) => {
			await save({ program: onSubmitProgram(data) });
			// the new program holds the feed url: its proposals can now be matched
			await reprocessSync(feed.rssUrl);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["programs"] });
			onDone();
		},
	});

	const ignoreMutation = useMutation({
		mutationFn: () => ignoreFeed({ rssUrl: feed.rssUrl }),
		onSuccess: onDone,
	});

	const isPending = linkMutation.isPending || createMutation.isPending || ignoreMutation.isPending;

	const onCreate: SubmitHandler<ProgramInputs> = (data) => createMutation.mutate(data);

	return (
		<div className="panel sync-feed">
			<div className="title">
				<h3>
					{feed.title} <small>({feed.count} épisode(s))</small>
				</h3>
				<button type="button" onClick={() => setShowNewProgram((b) => !b)}>
					{showNewProgram ? "Choisir existant" : "+ Nouveau"}
				</button>
			</div>
			<p className="sync-feed-url">{feed.rssUrl}</p>

			{showNewProgram ? (
				<FormProvider {...methods}>
					<form className="form" onSubmit={methods.handleSubmit(onCreate)}>
						<div className="single-panel">
							<ProgramForm />
						</div>
						<MutationError error={createMutation.error ?? ignoreMutation.error} />
						<div className="form-footer">
							<button type="button" onClick={() => ignoreMutation.mutate()} disabled={isPending}>
								Ignorer
							</button>
							<button type="submit" className="main" disabled={isPending}>
								Créer le programme
							</button>
						</div>
					</form>
				</FormProvider>
			) : (
				<form
					className="form"
					onSubmit={(e) => {
						e.preventDefault();
						linkMutation.mutate();
					}}
				>
					<label className="form-field full-width">
						<span>Programme</span>
						<select
							aria-label={`Programme pour ${feed.title}`}
							value={programId}
							onChange={(e) => setProgramId(e.target.value)}
						>
							<option value=""></option>
							{podcasts.map((program) => (
								<option value={program.id} key={program.id}>
									{program.name}
								</option>
							))}
						</select>
					</label>
					<MutationError error={linkMutation.error ?? ignoreMutation.error} />
					<div className="form-footer">
						<button type="button" onClick={() => ignoreMutation.mutate()} disabled={isPending}>
							Ignorer
						</button>
						<button type="submit" className="main" disabled={!programId || isPending}>
							Associer
						</button>
					</div>
				</form>
			)}
		</div>
	);
}
