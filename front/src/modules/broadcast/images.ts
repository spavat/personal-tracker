import { API_BASE_URL } from "../../config";

// An image file picked in a form, as a data URI (the server stores it)
export function readImageFile(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => resolve(e.target?.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

// A stored image is served by the API (/images/…); an outside URL or a data URI as is
export function resolveImagePreviewSrc(value?: string) {
	if (!value) return undefined;
	return value.startsWith("/") ? `${API_BASE_URL}${value}` : value;
}
