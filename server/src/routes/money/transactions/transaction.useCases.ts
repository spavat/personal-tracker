import type { FastifyBaseLogger } from "fastify";

import type { TransactionRepository } from "./transaction.repository";

import { mergeAndSortTransactions, normalizeTransactionRefs, type TransactionBody } from "./transaction.entity";

interface ParamsWithOptions {
	from: string;
	to: string;
	searchText: string;
	dateOrder: string;
}

export class ListTransactionsUseCase {
	constructor(private repo: TransactionRepository) {}

	execute({ from, to, searchText, dateOrder }: ParamsWithOptions, log: FastifyBaseLogger) {
		log.info("ListTransactionsUseCase.execute");
		console.time("transactions");
		const dateField = dateOrder === "considerationDate" ? "considerationDate" : "date";
		const result = this.repo.findAll({ searchText, from, to, dateField });
		console.timeEnd("transactions");
		return result;
	}
}

export class GetTransactionUseCase {
	constructor(private repo: TransactionRepository) {}

	execute(id: number, log: FastifyBaseLogger) {
		log.info("GetTransactionUseCase.execute");
		return this.repo.findById(id);
	}
}

export class CreateTransactionUseCase {
	constructor(private repo: TransactionRepository) {}

	async execute(body: TransactionBody, log: FastifyBaseLogger) {
		log.info("CreateTransactionUseCase.execute");
		console.log("creation transaction", body);

		// Save transaction
		const transaction = await this.repo.create(normalizeTransactionRefs(body));

		if (body.children?.length) {
			// Creation of subtransaction
			await body.children.reduce(async (acc, child) => {
				const wait = await acc;
				const createdChild = await this.repo.create({
					...normalizeTransactionRefs(child),
					date: transaction.date,
					parentId: transaction.id,
				});
				if (child.tags?.length) {
					await this.repo.bulkCreateTags(
						child.tags.map((t) => ({
							transactionId: createdChild.id,
							tagId: t.id,
						})),
					);
				}

				return wait;
			}, Promise.resolve(0));
		}
		if (body.tags?.length) {
			await this.repo.bulkCreateTags(
				body.tags.map((t) => ({
					transactionId: transaction.id,
					tagId: t.id,
				})),
			);
		}
		console.log("transaction créée !!!!");
		return transaction;
	}
}

export class UpdateTransactionUseCase {
	constructor(private repo: TransactionRepository) {}

	async execute(id: number, type: string, body: TransactionBody, log: FastifyBaseLogger) {
		log.info({ id, type }, "UpdateTransactionUseCase.execute");
		// Retrieve parent transaction and its children
		const transaction = await this.repo.findByIdWithChildren(id);
		if (!transaction) {
			throw new Error("Transaction not found");
		}
		const transactionIds = [id, ...(transaction.children?.map((c) => c.id) ?? [])];

		// Add missing fields in chidlren
		const incomingChildren = (body.children ?? []).map((c) => {
			c.date = transaction.date;
			c.parentId = transaction.id;
			return c;
		});
		const existingById = new Map(transaction.children?.map((child) => [child.id, child]));
		const incomingById = new Map(incomingChildren.filter((c) => c.id).map((c) => [c.id, c]));

		if (type === "quick") {
			// Update parent transaction
			console.log("==> quick update");
			await this.repo.updateInstance(transaction, normalizeTransactionRefs(body));
			return { ok: true };
		}

		try {
			await this.repo.runInTransaction(async (t) => {
				// Clear all transaction tags
				console.log("==> clear all transactions tags");
				await this.repo.deleteTransactionTags(transactionIds, { transaction: t });

				// Update parent transaction
				console.log("==> update parent");
				await this.repo.updateInstance(transaction, normalizeTransactionRefs(body), { transaction: t });

				// Add transaction tag for the parent
				console.log("==> add transcation tag parent");
				if (body.tags?.length) {
					await this.repo.bulkCreateTags(
						body.tags.map((t) => ({
							transactionId: transaction.id,
							tagId: t.id,
						})),
						{ transaction: t },
					);
				}

				// update existing children
				console.log("==> udpate existing children");
				for (const [childId, childInstance] of existingById) {
					const child = incomingById.get(childId);
					if (child) {
						await this.repo.updateInstance(childInstance, child, { transaction: t });
						if (child.tags?.length) {
							console.log("==> tag");
							await this.repo.bulkCreateTags(
								child.tags.map((t) => ({
									transactionId: child.id,
									tagId: t.id,
								})),
								{ transaction: t },
							);
						}
					}
				}

				// create new children
				console.log("==> create children");
				for (const child of incomingChildren) {
					if (!child.id) {
						console.log("creation children", child);
						const createdChild = await this.repo.create(child, { transaction: t });
						if (child.tags?.length) {
							console.log("==> tag");
							await this.repo.bulkCreateTags(
								child.tags.map((t) => ({
									transactionId: createdChild.id,
									tagId: t.id,
								})),
								{ transaction: t },
							);
						}
					}
				}

				// delete removed children
				console.log("==> delete children");
				for (const [childId, childInstance] of existingById) {
					if (!incomingById.has(childId)) {
						await this.repo.destroyInstance(childInstance, { transaction: t });
					}
				}
			});

			// If the execution reaches this line, the transaction has been committed successfully
			// `result` is whatever was returned from the transaction callback
		} catch (error) {
			// If the execution reaches this line, an error occurred.
			// The transaction has already been rolled back automatically by Drizzle!
			console.log("error !!!!!!", error);
			return { ok: false };
		}

		return { ok: true };
	}
}

