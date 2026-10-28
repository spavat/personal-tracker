import useLocalStorage from "use-local-storage";

// Single access point to localStorage: the hook for components, a plain read for route loaders.
// Both use the JSON format of use-local-storage, so a loader reads what the hook wrote.

export function useStoredValue<T>(key: string, defaultValue: T) {
	return useLocalStorage<T>(key, defaultValue);
}

export function readStoredValue<T>(key: string, defaultValue: T): T {
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : defaultValue;
	} catch {
		return defaultValue;
	}
}
