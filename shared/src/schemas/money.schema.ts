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
	// links the account to a bank account seen through Enable Banking (spaces removed, upper case)
	iban: z
		.string()
		.transform((v) => v.replace(/\s+/g, "").toUpperCase())
		.pipe(z.union([z.literal(""), z.string().regex(/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/, "IBAN invalide")]))
		.transform((v) => v || null)
		.nullish(),
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

//
// BANKING (Enable Banking sync)
//
// Request
export const AspspsQuerystringRequestSchema = z.object({
	country: z.string().length(2).toUpperCase(),
});
export const StartBankConnectionBodyRequestSchema = z.object({
	aspspName: z.string().min(1),
	aspspCountry: z.string().length(2).toUpperCase(),
});
export const CompleteBankConnectionBodyRequestSchema = z.object({
	code: z.string().min(1),
	state: z.string().min(1),
});
export const UpdateBankConnectionAccountBodyRequestSchema = z
	.object({
		accountId: z.coerce.number().nullable(),
		syncFrom: z.iso.date(),
		enabled: z.boolean(),
	})
	.partial();
export type UpdateBankConnectionAccountBody = z.infer<typeof UpdateBankConnectionAccountBodyRequestSchema>;

const TransactionTagRefSchema = z.looseObject({ id: z.coerce.number() });
const AcceptChildSchema = z.looseObject({
	name: z.string(),
	amount: z.coerce.number(),
	categoryId: z.coerce.number().default(0),
	paymentTypeId: z.coerce.number(),
	comment: z.string().nullish(),
	tags: z.array(TransactionTagRefSchema).default([]),
});
// same fields as the transaction form, the amount comes from the bank line
export const AcceptBankTransactionBodyRequestSchema = z.object({
	name: z.string().min(1),
	description: z.string().nullish(),
	date: z.iso.date(),
	time: z.string().nullish(),
	considerationDate: z.iso.date(),
	recurrent: z.boolean().default(false),
	informative: z.boolean().default(false),
	comment: z.string().nullish(),
	categoryId: z.coerce.number().default(0),
	paymentTypeId: z.coerce.number().default(0),
	tags: z.array(TransactionTagRefSchema).default([]),
	children: z.array(AcceptChildSchema).default([]),
});
export type AcceptBankTransactionBody = z.infer<typeof AcceptBankTransactionBodyRequestSchema>;
export const MatchBankTransactionBodyRequestSchema = z.object({
	transactionId: z.coerce.number(),
});

// TAG: ANALYTICS
// Request
export const GetAnalyticsQuerystringRequestSchema = z.object({
	splitParent: z.preprocess((val) => {
		if (val === "true") return true;
		else return false;
	}, z.boolean().default(false)),
});
