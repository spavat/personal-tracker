import type {
	PerformanceView,
	RoleView,
	SaveCastingBodyRequestSchema,
	SavePerformanceBodyRequestSchema,
} from "@personal-tracker/shared/show";
import type { z } from "zod";

import type { showArtist, showPerformance, showPlace, showRole, showSpectacle } from "../../../db/schema";

import { optionalMediaUrl } from "../media/media.entity";

export type SavePerformanceBody = z.infer<typeof SavePerformanceBodyRequestSchema>;
export type SaveCastingBody = z.infer<typeof SaveCastingBodyRequestSchema>;

// Rows of the relational queries: performance with { place, spectacle, role: { with: { artist } } }
// and extras { placeName: placeNameAt }
type RoleRow = typeof showRole.$inferSelect & { artist: typeof showArtist.$inferSelect | null };
type PerformanceRow = typeof showPerformance.$inferSelect & {
	placeName: string;
	place: typeof showPlace.$inferSelect | null;
	spectacle: Pick<typeof showSpectacle.$inferSelect, "id" | "name"> | null;
	// only when the cast was loaded
	role?: Array<RoleRow>;
};

export function toRoleView(role: RoleRow): RoleView {
	return {
		id: role.id,
		name: role.name ?? "",
		main: role.main ?? false,
		status: role.status,
		order: role.order ?? 0,
		pictureId: role.pictureId,
		artist: { id: role.artistId ?? 0, name: role.artist?.name ?? "" },
		// role portrait, else the artist's main photo
		pictureUrl: optionalMediaUrl(role.pictureId ?? role.artist?.pictureId),
	};
}

// Every field is listed: a new column doesn't leak into the API
export function toPerformanceView(perf: PerformanceRow): PerformanceView {
	return {
		id: perf.id,
		date: perf.date,
		canceled: perf.canceled,
		seat: perf.seat,
		casting_status: perf.casting_status,
		casting_origin: perf.casting_origin,
		posterId: perf.posterId,
		posterUrl: optionalMediaUrl(perf.posterId),
		place: perf.place && { id: perf.place.id, name: perf.placeName, country: perf.place.country },
		spectacle: { id: perf.spectacleId, name: perf.spectacle?.name ?? "" },
		roles: perf.role?.map(toRoleView),
	};
}
