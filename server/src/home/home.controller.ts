import { Controller, Get, SerializeOptions } from "@nestjs/common";
import { GetLatestResponseSchema } from "@personal-tracker/shared/home";

import { Public } from "../auth/public.decorator.js";
import { HomeService } from "./home.service.js";

@Controller("home")
export class HomeController {
	constructor(private readonly service: HomeService) {}

	// public: each repository applies the visitor's rules (private programs, recent performances)
	@Get("latest")
	@Public()
	@SerializeOptions({ schema: GetLatestResponseSchema })
	latest() {
		return this.service.latest();
	}
}
