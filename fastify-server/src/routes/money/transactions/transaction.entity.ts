import type { moneyTag } from "../../../db/schema";

export interface TransactionBody {
	id: number;
	name: string;
	date: string | null;
	time: string;
	considerationDate: string;
	description: string;
	amount: number;
	children: Array<TransactionBody>;
	parentId?: number | null;
	categoryId: number;
	paymentTypeId: number;
	recurrent: boolean;
	informative: boolean;
	tags: Array<typeof moneyTag.$inferSelect>;
}

export function normalizeTransactionRefs<T extends { categoryId: number; paymentTypeId: number }>(data: T) {
	return {
		...data,
		categoryId: data.categoryId !== 0 ? data.categoryId : null,
		paymentTypeId: data.paymentTypeId !== 0 ? data.paymentTypeId : null,
	};
}

function compareByDateThenTime(
	t1: { date: string | null; time?: string | null },
	t2: { date: string | null; time?: string | null },
) {
	const t1date = t1.date ?? "";
	const t2date = t2.date ?? "";
	if (t1date < t2date) {
		return -1;
	} else if (t1date > t2date) {
		return 1;
	}
	const t1time = t1.time ?? "00:00";
	const t2time = t2.time ?? "00:00";
	if (t1time < t2time) {
		return -1;
	} else if (t1time > t2time) {
		return 1;
	}
	return 0;
}

type Sortable = { date: string | null; time?: string | null };

export function mergeAndSortTransactions<D extends Sortable, S extends Sortable>(direct: D[], sub: S[]): Array<D | S> {
	const all = [...direct, ...sub];
	all.sort(compareByDateThenTime);
	return all;
}
