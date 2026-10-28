import { Segment } from "@personal-tracker/shared/sport";

namespace Sport {
	export type ChartPoint = {
		id: string;
		distKm: number;
		elapsedSec: number | null;
		ele: number | null;
		pace: number | null;
		__point: TrackPoint;
	};

	type Band = {
		time: number;
		x1: number;
		x2: number;
		type: Segment["type"];
		durationSec: number;
		label?: string;
	};

	// x1 and x2 are in km
	type HighlightRange = { x1: number; x2: number };
}
