import { Reading } from "@personal-tracker/shared/reading-manga";
import { Link } from "@tanstack/react-router";

import { formatFullDate } from "../../utils";
import { getStatusIcon } from "./search-fn";
import { FrontManga } from "./types";
import { getMangaPrefixName, getReadingSummary } from "./utils";

function getEdition(manga: Reading) {
	if (manga.type !== "volume") {
		return "";
	}
	if (manga.edition) {
		return `(${manga.edition})`;
	}
	return "";
}

export default function CardManga({ manga }: { manga: FrontManga.ExtendedManga }) {
	let lastReadString = "";
	if (Array.isArray(manga.readings) && manga.readings.length > 0) {
		const lastReading = manga.readings[manga.readings.length - 1];

		const prefix = getMangaPrefixName(lastReading);
		lastReadString = `📅 ${formatFullDate(lastReading.date)} ⚙️${prefix}${lastReading.name} `;
	}

	const status = getStatusIcon(manga, { color: false });

	return (
		<div className="card_item">
			<span className="title">
				<span className="status">{status}</span>
				<Link to="/reading-manga/manga/$mangaId" params={{ mangaId: manga.id }}>
					{manga.title}
				</Link>
			</span>{" "}
			-{" "}
			<span className="subtitle">
				{(manga.author ?? [])
					.concat(manga.art ?? [])
					.concat(manga.scenario ?? [])
					.join(", ")}
			</span>
			<br />
			{lastReadString}
			<details>
				<summary>Lecture : {getReadingSummary(manga.readings ?? [])}</summary>
				{manga.mergedReadings.map((reading) => {
					const prefix = getMangaPrefixName(reading);

					return (
						<div key={`${manga.title}-${reading.name}`} className="monospace">
							{formatFullDate(reading.date)}:{" "}
							<b>
								{prefix}
								{reading.name}
							</b>{" "}
							{getEdition(reading)} {reading.language.toUpperCase()} {reading.origin}
						</div>
					);
				})}
			</details>
		</div>
	);
}
