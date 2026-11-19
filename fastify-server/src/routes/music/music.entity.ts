export function cleanListening(listening: any) {
	if (!listening.contextTags || listening.contextTags.length === 0) {
		delete listening.contextTags;
	}
	return listening;
}

export interface StatsDuration {
	key: string;
	name: string;
	duration: number;
	details: Record<string, any>;
}

export function getDaysBetween(from: string, to: string) {
	const fromDate = Temporal.PlainDate.from(from);
	const toDate = Temporal.PlainDate.from(to);

	return Math.abs(fromDate.until(toDate).days + 1);
}

interface HasDuration {
	duration: number;
}
interface HasKey {
	key: string;
}
export function sortByDuration(a: HasDuration, b: HasDuration) {
	return b.duration - a.duration;
}
export function sortByKey(a: HasKey, b: HasKey) {
	return a.key.localeCompare(b.key);
}

export function getDaysForAverageCount(from: string, to: string): number {
	const fromDate = Temporal.PlainDate.from(from);
	const toDate = Temporal.PlainDate.from(to);
	const today = Temporal.Now.plainDateISO();

	const isTodayBetween =
		Temporal.PlainDate.compare(today, fromDate) >= 0 && Temporal.PlainDate.compare(today, toDate) <= 0;

	if (isTodayBetween) {
		return fromDate.until(today).days + 1;
	} else {
		return fromDate.until(toDate).days + 1;
	}
}
