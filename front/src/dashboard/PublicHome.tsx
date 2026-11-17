import { useSuspenseQuery } from "@tanstack/react-query";

import { WidgetBoundary } from "../components/WidgetBoundary";
import CardGame from "../modules/game/components/CardGame";
import "../modules/game/module.css";
import { latestQuery } from "../modules/home/api";
import CardProgram from "../modules/internet/components/CardProgram";
import "../modules/internet/module.css";
import CardBook from "../modules/reading-book/components/CardBook";
import "../modules/reading-book/module.css";
import CardManga from "../modules/reading-manga/components/CardManga";
import "../modules/reading-manga/module.css";
import { mergeReadings } from "../modules/reading-manga/utils";
import CardPerformance from "../modules/show/components/CardPerformance";
import "../modules/show/module.css";
import { formatDate } from "../utils";

// Home page of everyone; the owner also has MainDashboard (private data) on /dashboard
export default function PublicHome() {
	return (
		<div className="stats">
			<p>Bienvenue sur Personal Tracker</p>
			<WidgetBoundary>
				<Latest />
			</WidgetBoundary>
		</div>
	);
}

// each section takes its module's class, for the module's card styles
function Latest() {
	const { data } = useSuspenseQuery(latestQuery);
	return (
		<>
			<section className="shows">
				<h2>Derniers spectacles</h2>
				<div className="grid">
					{data.show.map((performance) => (
						<CardPerformance key={performance.id} performance={performance} />
					))}
				</div>
			</section>

			<section className="internet">
				<h2>Derniers épisodes (Podcast / Vidéo)</h2>
				<div className="grid">
					{data.internet.map((program) => (
						<CardProgram key={program.id} program={program} />
					))}
				</div>
			</section>

			<section>
				<h2>Dernières écoutes</h2>
				<ul>
					{data.music.map((listening) => (
						<li key={listening.id}>
							{listening.artist.join(", ")} – {listening.album} ({formatDate(listening.date)})
						</li>
					))}
				</ul>
			</section>

			<section className="reading-manga">
				<h2>Derniers mangas</h2>
				<div className="grid">
					{data["reading-manga"].map((manga) => (
						<CardManga
							key={manga.id}
							manga={{ ...manga, mergedReadings: mergeReadings(manga.readings ?? [], { sort: "asc" }) }}
						/>
					))}
				</div>
			</section>

			<section className="reading-book">
				<h2>Derniers livres</h2>
				<div className="grid">
					{data["reading-book"].map((book) => (
						<CardBook key={book.id} book={book} />
					))}
				</div>
			</section>
			<section className="game">
				<h2>Derniers jeux</h2>
				<div className="grid">
					{data.game.map((game) => (
						<CardGame key={game.id} game={game} />
					))}
				</div>
			</section>
		</>
	);
}
