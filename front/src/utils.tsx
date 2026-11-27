const LOCAL_DATETIME = "fr-FR";

// withDays: false keeps the whole time in hours (49h instead of 2j 1h)
export const getDurationString = (duration: number, { withDays = true }: { withDays?: boolean } = {}) => {
	let result = "";
	const days = withDays ? Math.floor(duration / (60 * 24)) : 0;
	if (days > 0) {
		result += `${days}j `;
	}
	const hours = Math.floor((duration - days * 60 * 24) / 60);
	if (hours > 0) {
		result += `${hours}h `;
	}
	const minutes = duration % 60;
	if (minutes > 0) {
		const value = result ? String(minutes).padStart(2, "0") : String(minutes);
		result += `${value}min `;
	}
	return result.trim();
};

export const formatMonth = (date: string | null) => {
	if (!date) {
		return "";
	}

	return Temporal.PlainDate.from(date).toLocaleString(LOCAL_DATETIME, {
		month: "long",
		year: "numeric",
	});
};
export const formatDay = (date: string | null) => {
	if (!date) {
		return "";
	}
	return Temporal.PlainDate.from(date).toLocaleString(LOCAL_DATETIME, {
		weekday: "short",
	});
};

export const formatFullDay = (date: string | null) => {
	if (!date) {
		return "";
	}
	return Temporal.PlainDate.from(date).toLocaleString(LOCAL_DATETIME, {
		weekday: "long",
		day: "numeric",
	});
};
export const formatDate = (date: string | null | undefined) => {
	if (!date) {
		return "";
	}
	return Temporal.PlainDate.from(date).toLocaleString(LOCAL_DATETIME, {
		day: "2-digit",
		month: "2-digit",
		year: "2-digit",
	});
};
export const formatFullDate = (date: string | null) => {
	if (!date) {
		return "";
	}
	try {
		return Temporal.PlainDate.from(date).toLocaleString(LOCAL_DATETIME, {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});
	} catch (e) {
		console.error("Error when trying to format the date", date, e);
		return "";
	}
};

export const formatLocalizedDate = (date: string | null) => {
	if (!date) {
		return "";
	}
	return Temporal.PlainDate.from(date).toLocaleString(LOCAL_DATETIME, {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	});
};

export const formatDateTime = (
	date: string | null | undefined,
	{ withWeekday = false }: { withWeekday?: boolean } = { withWeekday: false },
) => {
	if (!date) {
		return "";
	}
	return Temporal.PlainDateTime.from(date).toLocaleString(LOCAL_DATETIME, {
		...(withWeekday ? { weekday: "long" } : {}),
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "numeric",
		minute: "numeric",
		second: "numeric",
	});
};

export function getPeriodDifference(dateString: string, locale = "fr-FR") {
	if (!dateString) {
		return "";
	}
	const pastDate = Temporal.PlainDateTime.from(dateString);
	const now = Temporal.Now.plainDateTimeISO();

	const diff = now.until(pastDate, { largestUnit: "days" });
	if (diff.days === 0) {
		return locale === "fr-FR" ? "Aujourd'hui" : "Today";
	}

	if (Math.abs(diff.days) > 365) {
		const diffWithYears = now.until(pastDate, { largestUnit: "years" });
		return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(diffWithYears.years, "year");
	}

	return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(diff.days, "day");
}

export function getCurrentOrPreviousDate() {
	const now = Temporal.Now.plainDateTimeISO();

	// If before 4 AM, subtract one day
	const targetDate = now.hour < 4 ? now.toPlainDate().subtract({ days: 1 }) : now.toPlainDate();

	return targetDate.toString();
}

const LANGUAGE_NAMES = new Intl.DisplayNames(["fr"], { type: "language" });
// The French name of an ISO 639-1 code ("ja" → "japonais"), the code itself when unknown
export function languageName(code: string) {
	try {
		return LANGUAGE_NAMES.of(code) ?? code;
	} catch {
		return code;
	}
}

const COUNTRY_NAMES = new Intl.DisplayNames(["fr"], { type: "region" });
// The French name of an ISO 3166-1 alpha-2 code ("gb" → "Royaume-Uni"), the code itself when unknown
export function countryName(code: string) {
	try {
		// Uppercase for V8, it wasn't needed for SpiderMonkey
		return COUNTRY_NAMES.of(code.toUpperCase()) ?? code;
	} catch {
		return code;
	}
}
