import { describe, expect, it } from "vitest";

import { toPerformanceView, toRoleView } from "./performance.entity";

const performance = {
	id: 10,
	date: "2024-01-01 20:00:00",
	placeId: 7,
	spectacleId: 100,
	canceled: false,
	seat: "A1",
	casting_status: "complete" as const,
	casting_origin: "program" as const,
	posterId: "11111111-1111-4111-8111-111111111111",
	placeName: "Old Bastille",
	place: { id: 7, name: "Bastille", address: "", country: "fr", link: null },
	spectacle: { id: 100, name: "Tosca" },
};

const role = {
	id: 3,
	artistId: 5,
	performanceId: 10,
	name: "Tosca",
	status: null,
	main: true,
	order: 1,
	pictureId: null,
	artist: { id: 5, name: "Callas", pictureId: "22222222-2222-4222-8222-222222222222" },
};

describe("toPerformanceView", () => {
	it("nests the place, named as it was at the performance date, and the spectacle", () => {
		expect(toPerformanceView(performance)).toEqual({
			id: 10,
			date: "2024-01-01 20:00:00",
			canceled: false,
			seat: "A1",
			casting_status: "complete",
			casting_origin: "program",
			posterId: "11111111-1111-4111-8111-111111111111",
			posterUrl: "/images/show/11111111-1111-4111-8111-111111111111",
			place: { id: 7, name: "Old Bastille", country: "fr" },
			spectacle: { id: 100, name: "Tosca" },
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
	it("nests the artist and falls back to the artist's main photo", () => {
		expect(toRoleView(role)).toEqual({
			id: 3,
			name: "Tosca",
			main: true,
			status: null,
			order: 1,
			pictureId: null,
			artist: { id: 5, name: "Callas" },
			pictureUrl: "/images/show/22222222-2222-4222-8222-222222222222",
		});
	});

	it("prefers the role portrait", () => {
		const pictureId = "33333333-3333-4333-8333-333333333333";
		expect(toRoleView({ ...role, pictureId }).pictureUrl).toBe(`/images/show/${pictureId}`);
	});
});
