export interface NavItem {
	path: string;
	title: string;
	icon: string;
}

export interface NavSection {
	title?: string;
	items: Array<NavItem>;
}

export const navSections: NavSection[] = [
	{
		items: [
			{ path: "/", title: "Accueil", icon: "🏠" },
			{ path: "/calendar", title: "Calendrier", icon: "📅" },
		],
	},
	{
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
		title: "Vie",
		items: [
			{ path: "/sport", title: "Sport", icon: "🏃" },
			{ path: "/lifespan", title: "Durée de vie", icon: "⏳" },
			{ path: "/money", title: "Argent", icon: "💶" },
		],
	},
	{
		title: "Config",
		items: [{ path: "/context-tags", title: "Tags", icon: "🏷️" }],
	},
];

export const allNavItems = navSections.flatMap((section) => section.items);
