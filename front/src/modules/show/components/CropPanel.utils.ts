import { createContext, useContext } from "react";

export type CropRequest = { aspect: number; onConfirm: (file: File) => void };

export const CropPanelContext = createContext<((request: CropRequest) => void) | null>(null);

// opens the side panel of the closest CropPanel; null outside of one
export function useCropPanel() {
	return useContext(CropPanelContext);
}
