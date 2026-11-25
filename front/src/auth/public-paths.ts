// Pages an anonymous visitor may open; everything else redirects to the home page.
// Must match the routes flagged `config: { public: true }` on the server.
// Ids are uuids only, so /add, /edit/… and /delete/… pages stay private.
const PUBLIC_PATHS = [
	/^\/$/,
	/^\/login$/,
	/^\/shows(\/(history|performances|spectacles|works|artists|places))?$/,
	/^\/shows\/history\/\d+$/,
	/^\/shows\/(performances|spectacles|artists|places)\/[0-9a-f-]{36}$/,
	/^\/broadcast(\/(history|list|stats))?$/,
	/^\/broadcast\/history\/\d{4}-\d{2}$/,
	/^\/broadcast\/stats\/\d{4}$/,
	/^\/broadcast\/[0-9a-f-]{36}$/,
	/^\/music(\/(history|list|stats))?$/,
	/^\/music\/(history|list)\/\d{4}-\d{2}$/,
	/^\/music\/stats\/\d{4}$/,
	/^\/reading-book(\/(history|list|series|authors))?$/,
	/^\/reading-book\/history\/\d{4}$/,
	/^\/reading-book\/(book|series|authors)\/[0-9a-f-]{36}$/,
	/^\/reading-manga(\/(history|list))?$/,
	/^\/reading-manga\/history\/\d{4}$/,
	/^\/reading-manga\/manga\/[0-9a-f-]{36}$/,
	/^\/game(\/(history|list))?$/,
	/^\/game\/history\/\d{4}$/,
	/^\/game\/details\/[0-9a-f-]{36}$/,
];

export function isPublicPath(pathname: string) {
	return PUBLIC_PATHS.some((path) => path.test(pathname));
}
