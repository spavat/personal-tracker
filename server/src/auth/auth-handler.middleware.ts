import type { IncomingMessage, ServerResponse } from "node:http";

import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import { toNodeHandler } from "better-auth/node";

import { Auth } from "./auth.js";
import { AUTH } from "./auth.tokens.js";

// better-auth's own routes (sign-in, sign-out, get-session…), answered by its handler
@Injectable()
export class AuthHandlerMiddleware implements NestMiddleware {
	private readonly handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;

	constructor(@Inject(AUTH) auth: Auth) {
		this.handler = toNodeHandler(auth);
	}

	use(req: IncomingMessage & { originalUrl?: string }, res: ServerResponse) {
		return this.handler(req, res);
	}
}
