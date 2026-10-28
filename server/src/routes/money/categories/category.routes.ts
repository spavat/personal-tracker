import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	CategoryParamsRequestSchema,
	CreateCategoryBodyRequestSchema,
	UpdateCategoryBodyRequestSchema,
} from "@personal-tracker/shared/money";

import { CategoryRepository } from "./category.repository";
import {
	CreateCategoryUseCase,
	DeleteCategoryUseCase,
	GetCategoryUseCase,
	ListCategoriesUseCase,
	UpdateCategoryUseCase,
} from "./category.useCases";

const moneyRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new CategoryRepository(fastify.db);
	const listCategories = new ListCategoriesUseCase(repository);
	const getCategory = new GetCategoryUseCase(repository);
	const createCategory = new CreateCategoryUseCase(repository);
	const updateCategory = new UpdateCategoryUseCase(repository);
	const deleteCategory = new DeleteCategoryUseCase(repository);

	fastify.get("/", async (request) => listCategories.execute(request.log));

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.get(
			"/:id",
			{ schema: { params: CategoryParamsRequestSchema } },
			async (request, reply) =>
				(await getCategory.execute(request.params.id, request.log)) ?? reply.notFound("Catégorie introuvable"),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/", { schema: { body: CreateCategoryBodyRequestSchema } }, async (request) =>
			createCategory.execute(request.body, request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post(
			"/:id",
			{ schema: { params: CategoryParamsRequestSchema, body: UpdateCategoryBodyRequestSchema } },
			async (request, reply) => {
				const updatedCategorie = await updateCategory.execute(
					{ id: request.params.id, data: request.body },
					request.log,
				);
				if (!updatedCategorie) {
					reply.status(404).send({ message: "Categorie non trouvée." });
					return;
				}
				return updatedCategorie;
			},
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.delete("/:id", { schema: { params: CategoryParamsRequestSchema } }, async (request, reply) => {
			const deleted = await deleteCategory.execute(request.params.id, request.log);
			if (!deleted) {
				reply.status(409).send({
					message: "Impossible de supprimer la catégorie (sous-catégories ou transactions associées).",
				});
				return;
			}
			return { deleted };
		});
};

export default moneyRoutes;
