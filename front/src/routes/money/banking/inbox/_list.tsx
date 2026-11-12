import { createFileRoute } from "@tanstack/react-router";

import { bankInboxQuery } from "../../../../modules/money/api";
import BankInbox from "../../../../modules/money/banking/BankInbox";

export const Route = createFileRoute("/money/banking/inbox/_list")({
	loader: ({ context }) => context.queryClient.query(bankInboxQuery()),
	component: BankInbox,
});
