import * as z from "zod";

import { NumberIdParamsSchema } from "./common.schema";

//
// DELETE
//
// Request
export const IdParamsRequestSchema = NumberIdParamsSchema;

//
// ACCOUNT
//
export const AccountSchema = z.object({
	id: z.coerce.number(),
	name: z.string(),
	icon: z.string(),
	textColor: z.string(),
	backgroundColor: z.string(),
	bankId: z.coerce.number(),
});
export type Account = z.infer<typeof AccountSchema>;

// Request
export const AccountParamsRequestSchema = NumberIdParamsSchema;
export const CreateAccountBodyRequestSchema = AccountSchema.omit({ id: true });
export const UpdateAccountBodyRequestSchema = AccountSchema.omit({ id: true }).partial();
export type CreateAccountBody = z.infer<typeof CreateAccountBodyRequestSchema>;
export type UpdateAccountBody = z.infer<typeof UpdateAccountBodyRequestSchema>;

//
// PAYMENT TYPE
//
export const PaymentTypeSchema = z.object({
	id: z.coerce.number(),
	name: z.string(),
	icon: z.string(),
	textColor: z.string(),
	backgroundColor: z.string(),
	accountId: z.coerce.number(),
});
export type PaymentType = z.infer<typeof PaymentTypeSchema>;

// Request
export const PaymentTypeParamsRequestSchema = NumberIdParamsSchema;
export const CreatePaymentTypeBodyRequestSchema = PaymentTypeSchema.omit({ id: true });
export const UpdatePaymentTypeBodyRequestSchema = PaymentTypeSchema.omit({ id: true }).partial();
export type CreatePaymentTypeBody = z.infer<typeof CreatePaymentTypeBodyRequestSchema>;
export type UpdatePaymentTypeBody = z.infer<typeof UpdatePaymentTypeBodyRequestSchema>;

//
// BANK
//
export const BankSchema = z.object({
	id: z.coerce.number(),
	name: z.string(),
});
export type Bank = z.infer<typeof BankSchema>;

// Request
export const BankParamsRequestSchema = NumberIdParamsSchema;
export const CreateBankBodyRequestSchema = BankSchema.omit({ id: true });
export const UpdateBankBodyRequestSchema = BankSchema.omit({ id: true }).partial();
export type CreateBankBody = z.infer<typeof CreateBankBodyRequestSchema>;
export type UpdateBankBody = z.infer<typeof UpdateBankBodyRequestSchema>;

//
// CATEGORY
//
export const CategorySchema = z.object({
	id: z.coerce.number(),
	name: z.string(),
	icon: z.string(),
	textColor: z.string(),
	backgroundColor: z.string(),
	parentId: z.coerce.number().nullable(),
});
export type Category = z.infer<typeof CategorySchema>;

// Request
export const CategoryParamsRequestSchema = NumberIdParamsSchema;
export const CreateCategoryBodyRequestSchema = CategorySchema.omit({ id: true });
export const UpdateCategoryBodyRequestSchema = CategorySchema.omit({ id: true }).partial();
export type CreateCategoryBody = z.infer<typeof CreateCategoryBodyRequestSchema>;
export type UpdateCategoryBody = z.infer<typeof UpdateCategoryBodyRequestSchema>;

//
// TAG
//
export const TagSchema = z.object({
	id: z.coerce.number(),
	name: z.string(),
	icon: z.string(),
	textColor: z.string(),
	backgroundColor: z.string(),
	parentId: z.coerce.number().nullable(),
});
export type Tag = z.infer<typeof TagSchema>;

// Request
export const TagParamsRequestSchema = NumberIdParamsSchema;
export const CreateTagBodyRequestSchema = TagSchema.omit({ id: true });
export const UpdateTagBodyRequestSchema = TagSchema.omit({ id: true }).partial();
export type CreateTagBody = z.infer<typeof CreateTagBodyRequestSchema>;
export type UpdateTagBody = z.infer<typeof UpdateTagBodyRequestSchema>;

