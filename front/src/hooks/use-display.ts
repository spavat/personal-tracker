import { startTransition } from "react";
import { flushSync } from "react-dom";

import { useStoredValue } from "./stored-value";

export type DisplayType = "list" | "card";

// Stored list/card display, switched through a view transition when the browser supports it.
export function useDisplay(storageKey: string, defaultValue: DisplayType = "list") {
	const [display, setDisplay] = useStoredValue<DisplayType>(storageKey, defaultValue);

	function changeDisplay(next: DisplayType) {
		if (!document.startViewTransition) {
			// non-blocking so the select repaints before a heavy re-render
			startTransition(() => setDisplay(next));
			return;
		}
		// flushSync so the new layout is in the DOM when the browser takes the "after" snapshot
		document.startViewTransition(() => flushSync(() => setDisplay(next)));
	}

	return [display, changeDisplay] as const;
}
