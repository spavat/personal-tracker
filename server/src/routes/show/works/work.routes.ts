import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	DeleteWorkParamsRequestSchema,
	SaveWorkBodyRequestSchema,
	WorkDetailsParamsRequestSchema,
	WorkGroupedListRequestSchema,
} from "@shared/dist/schemas/show.schema";

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
	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/save", { schema: { body: SaveWorkBodyRequestSchema } }, async (request) =>
			saveWork.execute(request.body, request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.delete("/:id", { schema: { params: DeleteWorkParamsRequestSchema } }, async (request) =>
			deleteWork.execute(request.params.id, request.log),
		);
};

export default worksRoutes;
