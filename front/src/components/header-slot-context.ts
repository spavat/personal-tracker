import type { Dispatch, SetStateAction } from "react";

import { createContext } from "react";

export interface HeaderSlotContextValue {
	slotNode: HTMLElement | null;
	setSlotNode: Dispatch<SetStateAction<HTMLElement | null>>;
}

export const HeaderSlotContext = createContext<HeaderSlotContextValue | null>(null);
