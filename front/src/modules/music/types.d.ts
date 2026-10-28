namespace Music {
	interface GenreDetailsStats {
		name: string;
		duration: number;
		count: number;
	}
	interface GenreStats {
		name: string;
		duration: number;
		key?: string;
		details: Record<string, GenreDetailsStats>;
	}
}
