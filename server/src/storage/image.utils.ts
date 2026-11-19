import sharp from "sharp";

/** Target box of a stored image; each domain declares the sizes of its own pictures. */
export type ImageSize = { width: number; height: number };

export async function fetchImageBuffer(source: string): Promise<Buffer> {
	const dataUriMatch = source.match(/^data:([^;]+);base64,(.*)$/);
	if (dataUriMatch) {
		return Buffer.from(dataUriMatch[2], "base64");
	}

	const response = await fetch(source);
	if (!response.ok) {
		throw new Error(`Impossible de récupérer l'image depuis ${source}`);
	}
	return Buffer.from(await response.arrayBuffer());
}

export function processImage(buffer: Buffer, { width, height }: ImageSize): Promise<Buffer> {
	// fit "outside" + withoutEnlargement: resize down to cover the target box while
	// keeping the aspect ratio, but never upscale an image smaller than the target.
	return sharp(buffer)
		.resize(width, height, { fit: "outside", withoutEnlargement: true })
		.avif({ quality: 80 })
		.toBuffer();
}
