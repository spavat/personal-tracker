import { Module } from "@nestjs/common";
import { RouterModule } from "@nestjs/core";

import { LifespanCategoriesModule } from "./categories/categories.module.js";
import { LifespanObjectsModule } from "./objects/objects.module.js";

@Module({
	imports: [
		LifespanCategoriesModule,
		LifespanObjectsModule,
		RouterModule.register([
			{
				path: "lifespan",
				module: LifespanModule,
				children: [
					{ path: "categories", module: LifespanCategoriesModule },
					{ path: "objects", module: LifespanObjectsModule },
				],
			},
		]),
	],
})
export class LifespanModule {}
