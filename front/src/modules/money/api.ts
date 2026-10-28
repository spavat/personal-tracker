import { queryOptions } from "@tanstack/react-query";

import type { YearQueryConfig } from "../../hooks/use-year-changer";

import { fetchJson, sendJson, withQuery } from "../../api-utils";
import { API_BASE_URL } from "../../config";

async function getBanksOverview() {
	return fetchJson<Array<Money.BankWithHistory>>(`${API_BASE_URL}/money/banks/overview`);
}
async function getBanksTree() {
	return fetchJson<Array<Money.Bank>>(`${API_BASE_URL}/money/banks/tree`);
}

interface CategoryData {
	id: string;
	name: string;
	months: {
		[key: string]: {
			debit: number;
			credit: number;
			total?: number;
		};
	};
}
interface ReponseData {
	nbMonths: number;
	data: Array<CategoryData>;
	total: Record<string, number>;
	months: Array<string>;
	allMonths: Array<string>;
}
async function getAnnualRecap(year: string, regroup: boolean) {
	return fetchJson<ReponseData>(
		withQuery(`${API_BASE_URL}/money/recap`, {
			from: `${year}-01-01`,
			to: `${year}-12-31`,
			regroupCategory: regroup,
		}),
	);
}

async function getAnalytics(splitParent: boolean) {
	return fetchJson<Array<Money.Analytic>>(withQuery(`${API_BASE_URL}/money/tags/analytics`, { splitParent }));
}

//
// TRANSACTIONS
//
async function getTransactions(from: string, to: string, search?: string, useTransactionDate?: boolean) {
	return fetchJson<Array<Money.Transaction>>(
		withQuery(`${API_BASE_URL}/money/transactions`, {
			from,
			to,
			searchText: search,
			dateOrder: useTransactionDate === false ? "considerationDate" : undefined,
		}),
	);
}
async function getAccountTransactions(accountId: string) {
	return fetchJson<Array<Money.Transaction>>(`${API_BASE_URL}/money/transactions/account/${accountId}`);
}
async function getCategoryTransactions(categoryId: string) {
	return fetchJson<Array<Money.Transaction>>(`${API_BASE_URL}/money/transactions/category/${categoryId}`);
}
async function getTagTransactions(tagId: string) {
	return fetchJson<Array<Money.Transaction>>(`${API_BASE_URL}/money/transactions/tag/${tagId}`);
}
async function getTransaction(id: number) {
	return fetchJson<Money.Transaction>(`${API_BASE_URL}/money/transactions/${id}`);
}

export async function saveTransaction({ transactionId, data }: { transactionId?: number; data: any }) {
	const dataToSend = { ...data };
	if (data.withChildren) {
		dataToSend.categoryId = 0;
		dataToSend.paymentTypeId = 0;
		dataToSend.tags = [];
	} else {
		dataToSend.children = [];
	}
	let urlEnd = "";
	if (transactionId) {
		urlEnd = `${transactionId}/full`;
	}
	return sendJson(`${API_BASE_URL}/money/transactions/${urlEnd}`, "POST", dataToSend);
}

export async function quickSaveTransaction(data: any) {
	return sendJson(`${API_BASE_URL}/money/transactions/${data.id}/quick`, "POST", data);
}

export async function deleteTransaction(transactionId: number) {
	return fetchJson(`${API_BASE_URL}/money/transactions/${transactionId}`, {
		method: "DELETE",
	});
}

//
// BANKS
//
async function getBank(id: number) {
	return fetchJson<Money.Bank>(`${API_BASE_URL}/money/banks/${id}`);
}
async function getBanks() {
	return fetchJson<Array<Money.Bank>>(`${API_BASE_URL}/money/banks/`);
}

export async function updateBank({ bankId, data }: { bankId?: number; data: any }) {
	return sendJson(`${API_BASE_URL}/money/banks/${bankId ?? ""}`, "POST", data);
}

export async function deleteBank(bankId: number) {
	return fetchJson(`${API_BASE_URL}/money/banks/${bankId}`, {
		method: "DELETE",
	});
}

