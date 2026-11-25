import { defineRelations } from "drizzle-orm";

import * as schema from "./schema.js";

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
	// the show credits of an entity (the artist pages)
	coreEntity: {
		showRoles: r.many.showRole({
			from: r.coreEntity.id,
			to: r.showRole.entityId,
		}),
		showModelRoles: r.many.showModelRole({
			from: r.coreEntity.id,
			to: r.showModelRole.entityId,
		}),
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
		entity: r.one.coreEntity({
			from: r.showModelRole.entityId,
			to: r.coreEntity.id,
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
		mediaLinks: r.many.showSpectacleMedia(),
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
		poster: r.one.showMedia({
			from: r.showPerformance.posterId,
			to: r.showMedia.id,
		}),
	},
	showRole: {
		performance: r.one.showPerformance({
			from: r.showRole.performanceId,
			to: r.showPerformance.id,
		}),
		entity: r.one.coreEntity({
			from: r.showRole.entityId,
			to: r.coreEntity.id,
		}),
	},
	showWork: {
		spectacle: r.many.showSpectacle(),
	},
	showSpectacleMedia: {
		spectacle: r.one.showSpectacle({
			from: r.showSpectacleMedia.spectacleId,
			to: r.showSpectacle.id,
		}),
		media: r.one.showMedia({
			from: r.showSpectacleMedia.mediaId,
			to: r.showMedia.id,
		}),
	},
	readingBook: {
		contributors: r.many.readingBookContributor({
			from: r.readingBook.id,
			to: r.readingBookContributor.bookId,
		}),
		editions: r.many.readingEdition({
			from: r.readingBook.id,
			to: r.readingEdition.bookId,
		}),
		models: r.many.readingModel({
			from: r.readingBook.id,
			to: r.readingModel.bookId,
		}),
		externalIds: r.many.coreExternalId({
			from: r.readingBook.id,
			to: r.coreExternalId.nodeId,
		}),
		// the series the book is directly in
		series: r.many.readingSeriesItem({
			from: r.readingBook.id,
			to: r.readingSeriesItem.bookId,
		}),
	},
	readingBookContributor: {
		book: r.one.readingBook({
			from: r.readingBookContributor.bookId,
			to: r.readingBook.id,
		}),
		entity: r.one.coreEntity({
			from: r.readingBookContributor.entityId,
			to: r.coreEntity.id,
		}),
	},
	readingEdition: {
		book: r.one.readingBook({
			from: r.readingEdition.bookId,
			to: r.readingBook.id,
		}),
		contributors: r.many.readingEditionContributor({
			from: r.readingEdition.id,
			to: r.readingEditionContributor.editionId,
		}),
		publisher: r.one.coreEntity({
			from: r.readingEdition.publisherId,
			to: r.coreEntity.id,
		}),
		model: r.one.readingModel({
			from: r.readingEdition.modelId,
			to: r.readingModel.id,
		}),
		readings: r.many.readingReading({
			from: r.readingEdition.id,
			to: r.readingReading.editionId,
		}),
		externalIds: r.many.coreExternalId({
			from: r.readingEdition.id,
			to: r.coreExternalId.nodeId,
		}),
	},
	readingEditionContributor: {
		edition: r.one.readingEdition({
			from: r.readingEditionContributor.editionId,
			to: r.readingEdition.id,
		}),
		entity: r.one.coreEntity({
			from: r.readingEditionContributor.entityId,
			to: r.coreEntity.id,
		}),
	},
	readingReading: {
		edition: r.one.readingEdition({
			from: r.readingReading.editionId,
			to: r.readingEdition.id,
		}),
		entries: r.many.readingEntry({
			from: r.readingReading.id,
			to: r.readingEntry.readingId,
		}),
	},
	readingSeries: {
		items: r.many.readingSeriesItem({
			from: r.readingSeries.id,
			to: r.readingSeriesItem.seriesId,
		}),
		// the items where it is a sub-series: its parents
		parentItems: r.many.readingSeriesItem({
			from: r.readingSeries.id,
			to: r.readingSeriesItem.childSeriesId,
		}),
	},
	readingSeriesItem: {
		series: r.one.readingSeries({
			from: r.readingSeriesItem.seriesId,
			to: r.readingSeries.id,
		}),
		book: r.one.readingBook({
			from: r.readingSeriesItem.bookId,
			to: r.readingBook.id,
		}),
		childSeries: r.one.readingSeries({
			from: r.readingSeriesItem.childSeriesId,
			to: r.readingSeries.id,
		}),
	},
	broadcastProgram: {
		contributors: r.many.broadcastProgramContributor({
			from: r.broadcastProgram.id,
			to: r.broadcastProgramContributor.programId,
		}),
		seasons: r.many.broadcastSeason({
			from: r.broadcastProgram.id,
			to: r.broadcastSeason.programId,
		}),
		formats: r.many.broadcastFormat({
			from: r.broadcastProgram.id,
			to: r.broadcastFormat.programId,
		}),
		episodes: r.many.broadcastEpisode({
			from: r.broadcastProgram.id,
			to: r.broadcastEpisode.programId,
		}),
	},
	broadcastProgramContributor: {
		program: r.one.broadcastProgram({
			from: r.broadcastProgramContributor.programId,
			to: r.broadcastProgram.id,
		}),
		entity: r.one.coreEntity({
			from: r.broadcastProgramContributor.entityId,
			to: r.coreEntity.id,
		}),
	},
	broadcastEpisode: {
		program: r.one.broadcastProgram({
			from: r.broadcastEpisode.programId,
			to: r.broadcastProgram.id,
		}),
		season: r.one.broadcastSeason({
			from: r.broadcastEpisode.seasonId,
			to: r.broadcastSeason.id,
		}),
		format: r.one.broadcastFormat({
			from: r.broadcastEpisode.formatId,
			to: r.broadcastFormat.id,
		}),
		contributors: r.many.broadcastEpisodeContributor({
			from: r.broadcastEpisode.id,
			to: r.broadcastEpisodeContributor.episodeId,
		}),
		views: r.many.broadcastView({
			from: r.broadcastEpisode.id,
			to: r.broadcastView.episodeId,
		}),
	},
	broadcastEpisodeContributor: {
		episode: r.one.broadcastEpisode({
			from: r.broadcastEpisodeContributor.episodeId,
			to: r.broadcastEpisode.id,
		}),
		entity: r.one.coreEntity({
			from: r.broadcastEpisodeContributor.entityId,
			to: r.coreEntity.id,
		}),
	},
	broadcastView: {
		episode: r.one.broadcastEpisode({
			from: r.broadcastView.episodeId,
			to: r.broadcastEpisode.id,
		}),
	},
}));
