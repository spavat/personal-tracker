import { createFileRoute } from "@tanstack/react-router";

import AccountList from "../../../modules/money/accounts/AccountList";
import { banksTreeQuery } from "../../../modules/money/api";

export const Route = createFileRoute("/money/accounts/_tree")({
	loader: ({ context }) => context.queryClient.query({ ...banksTreeQuery(), staleTime: "static" }),
	component: AccountList,
});
