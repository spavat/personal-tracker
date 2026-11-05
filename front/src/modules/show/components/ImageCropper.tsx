import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { cropImage, uncroppedImage } from "./ImageCropper.utils";

export default function ImageCropper({
	src,
	aspect,
	onCancel,
	onConfirm,
}: {
	src: string;
	aspect: number;
	onCancel: () => void;
	onConfirm: (file: File) => void;
}) {
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [area, setArea] = useState<Area | null>(null);
	const [round, setRound] = useState(true);
	const [error, setError] = useState(false);

	async function confirm(withCrop: boolean) {
		if (withCrop && !area) return;
		try {
			onConfirm(withCrop && area ? await cropImage(src, area) : await uncroppedImage(src));
		} catch {
			setError(true);
		}
	}

	return (
		<div className="image-cropper">
			<div className="crop-area">
				<Cropper
					image={src}
					crop={crop}
					zoom={zoom}
					aspect={aspect}
					cropShape={round ? "round" : "rect"}
					onCropChange={setCrop}
					onZoomChange={setZoom}
					onCropComplete={(_, pixels) => setArea(pixels)}
				/>
			</div>
			<div className="crop-controls">
				<label>
					Zoom{" "}
					<input
						type="range"
						min={1}
						max={3}
						step={0.1}
						value={zoom}
						onChange={(e) => setZoom(Number(e.target.value))}
					/>
				</label>
				{aspect === 1 && (
					<label>
						<input type="checkbox" checked={round} onChange={(e) => setRound(e.target.checked)} /> Aperçu
						avatar
					</label>
				)}
			</div>
			{error && <div className="error">Impossible de lire ce lien, télécharger l'image puis l'importer</div>}
			<div className="crop-controls">
				<button type="button" onClick={onCancel}>
					Annuler
				</button>
				<button type="button" onClick={() => confirm(false)}>
					Utiliser sans recadrer
				</button>
				<button type="button" onClick={() => confirm(true)} disabled={!area}>
					<i className="fa-solid fa-check"></i> Valider
				</button>
			</div>
		</div>
	);
}
