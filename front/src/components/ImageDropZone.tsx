import { useEffect, useRef, useState } from "react";

// Takes an image dropped on it, picked through "parcourir" or pasted (Ctrl+V) while it is shown
export default function ImageDropZone({ onImage }: { onImage: (file: File) => void }) {
	const [isDragOver, setIsDragOver] = useState(false);
	// the latest callback, without re-subscribing the paste listener
	const onImageRef = useRef(onImage);
	useEffect(() => {
		onImageRef.current = onImage;
	});

	// only an image is taken: text pastes (in the fields) are left alone
	useEffect(() => {
		function onPaste(e: ClipboardEvent) {
			const image = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
			if (image) {
				e.preventDefault();
				onImageRef.current(image);
			}
		}
		window.addEventListener("paste", onPaste);
		return () => window.removeEventListener("paste", onPaste);
	}, []);

	function take(file: File | undefined) {
		if (file?.type.startsWith("image/")) {
			onImage(file);
		}
	}

	return (
		<div
			className={`image-drop-zone ${isDragOver ? "drag-over" : ""}`}
			onDragOver={(e) => {
				e.preventDefault();
				setIsDragOver(true);
			}}
			onDragLeave={() => setIsDragOver(false)}
			onDrop={(e) => {
				e.preventDefault();
				setIsDragOver(false);
				take(e.dataTransfer.files[0]);
			}}
		>
			<i className="fa-solid fa-file-import"></i>
			&nbsp;Glisser-déposer une image
			<br />
			<label>
				ou parcourir
				<input
					type="file"
					accept="image/*"
					aria-label="Fichier image"
					onChange={(e) => {
						take(e.target.files?.[0]);
						// lets the same file be picked again
						e.target.value = "";
					}}
				/>
			</label>
			<br />
			ou coller une image (Ctrl+V)
		</div>
	);
}
