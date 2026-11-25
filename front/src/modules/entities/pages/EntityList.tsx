import type { EntityKind } from "@personal-tracker/shared/entity";

import { Link } from "@tanstack/react-router";

import DisplaySelector from "../../../components/DisplaySelector";
import PageTitle from "../../../components/PageTitle";
import { PendingContent } from "../../../components/PendingContent";
import VirtualGrid from "../../../components/VirtualGrid";
import VirtualTable from "../../../components/VirtualTable";
import { useStoredValue } from "../../../hooks/stored-value";
import { useDisplay } from "../../../hooks/use-display";
import { useSortTable } from "../../../hooks/use-sort-table";
import { entityDirectorySort } from "../api";
import CardEntity from "../components/CardEntity";
import { KIND_ICONS, KIND_LABELS, MODULE_NAME } from "../constants";
import { ROLE_FILTER_GROUPS } from "../utils";

// Every entity (people, groups, organizations) with what each module credits it for
export default function EntityList() {
	const { query, headers, isPending } = useSortTable({
		...entityDirectorySort,
		columnsList: [
			{ name: "", isSortable: false, className: "cell-index" },
			{ name: "Nom", colName: "name", isSortable: true, className: "cell-text" },
			{ name: "Livres", colName: "books", isSortable: true, className: "cell-number col-count" },
			{ name: "Spectacles", colName: "spectacles", isSortable: true, className: "cell-number col-count" },
			{
				name: "Représentations",
				colName: "performances",
				isSortable: true,
				className: "cell-number col-count",
			},
			{ name: "Émissions", colName: "programs", isSortable: true, className: "cell-number col-count" },
			{ name: "Épisodes", colName: "episodes", isSortable: true, className: "cell-number col-count" },
		],
	});

	const [display, changeDisplay] = useDisplay("entity_directory_display", "card");
	// "": every kind
	const [kind, setKind] = useStoredValue<EntityKind | "">("entity_directory_kind", "");
	// "": every role
	const [role, setRole] = useStoredValue("entity_directory_role", "");
	const roleTest = ROLE_FILTER_GROUPS.flatMap(({ roles }) => roles).find(({ value }) => value === role)?.test;
	const entities = query.data.filter((entity) => (!kind || entity.kind === kind) && (!roleTest || roleTest(entity)));

	return (
		<>
			<PageTitle title={MODULE_NAME} />
			<h2>
				{MODULE_NAME}
				<DisplaySelector value={display} onChange={changeDisplay} />
				{/* next to the display selector, which takes the free space on its left */}
				<span>
					<label>
						Type :{" "}
						<select value={kind} onChange={(e) => setKind(e.target.value as EntityKind | "")}>
							<option value="">Tous</option>
							{Object.entries(KIND_LABELS).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
					</label>{" "}
					<label>
						Rôle :{" "}
						<select value={role} onChange={(e) => setRole(e.target.value)}>
							<option value="">Tous</option>
							{ROLE_FILTER_GROUPS.map((group) => (
								<optgroup key={group.label} label={group.label}>
									{group.roles.map(({ value, label }) => (
										<option key={value} value={value}>
											{label}
										</option>
									))}
								</optgroup>
							))}
						</select>
					</label>
				</span>
			</h2>
			<PendingContent isPending={isPending}>
				{display === "list" ? (
					<VirtualTable
						items={entities}
						headers={headers}
						className="list entities alternate responsive"
						getKey={(entity) => entity.id}
						renderCells={(entity, index) => (
							<>
								<td className="cell-index">{index + 1}</td>
								<td className="cell-text">
									<i
										className={`fa-solid ${KIND_ICONS[entity.kind]} fa-fw`}
										title={KIND_LABELS[entity.kind]}
										aria-label={KIND_LABELS[entity.kind]}
									></i>{" "}
									<b>
										<Link to="/entities/$entityId" params={{ entityId: entity.id }}>
											{entity.name}
										</Link>
									</b>
								</td>
								<td className="cell-number" data-label="Livres">
									{entity.book.books}
								</td>
								<td className="cell-number" data-label="Spectacles">
									{entity.show.spectacles}
								</td>
								<td className="cell-number" data-label="Représentations">
									{entity.show.performances}
								</td>
								<td className="cell-number" data-label="Émissions">
									{entity.program.programs}
								</td>
								<td className="cell-number" data-label="Épisodes">
									{entity.episode.episodes}
								</td>
							</>
						)}
					/>
				) : (
					<VirtualGrid
						items={entities}
						className="grid entities"
						rowHeight={150}
						renderItem={(entity) => <CardEntity key={entity.id} entity={entity} />}
					/>
				)}
			</PendingContent>
		</>
	);
}
