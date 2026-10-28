// Pages an anonymous visitor may open; everything else redirects to the home page.
// Must match the routes flagged `config: { public: true }` on the server.
const PUBLIC_PATHS = [/^\/$/, /^\/login$/];

export function isPublicPath(pathname: string) {
	return PUBLIC_PATHS.some((path) => path.test(pathname));
}
