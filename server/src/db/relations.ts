import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
	moneyBank: {
		accounts: r.many.moneyAccount({
			from: r.moneyBank.id,
			to: r.moneyAccount.bankId,
		}),
	},
	moneyAccount: {
		history: r.many.moneyAccountHistory({
			from: r.moneyAccount.id,
			to: r.moneyAccountHistory.accountId,
		}),
		paymentTypes: r.many.moneyPaymentType({
			from: r.moneyAccount.id,
			to: r.moneyPaymentType.accountId,
		}),
	},
	moneyPaymentType: {
		account: r.one.moneyAccount({
			from: r.moneyPaymentType.accountId,
			to: r.moneyAccount.id,
		}),
		transactions: r.many.moneyTransaction({
			from: r.moneyPaymentType.id,
			to: r.moneyTransaction.paymentTypeId,
		}),
	},
	moneyCategory: {
		children: r.many.moneyCategory({
			from: r.moneyCategory.id,
			to: r.moneyCategory.parentId,
			alias: "category_parent",
		}),
		transactions: r.many.moneyTransaction({
			from: r.moneyCategory.id,
			to: r.moneyTransaction.categoryId,
		}),
	},
	moneyTag: {
		children: r.many.moneyTag({
			from: r.moneyTag.id,
			to: r.moneyTag.parentId,
			alias: "tag_parent",
		}),
		transactions: r.many.moneyTransaction({
			from: r.moneyTag.id.through(r.moneyTransactionTag.tagId),
			to: r.moneyTransaction.id.through(r.moneyTransactionTag.transactionId),
		}),
	},
	moneyTransaction: {
		category: r.one.moneyCategory({
			from: r.moneyTransaction.categoryId,
			to: r.moneyCategory.id,
		}),
		paymentType: r.one.moneyPaymentType({
			from: r.moneyTransaction.paymentTypeId,
			to: r.moneyPaymentType.id,
		}),
		children: r.many.moneyTransaction({
			from: r.moneyTransaction.id,
			to: r.moneyTransaction.parentId,
			alias: "transaction_parent",
		}),
		parent: r.one.moneyTransaction({
			from: r.moneyTransaction.parentId,
			to: r.moneyTransaction.id,
			alias: "transaction_parent",
		}),
		tags: r.many.moneyTag({
			from: r.moneyTransaction.id.through(r.moneyTransactionTag.transactionId),
			to: r.moneyTag.id.through(r.moneyTransactionTag.tagId),
		}),
	},
	showArtist: {
		role: r.many.showRole(),
	},
	showModel: {
		spectacle: r.one.showSpectacle({
			from: r.showModel.spectacleId,
			to: r.showSpectacle.id,
		}),
		roles: r.many.showModelRole(),
	},
	showModelRole: {
		model: r.one.showModel({
			from: r.showModelRole.modelId,
			to: r.showModel.id,
		}),
		artist: r.one.showArtist({
			from: r.showModelRole.artistId,
			to: r.showArtist.id,
		}),
	},
	showPlace: {
		spectacles: r.many.showSpectacle({
			from: r.showPlace.id.through(r.showPerformance.placeId),
			to: r.showSpectacle.id.through(r.showPerformance.spectacleId),
		}),
		performance: r.many.showPerformance(),
		formerNames: r.many.showPlaceFormerName(),
	},
	showPlaceFormerName: {
		place: r.one.showPlace({
			from: r.showPlaceFormerName.placeId,
			to: r.showPlace.id,
		}),
	},
	showSpectacle: {
		models: r.many.showModel(),
		performance: r.many.showPerformance(),
		places: r.many.showPlace(),
		work: r.one.showWork({
			from: r.showSpectacle.workId,
			to: r.showWork.id,
		}),
	},
	showPerformance: {
		place: r.one.showPlace({
			from: r.showPerformance.placeId,
			to: r.showPlace.id,
		}),
		spectacle: r.one.showSpectacle({
			from: r.showPerformance.spectacleId,
			to: r.showSpectacle.id,
		}),
		role: r.many.showRole(),
	},
	showRole: {
		performance: r.one.showPerformance({
			from: r.showRole.performanceId,
			to: r.showPerformance.id,
		}),
		artist: r.one.showArtist({
			from: r.showRole.artistId,
			to: r.showArtist.id,
		}),
	},
	showWork: {
		spectacle: r.many.showSpectacle(),
	},
}));
