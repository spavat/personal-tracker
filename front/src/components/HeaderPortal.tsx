import { ReactNode } from "react";
import { createPortal } from "react-dom";

import { useHeaderSlot } from "../hooks/use-header-slot";

export function HeaderPortal({ children }: { children: ReactNode }) {
	const headerSlot = useHeaderSlot();
	if (!headerSlot?.slotNode) return null;
	return createPortal(children, headerSlot.slotNode);
}
