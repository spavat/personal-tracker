import type { moneyTag } from "../../database/schema.js";

// The front's transaction payload (no shared zod schema: the body is not validated, as in the Fastify server)
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

// The front sends 0 for "no category" / "no payment type"
export function normalizeTransactionRefs<T extends { categoryId: number; paymentTypeId: number }>(data: T) {
	return {
		...data,
		categoryId: data.categoryId !== 0 ? data.categoryId : null,
		paymentTypeId: data.paymentTypeId !== 0 ? data.paymentTypeId : null,
	};
}

type Sortable = { date: string | null; time?: string | null };

function compareByDateThenTime(t1: Sortable, t2: Sortable) {
	const t1date = t1.date ?? "";
	const t2date = t2.date ?? "";
	if (t1date !== t2date) {
		return t1date < t2date ? -1 : 1;
	}
	const t1time = t1.time ?? "00:00";
	const t2time = t2.time ?? "00:00";
	if (t1time !== t2time) {
		return t1time < t2time ? -1 : 1;
	}
	return 0;
}

export function mergeAndSortTransactions<D extends Sortable, S extends Sortable>(direct: D[], sub: S[]): Array<D | S> {
	return [...direct, ...sub].toSorted(compareByDateThenTime);
}
