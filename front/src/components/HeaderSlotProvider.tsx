import type { ReactNode } from "react";

import { useMemo, useState } from "react";

import { HeaderSlotContext } from "./header-slot-context";

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
	const [slotNode, setSlotNode] = useState<HTMLElement | null>(null);
	const value = useMemo(() => ({ slotNode, setSlotNode }), [slotNode]);
	return <HeaderSlotContext.Provider value={value}>{children}</HeaderSlotContext.Provider>;
}
