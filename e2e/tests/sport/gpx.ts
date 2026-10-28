// A run going north: 61 points, 30 m and 10 s apart (3 m/s), climbing 0.5 m each.
// Starts on 2026-10-25 at 08:00 UTC, the first day of winter time: 09:00 in Paris.
export function buildGpx() {
	const start = Date.parse("2026-10-25T08:00:00Z");
	const points = Array.from({ length: 61 }, (_, i) => {
		const lat = (45 + (i * 30) / 111_195).toFixed(7);
		const time = new Date(start + i * 10_000).toISOString();
		return `<trkpt lat="${lat}" lon="5.7000000"><ele>${200 + i * 0.5}</ele><time>${time}</time></trkpt>`;
	});
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<gpx version="1.1" creator="e2e" xmlns="http://www.topografix.com/GPX/1/1">',
		"<trk><name>Course GPX</name><trkseg>",
		...points,
		"</trkseg></trk>",
		"</gpx>",
	].join("\n");
}
