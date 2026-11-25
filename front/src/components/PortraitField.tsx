import { useEffect, useRef, useState } from "react";

import { API_BASE_URL } from "../config";
import ImageCropper from "./ImageCropper";
import ImageDropZone from "./ImageDropZone";

function readFile(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => resolve(e.target?.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

// the server gives a path (/images/entity/:id), a new portrait is a URL or a data URI
function pictureSrc(picture: string) {
	return picture.startsWith("/") ? `${API_BASE_URL}${picture}` : picture;
}

type PortraitFieldProps = {
	// the server's URL (unchanged), an image URL or a data URI (new), empty (no portrait)
	value: string;
	onChange: (value: string) => void;
	// the URL input, registered by the form
	urlInput: React.ReactNode;
	// true while an image is being cropped: the form waits for it
	onCroppingChange?: (cropping: boolean) => void;
};

// An entity's portrait: dropped, picked or pasted image, or a URL, cropped square
export default function PortraitField({ value, onChange, urlInput, onCroppingChange }: PortraitFieldProps) {
	// image being cropped: blob: of a picked or pasted file, or the URL typed
	const [cropSrc, setCropSrc] = useState<string | null>(null);
	// a picked file still being cropped when the form closes: its blob: URL is released
	const cropSrcRef = useRef<string | null>(null);
	useEffect(
		() => () => {
			if (cropSrcRef.current?.startsWith("blob:")) URL.revokeObjectURL(cropSrcRef.current);
		},
		[],
	);

	function changeCropSrc(src: string | null) {
		if (cropSrcRef.current?.startsWith("blob:")) URL.revokeObjectURL(cropSrcRef.current);
		cropSrcRef.current = src;
		setCropSrc(src);
		onCroppingChange?.(src !== null);
	}
	const openCropper = (src: string) => changeCropSrc(src);
	const closeCropper = () => changeCropSrc(null);

	const isUrl = /^https?:\/\//.test(value.trim());

	if (cropSrc) {
		return (
			<ImageCropper
				src={cropSrc}
				aspect={1}
				onCancel={closeCropper}
				onConfirm={async (file) => {
					onChange(await readFile(file));
					closeCropper();
				}}
			/>
		);
	}

	return (
		<div className="form-grid">
			<div className="form-field full-width">
				{/* the current portrait, left of the zone that replaces it */}
				<div className="portrait-input">
					{value && <img src={pictureSrc(value)} alt="Portrait" className="portrait-preview" />}
					{/* a dropped, picked or pasted image goes straight to the cropper */}
					<ImageDropZone onImage={(file) => openCropper(URL.createObjectURL(file))} />
				</div>
				<div className="full-fields-row">
					{urlInput}
					{isUrl && (
						<button type="button" onClick={() => openCropper(value.trim())}>
							Recadrer
						</button>
					)}
					{value && (
						<button type="button" onClick={() => onChange("")} title="Retirer le portrait">
							<i className="fa-regular fa-trash-can"></i>
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
