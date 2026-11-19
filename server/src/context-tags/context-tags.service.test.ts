import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../common/errors.js";
import { ContextTagsRepository } from "./context-tags.repository.js";
import { ContextTagsService } from "./context-tags.service.js";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("ContextTagsService", () => {
	let service: ContextTagsService;
	// one vi.fn() per repository method the service uses
	const fakeRepo = {
		findAll: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	};

	beforeEach(async () => {
		vi.resetAllMocks(); // fresh mocks for each test
		const ref = await Test.createTestingModule({
			providers: [ContextTagsService, { provide: ContextTagsRepository, useValue: fakeRepo }],
		}).compile();
		service = ref.get(ContextTagsService);
	});

	describe("list", () => {
		it("returns the tags from the repository", async () => {
			// Arrange: what the repository returns
			const tags = [{ id: UUID, name: "Genre", tags: ["scifi"] }];
			fakeRepo.findAll.mockResolvedValue(tags);

			// Act: call the real service method
			const result = await service.list();

			// Assert
			expect(fakeRepo.findAll).toHaveBeenCalledWith();
			expect(result).toEqual(tags);
		});
	});

	describe("create", () => {
		it("inserts a new tag with a generated id", async () => {
			// Arrange
			const tags = { id: UUID, name: "Genre", tags: ["scifi"] };
			fakeRepo.insert.mockResolvedValue(tags);

			// Act
			const result = await service.create({ name: "Genre", tags: ["scifi"] });

			// Assert
			expect(fakeRepo.insert).toHaveBeenCalledWith({ id: expect.any(String), name: "Genre", tags: ["scifi"] });
			expect(result).toEqual(tags);
		});
	});

	describe("update", () => {
		it("rejects with NotFoundError when the id matches nothing", async () => {
			// Arrange
			fakeRepo.update.mockResolvedValue(null);

			// Act
			const result = service.update(UUID, { name: "Genre", tags: ["scifi"] });

			// Assert
			expect(fakeRepo.update).toHaveBeenCalledWith(UUID, { name: "Genre", tags: ["scifi"] });
			await expect(result).rejects.toBeInstanceOf(NotFoundError);
		});
	});

	describe("delete", () => {
		it("rejects with NotFoundError when nothing was deleted", async () => {
			// Arrange
			fakeRepo.delete.mockResolvedValue(false);

			// Act
			const result = service.delete(UUID);

			// Assert
			expect(fakeRepo.delete).toHaveBeenCalledWith(UUID);
			await expect(result).rejects.toBeInstanceOf(NotFoundError);
		});
	});
});
