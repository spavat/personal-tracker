import { Controller, Get, Logger, SerializeOptions } from "@nestjs/common";
import { GetLatestResponseSchema } from "@personal-tracker/shared/home";

import { Public } from "../auth/public.decorator.js";
import { toUseCaseLog } from "../common/use-case-log.js";
import { GetLatestUseCase } from "./home.useCases.js";

@Controller("home")
export class HomeController {
	private readonly log = toUseCaseLog(new Logger(HomeController.name));

	constructor(private readonly getLatest: GetLatestUseCase) {}

	// public: each repository applies the visitor's rules (private programs, recent performances)
	@Get("latest")
	@Public()
	@SerializeOptions({ schema: GetLatestResponseSchema })
	latest() {
		return this.getLatest.execute(this.log);
	}
}
