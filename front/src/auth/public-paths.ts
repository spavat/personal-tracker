// Pages an anonymous visitor may open; everything else redirects to the home page.
// Must match the routes flagged `config: { public: true }` on the server.
// Ids are digits only, so /add, /edit/… and /delete/… pages stay private.
const PUBLIC_PATHS = [
	/^\/$/,
	/^\/login$/,
	/^\/shows(\/(history|performances|spectacles|works|artists|places))?$/,
	/^\/shows\/history\/\d+$/,
	/^\/shows\/(performances|spectacles|artists|places)\/\d+$/,
];

export function isPublicPath(pathname: string) {
	return PUBLIC_PATHS.some((path) => path.test(pathname));
}
