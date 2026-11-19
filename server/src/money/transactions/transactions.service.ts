import { Injectable, Logger } from "@nestjs/common";

import { NotFoundError } from "../../common/errors.js";
import { mergeAndSortTransactions, normalizeTransactionRefs, type TransactionBody } from "./transaction.entity.js";
import { TransactionsRepository } from "./transactions.repository.js";

export interface ListTransactionsQuery {
	from?: string;
	to?: string;
	searchText?: string;
	dateOrder?: string;
}

const tagLinks = (transactionId: number, tags: TransactionBody["tags"] | undefined) =>
	(tags ?? []).map((tag) => ({ transactionId, tagId: tag.id }));

@Injectable()
export class TransactionsService {
	private readonly logger = new Logger(TransactionsService.name);
	constructor(private readonly repo: TransactionsRepository) {}

	list({ from, to, searchText, dateOrder }: ListTransactionsQuery) {
		this.logger.log("list");
		const dateField = dateOrder === "considerationDate" ? "considerationDate" : "date";
		return this.repo.findAll({ searchText, from, to, dateField });
	}

	async get(id: number) {
		this.logger.log("get");
		return (await this.repo.findById(id)) ?? notFound();
	}

	async create(body: TransactionBody) {
		this.logger.log("create");
		const transaction = await this.repo.create(normalizeTransactionRefs(body));

		for (const child of body.children ?? []) {
			const createdChild = await this.repo.create({
				...normalizeTransactionRefs(child),
				date: transaction.date,
				parentId: transaction.id,
			});
			if (child.tags?.length) {
				await this.repo.createTags(tagLinks(createdChild.id, child.tags));
			}
		}
		if (body.tags?.length) {
			await this.repo.createTags(tagLinks(transaction.id, body.tags));
		}
		return transaction;
	}

	// "quick" only updates the parent's own fields; any other type rewrites tags and children
	async update(id: number, type: string, body: TransactionBody) {
		this.logger.log(`update ${id} (${type})`);
		const transaction = (await this.repo.findByIdWithChildren(id)) ?? notFound();

		if (type === "quick") {
			await this.repo.update(id, normalizeTransactionRefs(body));
			return this.repo.findByIdWithChildren(id);
		}

		const transactionIds = [id, ...transaction.children.map((c) => c.id)];
		// Children inherit the parent's date
		const incomingChildren = (body.children ?? []).map((c) =>
			normalizeTransactionRefs({ ...c, date: transaction.date, parentId: id }),
		);
		const incomingById = new Map(incomingChildren.filter((c) => c.id).map((c) => [c.id, c]));

		// a failure rolls back and reaches the client as a 500
		await this.repo.runInTransaction(async (tx) => {
			await this.repo.deleteTags(transactionIds, tx);

			await this.repo.update(id, normalizeTransactionRefs(body), tx);
			if (body.tags?.length) {
				await this.repo.createTags(tagLinks(id, body.tags), tx);
			}

			for (const existing of transaction.children) {
				const child = incomingById.get(existing.id);
				if (child) {
					// update the children kept
					await this.repo.update(existing.id, child, tx);
					if (child.tags?.length) {
						await this.repo.createTags(tagLinks(existing.id, child.tags), tx);
					}
				} else {
					// delete the children removed
					await this.repo.destroy(existing.id, tx);
				}
			}

			// create the new children
			for (const child of incomingChildren.filter((c) => !c.id)) {
				const createdChild = await this.repo.create(child, tx);
				if (child.tags?.length) {
					await this.repo.createTags(tagLinks(createdChild.id, child.tags), tx);
				}
			}
		});

		return this.repo.findByIdWithChildren(id);
	}

	async delete(id: number) {
		this.logger.log(`delete ${id}`);
		const transaction = (await this.repo.findByIdWithChildren(id)) ?? notFound();
		const transactionIds = [id, ...transaction.children.map((c) => c.id)];

		// No cascade on `parent`: children must be deleted explicitly
		await this.repo.runInTransaction(async (tx) => {
			await this.repo.deleteTags(transactionIds, tx);
			for (const child of transaction.children) {
				await this.repo.destroy(child.id, tx);
			}
			await this.repo.destroy(id, tx);
		});
	}

	async listByAccount(accountId: number) {
		this.logger.log(`listByAccount ${accountId}`);
		const [direct, sub] = await Promise.all([
			this.repo.findDirectTransactionsByAccount(accountId),
			this.repo.findSubTransactionsByAccount(accountId),
		]);
		return mergeAndSortTransactions(direct, sub);
	}

	async listByCategory(categoryId: number) {
		this.logger.log(`listByCategory ${categoryId}`);
		const subCategories = await this.repo.findSubCategories(categoryId);
		const categoryIds = [categoryId, ...subCategories.map((c) => c.id)];
		const [direct, sub] = await Promise.all([
			this.repo.findDirectTransactionsByCategory(categoryIds),
			this.repo.findSubTransactionsByCategory(categoryIds),
		]);
		return mergeAndSortTransactions(direct, sub);
	}

	async listByTag(tagId: number) {
		this.logger.log(`listByTag ${tagId}`);
		const [direct, sub] = await Promise.all([
			this.repo.findDirectTransactionsByTag(tagId),
			this.repo.findSubTransactionsByTag(tagId),
		]);
		return mergeAndSortTransactions(direct, sub);
	}
}

function notFound(): never {
	throw new NotFoundError("Transaction introuvable");
}
