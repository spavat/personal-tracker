import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			// mirror the tsconfig "@shared/*" path so route modules resolve under vitest
			"@shared": new URL("../shared", import.meta.url).pathname,
		},
	},
	test: {
		// Co-located unit tests only. The legacy `test/` dir uses node:test and needs a live DB.
		include: ["src/**/*.test.ts"],
		environment: "node",
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "lcov"],
			reportsDirectory: "coverage",
			// the application code the unit suite targets; repositories are the
			// deliberate DB boundary and will read low here by design
			include: ["src/routes/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/test-support/**"],
		},
	},
});
