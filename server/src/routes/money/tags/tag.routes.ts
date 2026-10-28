import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	CreateTagBodyRequestSchema,
	GetAnalyticsQuerystringRequestSchema,
	TagParamsRequestSchema,
	UpdateTagBodyRequestSchema,
} from "@personal-tracker/shared/money";

import { TagRepository } from "./tag.repository";
import {
	CreateTagUseCase,
	DeleteTagUseCase,
	GetTagAnalyticsUseCase,
	GetTagUseCase,
	ListTagsUseCase,
	UpdateTagUseCase,
} from "./tag.useCases";

const moneyRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new TagRepository(fastify.db);
	const listTags = new ListTagsUseCase(repository);
	const getTag = new GetTagUseCase(repository);
	const createTag = new CreateTagUseCase(repository);
	const updateTag = new UpdateTagUseCase(repository);
	const deleteTag = new DeleteTagUseCase(repository);
	const getTagAnalytics = new GetTagAnalyticsUseCase(repository);

	fastify.get("/", async (request) => listTags.execute(request.log));

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.get(
			"/:id",
			{ schema: { params: TagParamsRequestSchema } },
			async (request, reply) =>
				(await getTag.execute(request.params.id, request.log)) ?? reply.notFound("Tag introuvable"),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/", { schema: { body: CreateTagBodyRequestSchema } }, async (request) =>
			createTag.execute(request.body, request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post(
			"/:id",
			{ schema: { params: TagParamsRequestSchema, body: UpdateTagBodyRequestSchema } },
			async (request, reply) => {
				const updatedTag = await updateTag.execute({ id: request.params.id, data: request.body }, request.log);
				if (!updatedTag) {
					reply.status(404).send({ message: "Tag non trouvé." });
					return;
				}
				return updatedTag;
			},
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.delete("/:id", { schema: { params: TagParamsRequestSchema } }, async (request, reply) => {
			const deleted = await deleteTag.execute(request.params.id, request.log);
			if (!deleted) {
				reply
					.status(409)
					.send({ message: "Impossible de supprimer le tag (sous-tags ou transactions associés)." });
				return;
			}
			return { deleted };
		});

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/analytics",
		{
			schema: {
				querystring: GetAnalyticsQuerystringRequestSchema,
			},
		},
		async (request) => getTagAnalytics.execute(request.query.splitParent, request.log),
	);
};

export default moneyRoutes;
