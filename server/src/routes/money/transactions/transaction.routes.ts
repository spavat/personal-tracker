import type { FastifyPluginAsync } from "fastify";

import type { TransactionBody } from "./transaction.entity";

import { TransactionRepository } from "./transaction.repository";
import {
	CreateTransactionUseCase,
	DeleteTransactionUseCase,
	GetTransactionUseCase,
	ListTransactionsByAccountUseCase,
	ListTransactionsByCategoryUseCase,
	ListTransactionsByTagUseCase,
	ListTransactionsUseCase,
	UpdateTransactionUseCase,
} from "./transaction.useCases";

interface AccountParams {
	accountId: number;
}
interface CategoryParams {
	categoryId: number;
}
interface TagParams {
	tagId: number;
}

interface ParamsWithId {
	id: number;
}
interface UpdateParams extends ParamsWithId {
	type: string;
}

interface ParamsWithOptions {
	from: string;
	to: string;
	searchText: string;
	dateOrder: string;
}

const moneyRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new TransactionRepository(fastify.db);
	const listTransactions = new ListTransactionsUseCase(repository);
	const getTransaction = new GetTransactionUseCase(repository);
	const createTransaction = new CreateTransactionUseCase(repository);
	const updateTransaction = new UpdateTransactionUseCase(repository);
	const deleteTransaction = new DeleteTransactionUseCase(repository);
	const listTransactionsByAccount = new ListTransactionsByAccountUseCase(repository);
	const listTransactionsByCategory = new ListTransactionsByCategoryUseCase(repository);
	const listTransactionsByTag = new ListTransactionsByTagUseCase(repository);

	fastify.get<{ Querystring: ParamsWithOptions }>("/", async (request) =>
		listTransactions.execute(request.query, request.log),
	);

	fastify.get<{ Params: ParamsWithId }>(
		"/:id",
		async (request, reply) =>
			(await getTransaction.execute(request.params.id, request.log)) ?? reply.notFound("Transaction introuvable"),
	);

	fastify.post<{ Body: TransactionBody }>("/", async (request) =>
		createTransaction.execute(request.body, request.log),
	);

	fastify.post<{ Body: TransactionBody; Params: UpdateParams }>("/:id/:type", async (request) =>
		updateTransaction.execute(request.params.id, request.params.type, request.body, request.log),
	);

	fastify.delete<{ Params: ParamsWithId }>("/:id", async (request) =>
		deleteTransaction.execute(request.params.id, request.log),
	);

	fastify.get<{ Params: AccountParams }>("/account/:accountId", async (request) =>
		listTransactionsByAccount.execute(request.params.accountId, request.log),
	);

	fastify.get<{ Params: CategoryParams }>("/category/:categoryId", async (request) =>
		listTransactionsByCategory.execute(request.params.categoryId, request.log),
	);

	fastify.get<{ Params: TagParams }>("/tag/:tagId", async (request) =>
		listTransactionsByTag.execute(request.params.tagId, request.log),
	);
};

export default moneyRoutes;