// TAG: ANALYTICS
// Request
export const GetAnalyticsQuerystringRequestSchema = z.object({
	splitParent: z.preprocess((val) => {
		if (val === "true") return true;
		else return false;
	}, z.boolean().default(false)),
});

//
// TRANSACTION
//
export const TransactionRowSchema = z.object({
	id: z.number(),
	// nullable columns: a sub-transaction often leaves them empty
	name: z.string().nullable(),
	description: z.string().nullable(),
	// children take their parent's date
	date: z.iso.date(),
	time: z.iso.time().nullable(),
	considerationDate: z.iso.date().nullable(),
	amount: z.number().nullable(),
	comment: z.string().nullable(),
	parentId: z.number().nullable(),
	recurrent: z.boolean().nullable(),
	informative: z.boolean().nullable(),
	categoryId: z.number().nullable(),
	paymentTypeId: z.number().nullable(),
});
export type TransactionRow = z.infer<typeof TransactionRowSchema>;

// each list loads its own relations (tags and children: an empty list when not loaded)
const TransactionRelationsSchema = TransactionRowSchema.extend({
	category: CategorySchema.nullable().optional(),
	paymentType: PaymentTypeSchema.nullable().optional(),
	tags: z.array(TagSchema).default([]),
});
export const TransactionSchema = TransactionRelationsSchema.extend({
	children: z.array(TransactionRelationsSchema).default([]),
	// a sub-transaction listed on its own (by account, category or tag)
	parent: TransactionRowSchema.nullable().optional(),
});
export type Transaction = z.infer<typeof TransactionSchema>;
// a child as its parent lists it (no children nor parent of its own)
export type TransactionChild = Transaction["children"][number];

// Request
export const TransactionParamsRequestSchema = NumberIdParamsSchema;
export const TransactionAccountParamsRequestSchema = z.object({ accountId: z.coerce.number() });
export const TransactionCategoryParamsRequestSchema = z.object({ categoryId: z.coerce.number() });
export const TransactionTagParamsRequestSchema = z.object({ tagId: z.coerce.number() });

export const TransactionListQuerystringRequestSchema = z.object({
	from: z.iso.date().optional(),
	to: z.iso.date().optional(),
	searchText: z.string().optional(),
	// the period and the order follow the date, or the consideration date
	dateOrder: z.enum(["date", "considerationDate"]).optional(),
});
export type TransactionListQuerystring = z.infer<typeof TransactionListQuerystringRequestSchema>;

// the form sends 0 for "none", and an empty field as ""; an empty number input arrives as null (NaN in JSON)
const OptionalRefSchema = z
	.number()
	.nullable()
	.transform((id) => id || null);
const emptyAsNull = <T extends z.ZodType>(schema: T) =>
	z
		.literal("")
		.transform(() => null)
		.or(schema.nullable());

const TransactionChildBodySchema = z.object({
	// a child kept on an update
	id: z.number().optional(),
	name: z.string().nullish(),
	description: z.string().nullish(),
	amount: z.number().nullable(),
	comment: z.string().nullish(),
	categoryId: OptionalRefSchema.optional(),
	paymentTypeId: OptionalRefSchema.optional(),
	// only their id is read
	tags: z.array(z.object({ id: z.number() })).optional(),
});
// POST /transactions, PUT /transactions/:id: the transaction with its children and tags (rewritten on an update)
export const TransactionSaveBodyRequestSchema = TransactionChildBodySchema.omit({ id: true }).extend({
	name: z.string(),
	amount: z.number(),
	date: z.iso.date(),
	time: emptyAsNull(z.iso.time()).optional(),
	considerationDate: emptyAsNull(z.iso.date()).optional(),
	recurrent: z.boolean().nullish(),
	informative: z.boolean().nullish(),
	// the children take the parent's date
	children: z.array(TransactionChildBodySchema).optional(),
});
export type TransactionSaveBody = z.infer<typeof TransactionSaveBodyRequestSchema>;
// PATCH /transactions/:id: the fields sent only, its children and tags left as they are
export const TransactionPatchBodyRequestSchema = TransactionSaveBodyRequestSchema.omit({
	children: true,
	tags: true,
}).partial();
export type TransactionPatchBody = z.infer<typeof TransactionPatchBodyRequestSchema>;

