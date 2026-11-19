import type { TrackPoint } from "@personal-tracker/shared/sport";

import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";

const WIDTH = 480;
const HEIGHT = 240;
const PADDING = 20;

// Colors match TrackMap's route/markers in ActivityDetails.tsx for visual consistency
const BACKGROUND_COLOR = "#1e1e1e";
const LINE_COLOR = "#4a9eff";
const START_COLOR = "#4caf50";
const END_COLOR = "#f44336";

// Draws the route's shape only (no basemap): longitude is scaled by cos(latitude) so the
// projection isn't stretched east-west at higher latitudes, then the track is fit to the canvas.
export async function generateThumbnail(points: Pick<TrackPoint, "lat" | "lon">[]): Promise<Buffer | null> {
	if (points.length < 2) return null;

	const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
	const latCorrection = Math.cos((avgLat * Math.PI) / 180);

	const projected = points.map((p) => ({ x: p.lon * latCorrection, y: -p.lat }));

	const xs = projected.map((p) => p.x);
	const ys = projected.map((p) => p.y);
	const minX = Math.min(...xs);
	const maxX = Math.max(...xs);
	const minY = Math.min(...ys);
	const maxY = Math.max(...ys);

	const spanX = maxX - minX || 1;
	const spanY = maxY - minY || 1;
	const availableWidth = WIDTH - PADDING * 2;
	const availableHeight = HEIGHT - PADDING * 2;
	const scale = Math.min(availableWidth / spanX, availableHeight / spanY);

	const offsetX = PADDING + (availableWidth - spanX * scale) / 2;
	const offsetY = PADDING + (availableHeight - spanY * scale) / 2;

	const toCanvas = (p: { x: number; y: number }) => ({
		x: offsetX + (p.x - minX) * scale,
		y: offsetY + (p.y - minY) * scale,
	});

	const canvas = createCanvas(WIDTH, HEIGHT);
	const ctx = canvas.getContext("2d");

	ctx.fillStyle = BACKGROUND_COLOR;
	ctx.fillRect(0, 0, WIDTH, HEIGHT);

	ctx.strokeStyle = LINE_COLOR;
	ctx.lineWidth = 3;
	ctx.lineJoin = "round";
	ctx.lineCap = "round";
	ctx.beginPath();
	projected.forEach((p, i) => {
		const { x, y } = toCanvas(p);
		if (i === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	});
	ctx.stroke();

	const start = toCanvas(projected[0]);
	const end = toCanvas(projected[projected.length - 1]);

	ctx.fillStyle = START_COLOR;
	ctx.beginPath();
	ctx.arc(start.x, start.y, 5, 0, Math.PI * 2);
	ctx.fill();

	ctx.fillStyle = END_COLOR;
	ctx.beginPath();
	ctx.arc(end.x, end.y, 5, 0, Math.PI * 2);
	ctx.fill();

	return sharp(canvas.toBuffer("image/png")).avif({ quality: 80 }).toBuffer();
}
