import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	DeleteWorkParamsRequestSchema,
	SaveWorkBodyRequestSchema,
	WorkDetailsParamsRequestSchema,
	WorkGroupedListRequestSchema,
	WorkSchema,
} from "@personal-tracker/shared/show";

import { WorkRepository } from "./work.repository";
import {
	DeleteWorkUseCase,
	GetGroupedWorksUseCase,
	GetWorkUseCase,
	ListWorksUseCase,
	SaveWorkUseCase,
} from "./work.useCases";

const worksRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new WorkRepository(fastify.db);
	const listWorks = new ListWorksUseCase(repository);
	const getGroupedWorks = new GetGroupedWorksUseCase(repository);
	const getWork = new GetWorkUseCase(repository);
	const saveWork = new SaveWorkUseCase(repository);
	const deleteWork = new DeleteWorkUseCase(repository);

	fastify.withTypeProvider<ZodTypeProvider>().get("/", async (request) => listWorks.execute(request.log));

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/grouped",
		{
			config: { public: true },
			schema: {
				querystring: WorkGroupedListRequestSchema,
			},
		},
		async (request): Promise<any> => getGroupedWorks.execute(Boolean(request.query.groupByYear), request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/:id",
		{
			schema: { params: WorkDetailsParamsRequestSchema },
		},
		async (request, reply): Promise<any> =>
			(await getWork.execute(request.params.id, request.log)) ?? reply.notFound("Œuvre introuvable"),
	);
	// 201 with the new work on create, 200 with the updated one on update
	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post(
			"/save",
			{ schema: { body: SaveWorkBodyRequestSchema, response: { 200: WorkSchema, 201: WorkSchema } } },
			async (request, reply) => {
				const work = await saveWork.execute(request.body, request.log);
				if (!work) {
					return reply.notFound("Œuvre introuvable");
				}
				return reply.code(request.body.id ? 200 : 201).send(work);
			},
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.delete("/:id", { schema: { params: DeleteWorkParamsRequestSchema } }, async (request, reply) => {
			await deleteWork.execute(request.params.id, request.log);
			return reply.code(204).send();
		});
};

export default worksRoutes;
