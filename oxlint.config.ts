import pluginQuery from "@tanstack/eslint-plugin-query";
import { defineConfig } from "oxlint";

export default defineConfig({
	plugins: ["typescript", "unicorn", "oxc", "react"],
	jsPlugins: ["@tanstack/eslint-plugin-query"],
	categories: {
		correctness: "error",
	},
	rules: {
		...pluginQuery.configs.recommended.rules,
		"no-unused-vars": ["error", { ignoreRestSiblings: true, varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
		"react/rules-of-hooks": "error",
		"react/exhaustive-deps": "warn",
		"react/only-export-components": [
			"warn",
			{
				allowConstantExport: true,
			},
		],
	},
	ignorePatterns: ["**/dist/**", "**/*.gen.ts", "*.min.js"],
	overrides: [
		{
			files: ["front/src/routes/**"],
			rules: {
				"react/only-export-components": "off",
			},
		},
	],
});
