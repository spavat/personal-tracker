import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { fromNodeHeaders } from "better-auth/node";

import { setViewerIsOwner } from "../common/request-context.js";
import { Auth } from "./auth.js";
import { AUTH } from "./auth.tokens.js";
import { Public } from "./public.decorator.js";

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		@Inject(AUTH) private readonly auth: Auth,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const session = await this.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
		setViewerIsOwner(session !== null);
		if (session) {
			return true;
		}

		const isPublic = this.reflector.getAllAndOverride(Public, [context.getHandler(), context.getClass()]);
		if (isPublic && (request.method === "GET" || request.method === "HEAD")) {
			return true;
		}
		throw new UnauthorizedException();
	}
}