//
// ACCOUNT: DETAILS
//
export const AccountHistorySchema = z.object({
	id: z.number(),
	accountId: z.number(),
	date: z.iso.date(),
	amount: z.number(),
});
export type AccountHistory = z.infer<typeof AccountHistorySchema>;
export const AccountDetailsSchema = AccountSchema.extend({
	history: z.array(AccountHistorySchema),
	paymentTypes: z.array(PaymentTypeSchema),
});
export type AccountDetails = z.infer<typeof AccountDetailsSchema>;

//
// PAYMENT TYPE: DETAILS
//
export const PaymentTypeDetailsSchema = PaymentTypeSchema.extend({
	transactions: z.array(TransactionRowSchema),
});
export type PaymentTypeDetails = z.infer<typeof PaymentTypeDetailsSchema>;

//
// BANK: DETAILS, TREE, OVERVIEW
//
export const BankTreeSchema = BankSchema.extend({
	accounts: z.array(AccountSchema.extend({ paymentTypes: z.array(PaymentTypeSchema) })),
});
export type BankTree = z.infer<typeof BankTreeSchema>;
// each account with its latest history only, its amount updated with the transactions since
export const BankOverviewSchema = BankSchema.extend({
	accounts: z.array(
		AccountSchema.extend({
			history: z.array(AccountHistorySchema),
			paymentTypes: z.array(PaymentTypeSchema.extend({ account: AccountSchema.nullable() })),
		}),
	),
});
export type BankOverview = z.infer<typeof BankOverviewSchema>;

//
// CATEGORY: LIST, DETAILS
//
export const CategoryWithChildrenSchema = CategorySchema.extend({ children: z.array(CategorySchema) });
export type CategoryWithChildren = z.infer<typeof CategoryWithChildrenSchema>;
// with the number of transactions using it
export const CategoryDetailsSchema = CategoryWithChildrenSchema.extend({ transactions: z.number() });
export type CategoryDetails = z.infer<typeof CategoryDetailsSchema>;

//
// TAG: LIST, DETAILS
//
export const TagWithChildrenSchema = TagSchema.extend({ children: z.array(TagSchema) });
export type TagWithChildren = z.infer<typeof TagWithChildrenSchema>;
// with the number of transactions using it
export const TagDetailsSchema = TagWithChildrenSchema.extend({ transactions: z.number() });
export type TagDetails = z.infer<typeof TagDetailsSchema>;

// TAG: ANALYTICS
// Response: one analytic per parent tag (the part of a tag name before "\"); comment: the number of transactions
const AnalyticPartSchema = z.object({ name: z.string(), amount: z.number(), comment: z.string() });
export const AnalyticSchema = z.object({
	name: z.string(),
	badges: z.array(
		TagSchema.pick({ icon: true, textColor: true, backgroundColor: true })
			.extend(AnalyticPartSchema.shape)
			.extend({
				parts: z.array(AnalyticPartSchema),
			}),
	),
});
export type Analytic = z.infer<typeof AnalyticSchema>;

//
// RECAP
//
// Request
export const RecapQuerystringRequestSchema = z.object({
	from: z.iso.date(),
	to: z.iso.date(),
	// the sub-categories counted in their parent
	regroupCategory: z.preprocess((val) => val === "true", z.boolean()),
});
export type RecapQuerystring = z.infer<typeof RecapQuerystringRequestSchema>;
// Response
const DebitCreditSchema = z.object({ debit: z.number(), credit: z.number(), total: z.number().optional() });
export const RecapResponseSchema = z.object({
	nbMonths: z.number(),
	// by category, largest first: each month (YYYY-MM), "total" and "moyenne" (the average, in total)
	data: z.array(z.object({ id: z.number(), name: z.string(), months: z.record(z.string(), DebitCreditSchema) })),
	// by month
	total: z.record(z.string(), z.number()),
	months: z.array(z.string()),
	allMonths: z.array(z.string()),
});
export type RecapResponse = z.infer<typeof RecapResponseSchema>;
