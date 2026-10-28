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
