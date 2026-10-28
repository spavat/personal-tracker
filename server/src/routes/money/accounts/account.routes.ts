import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	AccountParamsRequestSchema,
	CreateAccountBodyRequestSchema,
	UpdateAccountBodyRequestSchema,
} from "@personal-tracker/shared/money";

import { AccountRepository } from "./account.repository";
import {
	CreateAccountUseCase,
	DeleteAccountUseCase,
	GetAccountDetailsUseCase,
	GetAccountUseCase,
	ListAccountsUseCase,
	UpdateAccountUseCase,
} from "./account.useCases";

const moneyRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new AccountRepository(fastify.db);
	const listAccounts = new ListAccountsUseCase(repository);
	const getAccount = new GetAccountUseCase(repository);
	const getAccountDetails = new GetAccountDetailsUseCase(repository);
	const createAccount = new CreateAccountUseCase(repository);
	const updateAccount = new UpdateAccountUseCase(repository);
	const deleteAccount = new DeleteAccountUseCase(repository);

	fastify.get("/", async (request) => listAccounts.execute(request.log));

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.get(
			"/:id",
			{ schema: { params: AccountParamsRequestSchema } },
			async (request, reply) =>
				(await getAccount.execute(request.params.id, request.log)) ?? reply.notFound("Compte introuvable"),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.get(
			"/:id/details",
			{ schema: { params: AccountParamsRequestSchema } },
			async (request, reply) =>
				(await getAccountDetails.execute(request.params.id, request.log)) ??
				reply.notFound("Compte introuvable"),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/", { schema: { body: CreateAccountBodyRequestSchema } }, async (request) =>
			createAccount.execute(request.body, request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post(
			"/:id",
			{ schema: { params: AccountParamsRequestSchema, body: UpdateAccountBodyRequestSchema } },
			async (request, reply) => {
				const updatedAccount = await updateAccount.execute(
					{ id: request.params.id, data: request.body },
					request.log,
				);
				if (!updatedAccount) {
					reply.status(404).send({ message: "Compte non trouvé." });
					return;
				}
				return updatedAccount;
			},
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.delete("/:id", { schema: { params: AccountParamsRequestSchema } }, async (request) => {
			await deleteAccount.execute(request.params.id, request.log);
			return { deleted: true };
		});
};

export default moneyRoutes;
