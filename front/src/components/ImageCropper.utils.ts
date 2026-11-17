import type { Area } from "react-easy-crop";

// the image as is (blob: of a pasted/picked file, or a CORS-enabled URL)
export async function uncroppedImage(src: string): Promise<File> {
	const blob = await (await fetch(src)).blob();
	if (!blob.type.startsWith("image/")) throw new Error("Pas une image");
	return new File([blob], `image.${blob.type.split("/")[1]}`, { type: blob.type });
}

// draws the selected area on a canvas; a remote image without CORS headers taints it and fails here
export function cropImage(src: string, area: Area): Promise<File> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.crossOrigin = "anonymous";
		image.onerror = reject;
		image.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = area.width;
			canvas.height = area.height;
			canvas
				.getContext("2d")
				?.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
			try {
				canvas.toBlob(
					(blob) =>
						blob
							? resolve(new File([blob], "recadrage.jpg", { type: "image/jpeg" }))
							: reject(new Error("Recadrage impossible")),
					"image/jpeg",
					0.9,
				);
			} catch (error) {
				reject(error);
			}
		};
		image.src = src;
	});
}