//
// ACCOUNTS
//
async function getAccount(accountId: string) {
	return fetchJson<Array<Money.Account>>(`${API_BASE_URL}/money/accounts/${accountId}`);
}

async function getAccountDetails(accountId: string) {
	return fetchJson<Money.AccountDetails>(`${API_BASE_URL}/money/accounts/${accountId}/details`);
}

export async function updateAccount({ accountId, data }: { accountId?: number; data: any }) {
	return sendJson(`${API_BASE_URL}/money/accounts/${accountId ?? ""}`, "POST", data);
}

export async function deleteAccount(accountId: number) {
	return fetchJson(`${API_BASE_URL}/money/accounts/${accountId}`, {
		method: "DELETE",
	});
}

//
// PAYMENT TYPES
//

async function getPaymentTypes() {
	return fetchJson<Array<Money.PaymentType>>(`${API_BASE_URL}/money/paymentTypes`);
}
async function getPaymentType(paymentTypeId: number) {
	return fetchJson<Money.PaymentType>(`${API_BASE_URL}/money/paymentTypes/${paymentTypeId}`);
}
async function getPaymentTypeDetails(paymentTypeId: number) {
	return fetchJson<Money.PaymentTypeWithDetails>(`${API_BASE_URL}/money/paymentTypes/${paymentTypeId}/details`);
}
export async function updatePaymentType({ paymentTypeId, data }: { paymentTypeId?: number; data: any }) {
	return sendJson(`${API_BASE_URL}/money/paymentTypes/${paymentTypeId ?? ""}`, "POST", data);
}
export async function deletePaymentType(paymentTypeId: number) {
	return fetchJson(`${API_BASE_URL}/money/paymentTypes/${paymentTypeId}`, {
		method: "DELETE",
	});
}

//
// CATEGORIES
//
async function getCategories() {
	return fetchJson<Array<Money.Category>>(`${API_BASE_URL}/money/categories`);
}
interface CategorieDetails extends Money.Category {
	children: Array<Money.Category>;
	transactions: number;
}
async function getCategory(categoryId: number) {
	return fetchJson<CategorieDetails>(`${API_BASE_URL}/money/categories/${categoryId}`);
}

export async function updateCategory({ categoryId, data }: { categoryId?: number; data: any }) {
	return sendJson(`${API_BASE_URL}/money/categories/${categoryId ?? ""}`, "POST", data);
}

export async function deleteCategory(categoryId: number) {
	return fetchJson(`${API_BASE_URL}/money/categories/${categoryId}`, {
		method: "DELETE",
	});
}

//
// TAGS
//
async function getTags() {
	return fetchJson<Array<Money.Tag>>(`${API_BASE_URL}/money/tags`);
}
interface TagDetails extends Money.Tag {
	children: Array<Money.Tag>;
	transactions: number;
}
async function getTag(tagId: number) {
	return fetchJson<TagDetails>(`${API_BASE_URL}/money/tags/${tagId}`);
}

export async function updateTag({ tagId, data }: { tagId?: number; data: any }) {
	return sendJson(`${API_BASE_URL}/money/tags/${tagId ?? ""}`, "POST", data);
}

export async function deleteTag(tagId: number) {
	return fetchJson(`${API_BASE_URL}/money/tags/${tagId}`, {
		method: "DELETE",
	});
}

//
// QUERIES (shared by the pages and their route loaders)
//
export const banksOverviewQuery = () =>
	queryOptions({
		// own key: ["money", "banks"] alone is used by NewAccountForm for getBanks()
		queryKey: ["money", "banks", "overview"],
		queryFn: getBanksOverview,
	});
export const banksTreeQuery = () =>
	queryOptions({
		queryKey: ["money", "banks", "tree"],
		queryFn: getBanksTree,
	});
export const annualRecap = (regroup: boolean): YearQueryConfig<ReponseData> => ({
	queryKey: ["money", "recap", String(regroup)],
	queryFn: (from: string) => getAnnualRecap(from.substring(0, 4), regroup),
});
// localStorage preferences read by both the pages and their route loaders
export const SPLIT_PARENT_STORAGE = { key: "money_analytics_splitParent", defaultValue: false };
export const USE_TRANSACTION_DATE_STORAGE = { key: "money_transactions_useTransactionDate", defaultValue: true };

