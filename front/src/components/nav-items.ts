export interface NavItem {
	path: string;
	title: string;
	icon: string;
}

export interface NavSection {
	id: string;
	title?: string;
	items: Array<NavItem>;
}

export const navSections: NavSection[] = [
	{
		id: "4e3ffd47-7827-48cd-a974-ba4f5ca24b35",
		items: [
			{ path: "/", title: "Accueil", icon: "🏠" },
			{ path: "/calendar", title: "Calendrier", icon: "📅" },
		],
	},
	{
		id: "543b3fe1-d62f-480d-a144-6f9c9c776546",
		title: "Culture",
		items: [
			{ path: "/shows", title: "Spectacle", icon: "🎭" },
			{ path: "/music", title: "Musique", icon: "🎶" },
			{ path: "/reading-book", title: "Livre", icon: "📖" },
			{ path: "/reading-manga", title: "Manga", icon: "📚" },
			{ path: "/broadcast", title: "Émissions", icon: "🎙️" },
			{ path: "/game", title: "Jeux", icon: "🎮" },
			{ path: "/entities", title: "Répertoire", icon: "📇" },
			{ path: "/reports", title: "Reports", icon: "📊" },
		],
	},
	{
		id: "a2f91bb6-5311-4485-a828-a203f5f00dce",
		title: "Vie",
		items: [
			{ path: "/sport", title: "Sport", icon: "🏃" },
			{ path: "/lifespan", title: "Durée de vie", icon: "⏳" },
			{ path: "/money", title: "Argent", icon: "💶" },
		],
	},
	{
		id: "697a20c1-618f-41d3-813d-42f9fea9d00e",
		title: "Config",
		items: [{ path: "/context-tags", title: "Tags", icon: "🏷️" }],
	},
];

export const allNavItems = navSections.flatMap((section) => section.items);
