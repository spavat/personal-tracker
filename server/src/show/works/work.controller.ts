import type { ServerResponse } from "node:http";
import type { z } from "zod";

import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Logger,
	Param,
	Post,
	Query,
	Res,
	SerializeOptions,
} from "@nestjs/common";
import {
	DeleteWorkParamsRequestSchema,
	SaveWorkBodyRequestSchema,
	WorkDetailsParamsRequestSchema,
	WorkGroupedListRequestSchema,
	WorkSchema,
} from "@personal-tracker/shared/show";

import type { SaveWorkBody } from "./work.entity.js";

import { Public } from "../../auth/public.decorator.js";
import { toUseCaseLog } from "../../common/use-case-log.js";
import { orNotFound, savedOr404 } from "../show-reply.js";
import {
	DeleteWorkUseCase,
	GetGroupedWorksUseCase,
	GetWorkUseCase,
	ListWorksUseCase,
	SaveWorkUseCase,
} from "./work.useCases.js";

@Controller()
export class WorkController {
	private readonly log = toUseCaseLog(new Logger(WorkController.name));

	constructor(
		private readonly listWorks: ListWorksUseCase,
		private readonly getGroupedWorks: GetGroupedWorksUseCase,
		private readonly getWork: GetWorkUseCase,
		private readonly saveWork: SaveWorkUseCase,
		private readonly deleteWork: DeleteWorkUseCase,
	) {}

	@Get()
	list() {
		return this.listWorks.execute(this.log);
	}

	@Get("grouped")
	@Public()
	grouped(
		@Query({ schema: WorkGroupedListRequestSchema }) { groupByYear }: z.infer<typeof WorkGroupedListRequestSchema>,
	) {
		return this.getGroupedWorks.execute(Boolean(groupByYear), this.log);
	}

	@Get(":id")
	get(@Param({ schema: WorkDetailsParamsRequestSchema }) { id }: { id: number }) {
		return orNotFound(this.getWork.execute(id, this.log), "Œuvre introuvable");
	}

	@Post("save")
	@SerializeOptions({ schema: WorkSchema })
	save(
		@Body({ schema: SaveWorkBodyRequestSchema }) body: SaveWorkBody,
		@Res({ passthrough: true }) response: ServerResponse,
	) {
		return savedOr404(response, Boolean(body.id), this.saveWork.execute(body, this.log), "Œuvre introuvable");
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: DeleteWorkParamsRequestSchema }) { id }: { id: number }) {
		await this.deleteWork.execute(id, this.log);
	}
}