export const analyticsQuery = (splitParent: boolean) =>
	queryOptions({
		queryKey: ["money", "analytics", splitParent],
		queryFn: () => getAnalytics(splitParent),
	});
// first and last day of a YYYY-MM period
export function monthRange(period: string) {
	const baseDay = Temporal.PlainDate.from(`${period}-01`);
	return { from: baseDay.toString(), to: baseDay.with({ day: baseDay.daysInMonth }).toString() };
}
export const transactionsQuery = (from: string, to: string, search?: string, useTransactionDate?: boolean) =>
	queryOptions({
		queryKey: ["money", "transactions", from, to, search, useTransactionDate],
		queryFn: () => getTransactions(from, to, search, useTransactionDate),
	});
export const groupTransactionsQuery = (type: "category" | "tag" | "account", id: string) =>
	queryOptions({
		queryKey: ["money", "transactions", type, id],
		queryFn: () => {
			if (type === "category") {
				return getCategoryTransactions(id);
			} else if (type === "account") {
				return getAccountTransactions(id);
			}
			return getTagTransactions(id);
		},
	});
// header data of a transactions group page: the account (with its history, for thresholds), tag or category
export const groupDetailsQuery = (type: "category" | "tag" | "account", id: string) =>
	queryOptions<Money.AccountDetails | CategorieDetails | TagDetails>({
		queryKey:
			type === "account"
				? // "details": ["money", "accounts", id] is used by NewAccountForm for getAccount()
					["money", "accounts", id, "details"]
				: ["money", type === "tag" ? "tags" : "categories", id],
		queryFn: () => {
			if (type === "account") {
				return getAccountDetails(id);
			}
			return type === "tag" ? getTag(parseInt(id, 10)) : getCategory(parseInt(id, 10));
		},
	});
export const transactionQuery = (id: number) =>
	queryOptions({
		// same key as the edit/delete forms: invalidated by ["money", "transactions"] after a save
		queryKey: ["money", "transactions", id],
		queryFn: () => getTransaction(id),
	});
export const categoriesQuery = () =>
	queryOptions({
		queryKey: ["money", "categories"],
		queryFn: getCategories,
	});
export const paymentTypesQuery = () =>
	queryOptions({
		queryKey: ["money", "paymentTypes"],
		queryFn: getPaymentTypes,
	});
export const tagsQuery = () =>
	queryOptions({
		queryKey: ["money", "tags"],
		queryFn: getTags,
	});
export const banksQuery = () =>
	queryOptions({
		queryKey: ["money", "banks"],
		queryFn: getBanks,
	});
export const bankQuery = (id: number) =>
	queryOptions({
		queryKey: ["money", "banks", id],
		queryFn: () => getBank(id),
	});
export const accountQuery = (id: number) =>
	queryOptions({
		queryKey: ["money", "accounts", id],
		queryFn: () => getAccount(String(id)),
	});
// same key as the account branch of groupDetailsQuery
export const accountDetailsQuery = (id: string) =>
	queryOptions({
		queryKey: ["money", "accounts", id, "details"],
		queryFn: () => getAccountDetails(id),
	});
export const paymentTypeQuery = (id: number) =>
	queryOptions({
		queryKey: ["money", "paymentTypes", id],
		queryFn: () => getPaymentType(id),
	});
export const paymentTypeDetailsQuery = (id: number) =>
	queryOptions({
		queryKey: ["money", "paymentTypes", id, "details"],
		queryFn: () => getPaymentTypeDetails(id),
	});
// string id in the key: same cache entry as groupDetailsQuery
export const categoryQuery = (id: number) =>
	queryOptions({
		queryKey: ["money", "categories", String(id)],
		queryFn: () => getCategory(id),
	});
export const tagQuery = (id: number) =>
	queryOptions({
		queryKey: ["money", "tags", String(id)],
		queryFn: () => getTag(id),
	});
