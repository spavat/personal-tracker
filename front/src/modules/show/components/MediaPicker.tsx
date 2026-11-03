import type { Media } from "@personal-tracker/shared/show";

import { mediaSrc } from "../utils";

// pick one image among a list of media, or none
export default function MediaPicker({
	media,
	value,
	onChange,
	emptyLabel,
}: {
	media: Array<Media>;
	value: string | null | undefined;
	onChange: (mediaId: string | null) => void;
	emptyLabel?: string;
}) {
	const images = media.filter((item) => item.contentType.startsWith("image/"));
	if (images.length === 0) {
		return null;
	}

	return (
		<div className="media-picker">
			<button type="button" className={value ? "" : "selected"} onClick={() => onChange(null)}>
				{emptyLabel ?? (
					<div className="no-picture">
						<i className="fa-regular fa-hourglass"></i>
					</div>
				)}
			</button>
			{images.map((item) => (
				<button
					key={item.id}
					type="button"
					className={value === item.id ? "selected" : ""}
					title={item.label}
					onClick={() => onChange(item.id)}
				>
					<img src={mediaSrc(item.url)} alt={item.label} loading="lazy" />
				</button>
			))}
		</div>
	);
}
