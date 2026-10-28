import { TrackPoint } from "@personal-tracker/shared/sport";
import L from "leaflet";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { Sport } from "../types";

function FitBounds({ coords }: { coords: [number, number][] }) {
	const map = useMap();
	useEffect(() => {
		if (coords.length > 0) map.fitBounds(coords, { padding: [24, 24] });
	}, [map, coords]);
	return null;
}

// Registers an imperative update function into the shared ref so the chart
// can move the marker without going through React state at all.
function ActivePointMarker({ updateRef }: { updateRef: React.RefObject<(p: TrackPoint | null) => void> }) {
	const map = useMap();

	useEffect(() => {
		const marker = L.circleMarker([0, 0], {
			radius: 8,
			color: "white",
			fillColor: "#ff6b35",
			fillOpacity: 1,
			weight: 2,
		});
		updateRef.current = (point) => {
			if (point) {
				marker.setLatLng([point.lat, point.lon]);
				if (!map.hasLayer(marker)) marker.addTo(map);
			} else {
				if (map.hasLayer(marker)) marker.remove();
			}
		};
		return () => {
			updateRef.current = () => {};
			marker.remove();
		};
	}, [map, updateRef]);

	return null;
}

export default function TrackMap({
	points,
	updateRef,
	highlightRange,
}: {
	points: TrackPoint[];
	updateRef: React.RefObject<(p: TrackPoint | null) => void>;
	highlightRange: Sport.HighlightRange | null;
}) {
	const coords: [number, number][] = [];
	const suspects: [string, number, number][] = [];
	const highlightCoords: [number, number][] = [];
	for (const p of points) {
		coords.push([p.lat, p.lon]);
		if (p.isSuspect) suspects.push([p.id, p.lat, p.lon]);
		if (highlightRange) {
			const distKm = (p.distanceFromStart ?? 0) / 1000;
			if (distKm >= highlightRange.x1 && distKm <= highlightRange.x2) {
				highlightCoords.push([p.lat, p.lon]);
			}
		}
	}
	const start = coords[0];
	const end = coords[coords.length - 1];

	return (
		<MapContainer
			center={start ?? [0, 0]}
			zoom={13}
			style={{ height: 420, width: "100%", borderRadius: 6 }}
			scrollWheelZoom
		>
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
				url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
			/>
			<FitBounds coords={coords} />
			<Polyline positions={coords} pathOptions={{ color: "#4a9eff", weight: 3 }} />
			{highlightCoords.length > 0 && (
				<Polyline positions={highlightCoords} pathOptions={{ color: "#ff6b35", weight: 6, opacity: 0.9 }} />
			)}
			{start && (
				<CircleMarker
					center={start}
					radius={7}
					pathOptions={{ color: "#2e7d32", fillColor: "#4caf50", fillOpacity: 1 }}
				/>
			)}
			{end && (
				<CircleMarker
					center={end}
					radius={7}
					pathOptions={{ color: "#b71c1c", fillColor: "#f44336", fillOpacity: 1 }}
				/>
			)}
			{suspects.map(([id, lat, lon]) => (
				<CircleMarker
					key={id}
					center={[lat, lon]}
					radius={5}
					pathOptions={{ color: "#e65100", fillColor: "#ff9800", fillOpacity: 0.9 }}
				/>
			))}
			<ActivePointMarker updateRef={updateRef} />
		</MapContainer>
	);
}
