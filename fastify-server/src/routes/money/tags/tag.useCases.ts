import type { CreateTagBody, UpdateTagBody } from "@personal-tracker/shared/money";
import type { FastifyBaseLogger } from "fastify";

import type { Analytic, AnalyticBadge, WIPAnalyticPart } from "./tag.entity";
import type { TagRepository } from "./tag.repository";

import { sortByNames } from "./tag.entity";

export class ListTagsUseCase {
	constructor(private repo: TagRepository) {}

	execute(log: FastifyBaseLogger) {
		log.info("ListTagsUseCase.execute");
		return this.repo.findAll();
	}
}

export class GetTagUseCase {
	constructor(private repo: TagRepository) {}

	async execute(id: number, log: FastifyBaseLogger) {
		log.info("GetTagUseCase.execute");
		const tag = await this.repo.findById(id);
		if (!tag) return null;
		const transactions = await this.repo.findTransactionsUsingTag(id);
		return { ...tag, transactions: transactions.length };
	}
}

export class CreateTagUseCase {
	constructor(private repo: TagRepository) {}

	execute(data: CreateTagBody, log: FastifyBaseLogger) {
		log.info("CreateTagUseCase.execute");
		return this.repo.create(data);
	}
}

export class UpdateTagUseCase {
	constructor(private repo: TagRepository) {}

	execute({ id, data }: { id: number; data: UpdateTagBody }, log: FastifyBaseLogger) {
		log.info("UpdateTagUseCase.execute");
		return this.repo.update(id, data);
	}
}

export class DeleteTagUseCase {
	constructor(private repo: TagRepository) {}

	async execute(id: number, log: FastifyBaseLogger): Promise<boolean> {
		log.info("DeleteTagUseCase.execute");
		const subTags = await this.repo.findSubTags(id);
		if (subTags.length) {
			console.log("subtag exists", subTags);
			return false;
		}

		const transactions = await this.repo.findTransactionsUsingTag(id);
		if (transactions.length) {
			console.log("transactions are still using this tag", transactions.length);
			return false;
		}

		const deleted = await this.repo.destroy(id);
		if (!deleted) {
			console.log("Impossible de trouver la catégorie", id);
			return false;
		}

		return true;
	}
}

export class GetTagAnalyticsUseCase {
	constructor(private repo: TagRepository) {}

	async execute(splitParent: boolean, log: FastifyBaseLogger): Promise<Array<Analytic>> {
		log.info("GetTagAnalyticsUseCase.execute");
		const tags = await this.repo.findAllWithTransactionsForAnalytics();

		const response: Record<string, Analytic> = {};
		if (splitParent) {
			tags.forEach((t) => {
				const [parent, name] = (t.name ?? "").split("\\");
				if (!response[parent]) {
					response[parent] = {
						name: parent,
						badges: [],
					};
				}

				t.transactions?.forEach((t) => {
					const date = t.considerationDate ?? t.date ?? "";
					const year = date.substring(0, 4);
					const badgeName = `${parent} ${year}`;
					let badge = response[parent].badges.find((b) => b.name === badgeName);
					if (!badge) {
						badge = {
							name: `${parent} ${year}`,
							icon: "",
							textColor: "#000000",
							backgroundColor: "#FFFFFF",
							amount: 0,
							comment: "0",
							parts: [],
						};
						response[parent].badges.push(badge);
					}
					badge.amount += t.amount ?? 0;
					badge.comment = String(parseInt(badge.comment, 10) + 1);

					let part = badge.parts.find((p) => p.name === name);
					if (!part) {
						part = {
							name,
							amount: 0,
							comment: "0",
						};
						badge.parts.push(part);
					}
					part.amount += t.amount ?? 0;
					part.comment = String(parseInt(part.comment, 10) + 1);
				});
			});

			return Object.values(response)
				.toSorted(sortByNames)
				.map((a) => {
					a.badges.sort(sortByNames);
					return a;
				});
		}

		tags.forEach((t) => {
			const [parent, name] = (t.name ?? "").split("\\");
			if (!response[parent]) {
				response[parent] = {
					name: parent,
					badges: [],
				};
			}

			const years: Record<string, WIPAnalyticPart> = {};
			let total = 0;
			let nbTransactions = 0;
			t.transactions?.forEach((t) => {
				const date = t.considerationDate ?? t.date ?? "";
				const year = date.substring(0, 4);
				if (!years[year]) {
					years[year] = {
						name: year,
						amount: 0,
						nbTransactions: 0,
					};
				}
				years[year].amount += t.amount ?? 0;
				years[year].nbTransactions += 1;
				total += t.amount ?? 0;
				nbTransactions += 1;
			});
			const tagsWithYearlyAmount: AnalyticBadge = {
				name: name ?? parent,
				icon: t.icon,
				textColor: t.textColor,
				backgroundColor: t.backgroundColor,
				amount: total,
				comment: String(nbTransactions),
				parts: Object.values(years).map((year) => {
					const { nbTransactions, ...yearWithoutNbTransactions } = year;
					return { ...yearWithoutNbTransactions, comment: String(nbTransactions) };
				}),
			};
			response[parent].badges.push(tagsWithYearlyAmount);
		});

		return Object.values(response)
			.toSorted(sortByNames)
			.map((a) => {
				a.badges.sort(sortByNames);
				return a;
			});
	}
}
