import { use } from "react";

import { HeaderSlotContext } from "../components/header-slot-context";

export function useHeaderSlot() {
	return use(HeaderSlotContext);
}
