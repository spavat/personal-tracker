import { Segment } from "@personal-tracker/shared/sport";

// instead of proposing to add a new one there.
export const SELECT_TOLERANCE_KM = 0.05;

export const SEGMENT_COLORS: Record<Segment["type"], string> = {
	running: "#4caf50",
	pause: "#7f0000",
};

export const SEGMENT_LABELS: Record<Segment["type"], string> = {
	running: "Course",
	pause: "Pause",
};

// Strava import types included (see server strava-import.ts)
export const ACTIVITY_TYPES: Record<string, string> = {
	running: "Course à pied",
	swimming: "Natation",
	cycling: "Cyclisme",
	walking: "Marche",
	hiking: "Randonnée",
	skiing: "Ski alpin",
	snowshoeing: "Raquettes",
};
