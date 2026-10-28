import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		// Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		react(),
	],
	resolve: {
		alias: {
			"@personal-tracker/shared/calendar": path.resolve(
				import.meta.dirname,
				"../shared/src/schemas/calendar.schema.ts",
			),
			"@personal-tracker/shared/context-tag": path.resolve(
				import.meta.dirname,
				"../shared/src/schemas/context-tag.schema.ts",
			),
			"@personal-tracker/shared/game": path.resolve(import.meta.dirname, "../shared/src/schemas/game.schema.ts"),
			"@personal-tracker/shared/internet": path.resolve(
				import.meta.dirname,
				"../shared/src/schemas/internet.schema.ts",
			),
			"@personal-tracker/shared/lifespan": path.resolve(
				import.meta.dirname,
				"../shared/src/schemas/lifespan.schema.ts",
			),
			"@personal-tracker/shared/music": path.resolve(
				import.meta.dirname,
				"../shared/src/schemas/music.schema.ts",
			),
			"@personal-tracker/shared/reading-book": path.resolve(
				import.meta.dirname,
				"../shared/src/schemas/reading-book.schema.ts",
			),
			"@personal-tracker/shared/reading-manga": path.resolve(
				import.meta.dirname,
				"../shared/src/schemas/reading-manga.schema.ts",
			),
			"@personal-tracker/shared/show": path.resolve(import.meta.dirname, "../shared/src/schemas/show.schema.ts"),
			"@personal-tracker/shared/sport": path.resolve(
				import.meta.dirname,
				"../shared/src/schemas/sport.schema.ts",
			),

			"@personal-tracker/shared": path.resolve(import.meta.dirname, "../shared/src/index.ts"),
		},
	},
	// Same setup as production: the API is reached on the front origin under /api (VITE_API_BASE_URL=/api),
	// so the session cookie is first-party whatever host the app is opened from (localhost, LAN IP from a phone)
	server: {
		proxy: {
			"/api": {
				target: "http://localhost:3000",
				rewrite: (path) => path.replace(/^\/api/, ""),
			},
		},
	},
	optimizeDeps: {
		exclude: ["@personal-tracker/shared"],
	},
	legacy: {
		inconsistentCjsInterop: true, // https://github.com/nas5w/use-local-storage/issues/39
	},
});
