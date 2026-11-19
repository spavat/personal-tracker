import type { CreateTagBody, UpdateTagBody } from "@personal-tracker/shared/money";

import { Injectable, Logger } from "@nestjs/common";

import { ConflictError, NotFoundError } from "../../common/errors.js";
import { type Analytic, type AnalyticBadge, sortByNames, type WIPAnalyticPart } from "./tag.entity.js";
import { TagsRepository } from "./tags.repository.js";

@Injectable()
export class TagsService {
	private readonly logger = new Logger(TagsService.name);
	constructor(private readonly repo: TagsRepository) {}

	list() {
		this.logger.log("list");
		return this.repo.findAll();
	}

	async get(id: number) {
		this.logger.log("get");
		const tag = (await this.repo.findById(id)) ?? notFound();
		const transactions = await this.repo.findTransactionsUsingTag(id);
		return { ...tag, transactions: transactions.length };
	}

	create(data: CreateTagBody) {
		this.logger.log("create");
		return this.repo.create(data);
	}

	async update(id: number, data: UpdateTagBody) {
		this.logger.log("update");
		return (await this.repo.update(id, data)) ?? notFound();
	}

	async delete(id: number) {
		this.logger.log("delete");
		const subTags = await this.repo.findSubTags(id);
		if (subTags.length) {
			throw new ConflictError("Le tag a des sous-tags : impossible de le supprimer");
		}
		const transactions = await this.repo.findTransactionsUsingTag(id);
		if (transactions.length) {
			throw new ConflictError(`Le tag est encore utilisé par ${transactions.length} transactions`);
		}
		if (!(await this.repo.destroy(id))) {
			notFound();
		}
	}

	async analytics(splitParent: boolean): Promise<Array<Analytic>> {
		this.logger.log("analytics");
		const tags = await this.repo.findAllWithTransactionsForAnalytics();

		const response: Record<string, Analytic> = {};
		if (splitParent) {
			for (const tag of tags) {
				const [parent, name] = (tag.name ?? "").split("\\");
				if (!response[parent]) {
					response[parent] = { name: parent, badges: [] };
				}

				for (const transaction of tag.transactions) {
					const date = transaction.considerationDate ?? transaction.date ?? "";
					const year = date.substring(0, 4);
					const badgeName = `${parent} ${year}`;
					let badge = response[parent].badges.find((b) => b.name === badgeName);
					if (!badge) {
						badge = {
							name: badgeName,
							icon: "",
							textColor: "#000000",
							backgroundColor: "#FFFFFF",
							amount: 0,
							comment: "0",
							parts: [],
						};
						response[parent].badges.push(badge);
					}
					badge.amount += transaction.amount ?? 0;
					badge.comment = String(parseInt(badge.comment, 10) + 1);

					let part = badge.parts.find((p) => p.name === name);
					if (!part) {
						part = { name, amount: 0, comment: "0" };
						badge.parts.push(part);
					}
					part.amount += transaction.amount ?? 0;
					part.comment = String(parseInt(part.comment, 10) + 1);
				}
			}
			return sortAnalytics(response);
		}

		for (const tag of tags) {
			const [parent, name] = (tag.name ?? "").split("\\");
			if (!response[parent]) {
				response[parent] = { name: parent, badges: [] };
			}

			const years: Record<string, WIPAnalyticPart> = {};
			let total = 0;
			let nbTransactions = 0;
			for (const transaction of tag.transactions) {
				const date = transaction.considerationDate ?? transaction.date ?? "";
				const year = date.substring(0, 4);
				if (!years[year]) {
					years[year] = { name: year, amount: 0, nbTransactions: 0 };
				}
				years[year].amount += transaction.amount ?? 0;
				years[year].nbTransactions += 1;
				total += transaction.amount ?? 0;
				nbTransactions += 1;
			}
			const badge: AnalyticBadge = {
				name: name ?? parent,
				icon: tag.icon,
				textColor: tag.textColor,
				backgroundColor: tag.backgroundColor,
				amount: total,
				comment: String(nbTransactions),
				parts: Object.values(years).map(({ nbTransactions, ...year }) => ({
					...year,
					comment: String(nbTransactions),
				})),
			};
			response[parent].badges.push(badge);
		}
		return sortAnalytics(response);
	}
}

function sortAnalytics(response: Record<string, Analytic>) {
	return Object.values(response)
		.toSorted(sortByNames)
		.map((analytic) => ({ ...analytic, badges: analytic.badges.toSorted(sortByNames) }));
}

function notFound(): never {
	throw new NotFoundError("Tag introuvable");
}
