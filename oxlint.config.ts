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
		// Guards code that React Compiler memoizes; we don't use the compiler, so a render-scope
		// counter mutated in map() is harmless. Re-enable if we adopt React Compiler.
		"react/immutability": "off",
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
