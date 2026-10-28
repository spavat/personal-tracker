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
