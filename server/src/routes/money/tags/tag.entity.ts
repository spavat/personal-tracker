import type { moneyTag } from "../../../db/schema";

type Tag = typeof moneyTag.$inferSelect;

interface AnalyticPart {
	name: string;
	amount: number;
	comment: string;
}
export interface WIPAnalyticPart extends Omit<AnalyticPart, "comment"> {
	nbTransactions: number;
}
export interface AnalyticBadge extends Pick<Tag, "icon" | "textColor" | "backgroundColor"> {
	name: string;
	amount: number;
	comment: string;
	parts: Array<AnalyticPart>;
}

export interface Analytic {
	name: string;
	badges: Array<AnalyticBadge>;
}

export function sortByNames(a: { name: string }, b: { name: string }) {
	return a.name.localeCompare(b.name);
}
