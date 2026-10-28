import { createFileRoute } from "@tanstack/react-router";

import AppReadingBook from "../modules/reading-book";

export const Route = createFileRoute("/reading-book")({
	component: AppReadingBook,
});
