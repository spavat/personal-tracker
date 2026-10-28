import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	CreatePaymentTypeBodyRequestSchema,
	PaymentTypeParamsRequestSchema,
	UpdatePaymentTypeBodyRequestSchema,
} from "@personal-tracker/shared/money";

import { PaymentTypeRepository } from "./paymentType.repository";
import {
	CreatePaymentTypeUseCase,
	DeletePaymentTypeUseCase,
	GetPaymentTypeDetailsUseCase,
	GetPaymentTypeUseCase,
	ListPaymentTypesUseCase,
	UpdatePaymentTypeUseCase,
} from "./paymentType.useCases";

const moneyRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new PaymentTypeRepository(fastify.db);
	const listPaymentTypes = new ListPaymentTypesUseCase(repository);
	const getPaymentType = new GetPaymentTypeUseCase(repository);
	const getPaymentTypeDetails = new GetPaymentTypeDetailsUseCase(repository);
	const createPaymentType = new CreatePaymentTypeUseCase(repository);
	const updatePaymentType = new UpdatePaymentTypeUseCase(repository);
	const deletePaymentType = new DeletePaymentTypeUseCase(repository);

	fastify.get("/", async (request) => listPaymentTypes.execute(request.log));

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.get(
			"/:id",
			{ schema: { params: PaymentTypeParamsRequestSchema } },
			async (request, reply) =>
				(await getPaymentType.execute(request.params.id, request.log)) ??
				reply.notFound("Moyen de paiement introuvable"),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.get(
			"/:id/details",
			{ schema: { params: PaymentTypeParamsRequestSchema } },
			async (request, reply) =>
				(await getPaymentTypeDetails.execute(request.params.id, request.log)) ??
				reply.notFound("Moyen de paiement introuvable"),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/", { schema: { body: CreatePaymentTypeBodyRequestSchema } }, async (request) =>
			createPaymentType.execute(request.body, request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post(
			"/:id",
			{ schema: { params: PaymentTypeParamsRequestSchema, body: UpdatePaymentTypeBodyRequestSchema } },
			async (request, reply) => {
				const updatedAccount = await updatePaymentType.execute(
					{ id: request.params.id, data: request.body },
					request.log,
				);
				if (!updatedAccount) {
					reply.status(404).send({ message: "Type de paiement non trouvé." });
					return;
				}
				return updatedAccount;
			},
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.delete("/:id", { schema: { params: PaymentTypeParamsRequestSchema } }, async (request) => {
			await deletePaymentType.execute(request.params.id, request.log);
			return { deleted: true };
		});
};

export default moneyRoutes;
