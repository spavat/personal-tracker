import { AsyncLocalStorage } from "node:async_hooks";

// Per-request state reachable from any layer (repositories included) without passing it around.
// Opened and filled by plugins/auth.ts for every request.
const storage = new AsyncLocalStorage<{ isOwner: boolean }>();

export function runInRequestContext(fn: () => void) {
	storage.run({ isOwner: false }, fn);
}

export function setViewerIsOwner(isOwner: boolean) {
	const store = storage.getStore();
	if (store) {
		store.isOwner = isOwner;
	}
}

// Default deny: outside a request context, the viewer is anonymous
export function viewerIsOwner() {
	return storage.getStore()?.isOwner ?? false;
}

// Mongo filter hiding the private documents from anonymous visitors
export function privacyMatch() {
	return viewerIsOwner() ? {} : { private: { $ne: true } };
}
