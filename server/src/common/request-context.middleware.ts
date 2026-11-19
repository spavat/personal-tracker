import { Injectable, NestMiddleware } from "@nestjs/common";

import { runInRequestContext } from "./request-context.js";

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
	use(_req: any, _res: any, next: (error?: any) => void) {
		runInRequestContext(next);
	}
}
