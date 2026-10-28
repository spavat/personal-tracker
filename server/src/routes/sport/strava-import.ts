const ACTIVITY_TYPE_MAP: Record<string, string> = {
	"Course à pied": "running",
	Natation: "swimming",
	Vélo: "cycling",
	Marche: "walking",
	Randonnée: "hiking",
	"Ski alpin": "skiing",
	Raquettes: "snowshoeing",
};

export function mapActivityType(stravaType: string): string {
	return ACTIVITY_TYPE_MAP[stravaType] ?? stravaType;
}

export interface StravaActivityRow {
	id: string;
	name: string;
	type: string;
	description: string;
	gpxFilename: string;
}

// Strava's export CSV can contain quoted fields with embedded commas/newlines, so a plain
// line-split isn't enough — walk the content char by char and track quote state.
function parseCsv(content: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let inQuotes = false;

	for (let i = 0; i < content.length; i++) {
		const char = content[i];

		if (inQuotes) {
			if (char === '"') {
				if (content[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
		} else if (char === ",") {
			row.push(field);
			field = "";
		} else if (char === "\n" || char === "\r") {
			if (char === "\r" && content[i + 1] === "\n") i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else {
			field += char;
		}
	}

	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows.filter((r) => r.length > 1 || r[0] !== "");
}

export function parseStravaActivities(csvContent: string): StravaActivityRow[] {
	const [header, ...rows] = parseCsv(csvContent);
	if (!header) return [];

	const idIdx = header.indexOf("ID de l'activité");
	const nameIdx = header.indexOf("Nom de l'activité");
	const typeIdx = header.indexOf("Type d'activité");
	const descriptionIdx = header.indexOf("Description de l'activité");
	const filenameIdx = header.indexOf("Nom du fichier");

	return rows.map((row) => ({
		id: row[idIdx] ?? "",
		name: row[nameIdx] ?? "",
		type: row[typeIdx] ?? "",
		description: row[descriptionIdx] ?? "",
		gpxFilename: row[filenameIdx] ?? "",
	}));
}
