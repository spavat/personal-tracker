import type { DisplayType } from "../hooks/use-display";

export default function DisplaySelector({
	value,
	onChange,
}: {
	value: DisplayType;
	onChange: (next: DisplayType) => void;
}) {
	return (
		<span className="right">
			<label>
				Affichage :{" "}
				<select defaultValue={value} onChange={(e) => onChange(e.target.value as DisplayType)}>
					<option value="list">Liste</option>
					<option value="card">Carte</option>
				</select>
			</label>
		</span>
	);
}
