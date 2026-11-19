// Portraits are stored as personal-tracker/entity/<entityId>.<version>.avif and served through the images
// proxy; the version changes with each upload, so a replaced portrait isn't served from the cache.
export const PORTRAIT_URL_PREFIX = "/images/entity/";

export function portraitKey(entityId: string, version: string) {
	return `personal-tracker/entity/${entityId}.${version}.avif`;
}

export function portraitUrl(entityId: string, key: string | null) {
	return key ? `${PORTRAIT_URL_PREFIX}${entityId}?v=${key.split(".").at(-2)}` : null;
}

// API shape of an entity: its portrait as a URL
export function toEntityView<T extends { id: string; pictureKey: string | null }>({ pictureKey, ...entity }: T) {
	return { ...entity, picture: portraitUrl(entity.id, pictureKey) };
}