export class DeleteTransactionUseCase {
	constructor(private repo: TransactionRepository) {}

	async execute(id: number, log: FastifyBaseLogger) {
		log.info({ id }, "DeleteTransactionUseCase.execute");
		const transaction = await this.repo.findByIdWithChildren(id);
		if (!transaction) {
			throw new Error("Transaction not found");
		}
		const children = transaction.children ?? [];
		const transactionIds = [id, ...children.map((c) => c.id)];
		log.info({ id }, "Subcategories to delete");

		// No cascade on `parent`: children must be deleted explicitly
		await this.repo.runInTransaction(async (t) => {
			await this.repo.deleteTransactionTags(transactionIds, { transaction: t });
			for (const child of children) {
				await this.repo.destroyInstance(child, { transaction: t });
			}
			await this.repo.destroyInstance(transaction, { transaction: t });
		});

		return { deleted: true };
	}
}

export class ListTransactionsByAccountUseCase {
	constructor(private repo: TransactionRepository) {}

	async execute(accountId: number, log: FastifyBaseLogger) {
		log.info({ accountId }, "ListTransactionsByAccountUseCase.execute");

		const [directTransactions, subTransactions] = await Promise.all([
			this.repo.findDirectTransactionsByAccount(accountId),
			this.repo.findSubTransactionsByAccount(accountId),
		]);
		log.info(
			{ directTransactions: directTransactions.length, subTransactions: subTransactions.length },
			"Transactions count",
		);
		const all = mergeAndSortTransactions(directTransactions, subTransactions);
		return all;
	}
}

export class ListTransactionsByCategoryUseCase {
	constructor(private repo: TransactionRepository) {}

	async execute(categoryId: number, log: FastifyBaseLogger) {
		log.info({ categoryId }, "ListTransactionsByCategoryUseCase.execute");

		const subCategories = await this.repo.findSubCategories(categoryId);
		const categorieIds = [categoryId, ...subCategories.map((c) => c.id)];
		log.info({ categorieIds }, "searching transactions for categories");

		const [directTransactions, subTransactions] = await Promise.all([
			this.repo.findDirectTransactionsByCategory(categorieIds),
			this.repo.findSubTransactionsByCategory(categorieIds),
		]);

		log.info(
			{ directTransactions: directTransactions.length, subTransactions: subTransactions.length },
			"Transactions count",
		);

		const all = mergeAndSortTransactions(directTransactions, subTransactions);
		return all;
	}
}

export class ListTransactionsByTagUseCase {
	constructor(private repo: TransactionRepository) {}

	async execute(tagId: number, log: FastifyBaseLogger) {
		log.info({ tagId }, "ListTransactionsByTagUseCase.execute");

		const [directTransactions, subTransactions] = await Promise.all([
			this.repo.findDirectTransactionsByTag(tagId),
			this.repo.findSubTransactionsByTag(tagId),
		]);

		log.info(
			{ directTransactions: directTransactions.length, subTransactions: subTransactions.length },
			"Transactions count",
		);

		const all = mergeAndSortTransactions(directTransactions, subTransactions);
		return all;
	}
}
