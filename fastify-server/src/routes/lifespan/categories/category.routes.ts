import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import "@fastify/mongodb";
import {
	LifespanCategoryDeleteParamsRequestSchema,
	LifespanCategoryListResponseSchema,
	LifespanCategorySaveBodyRequestSchema,
} from "@personal-tracker/shared/lifespan";

import { LifespanCategoryRepository } from "./category.repository";
import {
	DeleteLifespanCategoryUseCase,
	ListLifespanCategoriesUseCase,
	SaveLifespanCategoryUseCase,
} from "./category.useCases";

const lifespanCategories: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new LifespanCategoryRepository(fastify.mongo);
	const listCategories = new ListLifespanCategoriesUseCase(repository);
	const saveCategory = new SaveLifespanCategoryUseCase(repository);
	const deleteCategory = new DeleteLifespanCategoryUseCase(repository);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/list",
		{
			schema: {
				response: {
					200: LifespanCategoryListResponseSchema,
				},
			},
		},
		async (request): Promise<any> => listCategories.execute(request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/save",
		{
			schema: { body: LifespanCategorySaveBodyRequestSchema },
		},
		async (request) => saveCategory.execute(request.body, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().delete(
		"/:id",
		{
			schema: { params: LifespanCategoryDeleteParamsRequestSchema },
		},
		async (request, reply) => {
			const result = await deleteCategory.execute(request.params.id, request.log);
			if (!result.deleted) {
				reply.status(409);
			}
			return result;
		},
	);
};

export default lifespanCategories;
