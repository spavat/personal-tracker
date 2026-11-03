// Pages an anonymous visitor may open; everything else redirects to the home page.
// Must match the routes flagged `config: { public: true }` on the server.
// Ids are digits (show) or uuids (internet) only, so /add, /edit/… and /delete/… pages stay private.
const PUBLIC_PATHS = [
	/^\/$/,
	/^\/login$/,
	/^\/shows(\/(history|performances|spectacles|works|artists|places))?$/,
	/^\/shows\/history\/\d+$/,
	/^\/shows\/(performances|spectacles|artists|places)\/\d+$/,
	/^\/internet(\/(history|list|stats))?$/,
	/^\/internet\/history\/\d{4}-\d{2}$/,
	/^\/internet\/stats\/\d{4}$/,
	/^\/internet\/[0-9a-f-]{36}$/,
	/^\/music(\/(history|list|stats))?$/,
	/^\/music\/(history|list)\/\d{4}-\d{2}$/,
	/^\/music\/stats\/\d{4}$/,
];

export function isPublicPath(pathname: string) {
	return PUBLIC_PATHS.some((path) => path.test(pathname));
}
