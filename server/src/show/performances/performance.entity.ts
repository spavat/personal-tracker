import type {
	PerformanceView,
	RoleView,
	SaveCastingBodyRequestSchema,
	SavePerformanceBodyRequestSchema,
} from "@personal-tracker/shared/show";
import type { z } from "zod";

import type { coreEntity, showPerformance, showPlace, showRole, showSpectacle } from "../../database/schema.js";

import { portraitUrl } from "../../entities/entity.entity.js";
import { optionalMediaUrl } from "../media/media.entity.js";

export type SavePerformanceBody = z.infer<typeof SavePerformanceBodyRequestSchema>;
export type SaveCastingBody = z.infer<typeof SaveCastingBodyRequestSchema>;

// Rows of the relational queries: performance with { place, spectacle, role: { with: { entity } } }
// and extras { placeName: placeNameAt }
type RoleRow = typeof showRole.$inferSelect & {
	entity: Pick<typeof coreEntity.$inferSelect, "id" | "name" | "pictureKey"> | null;
};
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
		artist: { id: role.entityId ?? "", name: role.entity?.name ?? "" },
		picture: role.entity ? portraitUrl(role.entity.id, role.entity.pictureKey) : null,
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
