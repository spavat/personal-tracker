import { describe, expect, it } from "vitest";

import { toPerformanceView, toRoleView } from "./performance.entity.js";

const PERFORMANCE_ID = "00000000-0000-4000-8000-000000000010";
const PLACE_ID = "00000000-0000-4000-8000-000000000007";
const SPECTACLE_ID = "00000000-0000-4000-8000-000000000100";
const ROLE_ID = "00000000-0000-4000-8000-000000000003";
const performance = {
	id: PERFORMANCE_ID,
	date: "2024-01-01 20:00:00",
	placeId: PLACE_ID,
	spectacleId: SPECTACLE_ID,
	canceled: false,
	seat: "A1",
	casting_status: "complete" as const,
	casting_origin: "program" as const,
	posterId: "11111111-1111-4111-8111-111111111111",
	placeName: "Old Bastille",
	place: { id: PLACE_ID, name: "Bastille", address: "", country: "fr", link: null },
	spectacle: { id: SPECTACLE_ID, name: "Tosca" },
};

const ENTITY_ID = "00000000-0000-4000-8000-000000000005";
const role = {
	id: ROLE_ID,
	entityId: ENTITY_ID,
	performanceId: PERFORMANCE_ID,
	name: "Tosca",
	status: null,
	main: true,
	order: 1,
	entity: { id: ENTITY_ID, name: "Callas", pictureKey: `personal-tracker/entity/${ENTITY_ID}.ab12cd34.avif` },
};

describe("toPerformanceView", () => {
	it("nests the place, named as it was at the performance date, and the spectacle", () => {
		expect(toPerformanceView(performance)).toEqual({
			id: PERFORMANCE_ID,
			date: "2024-01-01 20:00:00",
			canceled: false,
			seat: "A1",
			casting_status: "complete",
			casting_origin: "program",
			posterId: "11111111-1111-4111-8111-111111111111",
			posterUrl: "/images/show/11111111-1111-4111-8111-111111111111",
			place: { id: PLACE_ID, name: "Old Bastille", country: "fr" },
			spectacle: { id: SPECTACLE_ID, name: "Tosca" },
			roles: undefined,
		});
	});

	it("maps the cast when it was loaded", () => {
		expect(toPerformanceView({ ...performance, role: [role] }).roles).toEqual([toRoleView(role)]);
	});

	it("keeps a performance without place", () => {
		expect(toPerformanceView({ ...performance, placeId: null, place: null }).place).toBeNull();
	});
});

describe("toRoleView", () => {
	it("nests the artist with the entity portrait", () => {
		expect(toRoleView(role)).toEqual({
			id: ROLE_ID,
			name: "Tosca",
			main: true,
			status: null,
			order: 1,
			artist: { id: ENTITY_ID, name: "Callas" },
			picture: `/images/entity/${ENTITY_ID}?v=ab12cd34`,
		});
	});

	it("has no picture without portrait", () => {
		expect(toRoleView({ ...role, entity: { ...role.entity, pictureKey: null } }).picture).toBeNull();
	});
});
