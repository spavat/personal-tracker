import { useEffect, useState } from "react";

import { CropPanelContext, type CropRequest } from "./CropPanel.utils";
import ImageCropper from "./ImageCropper";

// Lays a crop panel to the right of its children (too narrow places like a table row):
// pick an image (paste, file or URL), crop it, then hand the file back to the requester.
export default function CropPanel({ children }: { children: React.ReactNode }) {
	const [request, setRequest] = useState<CropRequest | null>(null);
	const [src, setSrc] = useState<string | null>(null);
	const [url, setUrl] = useState("");

	function changeSrc(next: string | null) {
		if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
		setSrc(next);
	}

	function close() {
		changeSrc(null);
		setUrl("");
		setRequest(null);
	}

	function pickFile(file: File | undefined) {
		if (file?.type.startsWith("image/")) changeSrc(URL.createObjectURL(file));
	}

	// while waiting for an image, a pasted one is taken
	const waiting = !!request && !src;
	useEffect(() => {
		if (!waiting) return;
		function onPaste(e: ClipboardEvent) {
			const image = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
			if (!image) return;
			e.preventDefault();
			setSrc(URL.createObjectURL(image));
		}
		window.addEventListener("paste", onPaste);
		return () => window.removeEventListener("paste", onPaste);
	}, [waiting]);

	return (
		<CropPanelContext
			value={(next) => {
				changeSrc(null);
				setRequest(next);
			}}
		>
			<div className="with-crop-panel">
				<div className="crop-panel-main">{children}</div>
				{request && (
					<aside className="crop-panel">
						{src ? (
							<ImageCropper
								src={src}
								aspect={request.aspect}
								onCancel={close}
								onConfirm={(file) => {
									request.onConfirm(file);
									close();
								}}
							/>
						) : (
							<>
								<div
									className="media-drop-zone"
									onDragOver={(e) => e.preventDefault()}
									onDrop={(e) => {
										e.preventDefault();
										pickFile(e.dataTransfer.files[0]);
									}}
								>
									<i className="fa-solid fa-paste"></i>
									&nbsp;Coller une image (Ctrl+V) ou la glisser-déposer
									<br />
									<label>
										ou parcourir
										<input
											type="file"
											accept="image/*"
											onChange={(e) => {
												pickFile(e.target.files?.[0]);
												e.target.value = "";
											}}
										/>
									</label>
								</div>
								<div className="crop-controls">
									<input
										type="text"
										placeholder="ou https://…"
										autoComplete="off"
										value={url}
										onChange={(e) => setUrl(e.target.value)}
									/>
									<button type="button" disabled={!url.trim()} onClick={() => changeSrc(url.trim())}>
										Charger
									</button>
								</div>
								<div className="crop-controls">
									<button type="button" onClick={close}>
										Annuler
									</button>
								</div>
							</>
						)}
					</aside>
				)}
			</div>
		</CropPanelContext>
	);
}
