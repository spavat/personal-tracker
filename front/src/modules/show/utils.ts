import { API_BASE_URL } from "../../config";

// media urls are server paths (/images/show/:id)
export function mediaSrc(url: string) {
	return `${API_BASE_URL}${url}`;
}

// data URI of a picked file, sent as the media source
export function readFile(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => resolve(e.target?.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

export function formatShowDate(isoDate: string, showHour = true) {
	const config = {
		year: "2-digit",
		month: "numeric",
		day: "numeric",
		...(showHour ? ({ hour: "numeric" } as const) : {}),
		...(showHour ? ({ minute: "numeric" } as const) : {}),
	} as const;
	return Temporal.PlainDateTime.from(isoDate.replace("Z", "")).toLocaleString("fr-FR", config);
}

// show dates are local (no time zone): compared with the local wall-clock time
export function isFutureShow(isoDate: string) {
	return Temporal.PlainDateTime.compare(isoDate, Temporal.Now.plainDateTimeISO()) > 0;
}

// ribbon class for a .poster-frame (see module.css)
export function posterRibbon({ canceled, date }: { canceled: boolean; date: string }) {
	if (canceled) return "ribbon-canceled";
	return isFutureShow(date) ? "ribbon-upcoming" : "";
}
