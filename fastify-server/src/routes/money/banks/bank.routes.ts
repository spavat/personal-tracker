import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	BankParamsRequestSchema,
	CreateBankBodyRequestSchema,
	UpdateBankBodyRequestSchema,
} from "@personal-tracker/shared/money";

import { TransactionRepository } from "../transactions/transaction.repository";
import { BankRepository } from "./bank.repository";
import {
	CreateBankUseCase,
	DeleteBankUseCase,
	GetBankUseCase,
	GetBanksOverviewUseCase,
	GetBanksTreeUseCase,
	ListBanksUseCase,
	UpdateBankUseCase,
} from "./bank.useCases";

const moneyRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new BankRepository(fastify.db);
	const listBanks = new ListBanksUseCase(repository);
	const getBank = new GetBankUseCase(repository);
	const createBank = new CreateBankUseCase(repository);
	const updateBank = new UpdateBankUseCase(repository);
	const deleteBank = new DeleteBankUseCase(repository);
	const getBanksOverview = new GetBanksOverviewUseCase(repository, new TransactionRepository(fastify.db));
	const getBanksTree = new GetBanksTreeUseCase(repository);

	fastify.get("/", async (request) => listBanks.execute(request.log));

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.get(
			"/:id",
			{ schema: { params: BankParamsRequestSchema } },
			async (request, reply) =>
				(await getBank.execute(request.params.id, request.log)) ?? reply.notFound("Banque introuvable"),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/", { schema: { body: CreateBankBodyRequestSchema } }, async (request) =>
			createBank.execute(request.body, request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post(
			"/:id",
			{ schema: { params: BankParamsRequestSchema, body: UpdateBankBodyRequestSchema } },
			async (request, reply) => {
				const updatedBank = await updateBank.execute(
					{ id: request.params.id, data: request.body },
					request.log,
				);
				if (!updatedBank) {
					reply.status(404).send({ message: "Banque non trouvée." });
					return;
				}
				return updatedBank;
			},
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.delete("/:id", { schema: { params: BankParamsRequestSchema } }, async (request) => {
			await deleteBank.execute(request.params.id, request.log);
			return { deleted: true };
		});

	fastify.get("/overview", async (request) => getBanksOverview.execute(request.log));

	fastify.get("/tree", async (request) => getBanksTree.execute(request.log));
};

export default moneyRoutes;
