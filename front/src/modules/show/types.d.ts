namespace Musical {
	interface Role {
		role: string;
		artist: string;
		status?: string;
	}

	interface Show {
		spectacle_id: number;
		spectacle: string;
		show: string;
		version?: string;
		date: string;
		hour: string;
		place: string;
		country: string;
		canceled?: boolean;
		seat?: string;
		cast?: Array<Role>;
	}
}
