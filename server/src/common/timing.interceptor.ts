import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { finalize } from "rxjs";

@Injectable()
export class TimingInterceptor implements NestInterceptor {
	private readonly logger = new Logger(TimingInterceptor.name);

	intercept(context: ExecutionContext, next: CallHandler) {
		const now = performance.now();

		const { method, url } = context.switchToHttp().getRequest();

		return next
			.handle()
			.pipe(finalize(() => this.logger.log(`${method} ${url} ${(performance.now() - now).toFixed(2)}ms`)));
	}
}
