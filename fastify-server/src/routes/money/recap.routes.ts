import type { FastifyPluginAsync } from "fastify";

import { CategoryRepository } from "./categories/category.repository";
import { GetRecapUseCase } from "./recap.useCases";
import { TransactionRepository } from "./transactions/transaction.repository";

interface ParamsWithDates {
	from: string;
	to: string;
	regroupCategory?: string;
}

const moneyRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const getRecap = new GetRecapUseCase(new CategoryRepository(fastify.db), new TransactionRepository(fastify.db));

	fastify.get<{ Querystring: ParamsWithDates }>("/recap", async (request) => {
		const { from, to, regroupCategory } = request.query;
		return getRecap.execute({ from, to, regroupCategory: regroupCategory === "true" }, request.log);
	});
};

export default moneyRoutes;
