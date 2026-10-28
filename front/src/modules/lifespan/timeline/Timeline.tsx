import { LifespanCategory, LifespanObjectWithStatus } from "@personal-tracker/shared/lifespan";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { formatFullDate } from "../../../utils";
import { allObjectsQuery, categoriesQuery } from "../api";
import { DISPOSE_CAUSE_LABELS, EVENT_TYPE_LABELS } from "../labels";
import {
	computeTimelineSegments,
	dateToPercent,
	compareObjectsForTimeline,
	earliestEventDate,
	isObjectInPeriod,
	periodPresetRange,
	type PeriodPreset,
	type YearBand,
	yearBands,
} from "./timeline-fn";

const SEGMENT_ICON: Record<string, string> = {
	in_use: "fa-play",
	paused: "fa-pause",
	ended: "fa-box-archive",
};

const SEGMENT_LABEL: Record<string, string> = {
	in_use: "En cours d'utilisation",
	paused: "En pause",
	ended: "Terminé, conservé",
};

const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
	current_year: "Année en cours",
	last_2_years: "2 dernières années",
	last_5_years: "5 dernières années",
	last_10_years: "10 dernières années",
};

function YearGridLines({ bands }: { bands: Array<YearBand> }) {
	return (
		<>
			{bands.map(
				(band, index) =>
					band.startPercent > 0 && (
						<div key={index} className="timeline-year-line" style={{ left: `${band.startPercent}%` }} />
					),
			)}
		</>
	);
}

type TimelineRange = {
	start: string;
	end: string;
	today: string;
	bands: Array<YearBand>;
};

type CategoryTree = {
	childrenByParentId: Map<string, Array<LifespanCategory>>;
	objectsByCategoryId: Map<string, Array<LifespanObjectWithStatus>>;
	hasObjects: (categoryId: string) => boolean;
};

function TimelineObjectRow({ object, range }: { object: LifespanObjectWithStatus; range: TimelineRange }) {
	const { start: rangeStart, end: rangeEnd, today, bands } = range;
	const { segments, notStarted, disposedAt } = computeTimelineSegments(object.events, today);
	return (
		<div className="timeline-row">
			<div className="timeline-row-label">{object.name}</div>
			<div className="timeline-track">
				<YearGridLines bands={bands} />
				{notStarted && <span className="timeline-not-started">pas encore utilisé</span>}
				{segments.map((segment, index) => {
					const from = dateToPercent(segment.from, rangeStart, rangeEnd);
					const to = dateToPercent(segment.to, rangeStart, rangeEnd);
					const endLabel = segment.ongoing ? "en cours" : formatFullDate(segment.to);
					return (
						<div
							key={index}
							className={`timeline-segment ${segment.kind}${segment.ongoing ? " ongoing" : ""}${index === 0 ? " first" : ""}`}
							title={`${SEGMENT_LABEL[segment.kind]}\n${formatFullDate(segment.from)} - ${endLabel}`}
							style={{
								left: `${from}%`,
								width: `${Math.max(0.5, to - from)}%`,
							}}
						>
							<i className={`fa-solid ${SEGMENT_ICON[segment.kind]}`}></i>
						</div>
					);
				})}
				{disposedAt && (
					<div
						className="timeline-dispose-marker"
						title={`${EVENT_TYPE_LABELS.dispose}${disposedAt.cause ? ` - ${DISPOSE_CAUSE_LABELS[disposedAt.cause]}` : ""}\n${formatFullDate(disposedAt.date)}`}
						style={{
							left: `${dateToPercent(disposedAt.date, rangeStart, rangeEnd)}%`,
						}}
					>
						<i className="fa-solid fa-xmark"></i>
					</div>
				)}
			</div>
		</div>
	);
}

function TimelineCategory({
	category,
	depth,
	tree,
	range,
}: {
	category: LifespanCategory;
	depth: number;
	tree: CategoryTree;
	range: TimelineRange;
}) {
	const children = (tree.childrenByParentId.get(category.id) ?? []).filter((child) => tree.hasObjects(child.id));
	const Heading = depth === 0 ? "h3" : "h4";
	return (
		<div className="timeline-category">
			<Heading style={{ "--depth": depth } as React.CSSProperties}>
				{/* keeps the applied period, only replaces the category */}
				<Link to="/lifespan/timeline" search={(prev) => ({ ...prev, categoryId: category.id })}>
					{category.name}
				</Link>
			</Heading>
			{tree.objectsByCategoryId.get(category.id)?.map((object) => (
				<TimelineObjectRow key={object.id} object={object} range={range} />
			))}
			{children.map((child) => (
				<TimelineCategory key={child.id} category={child} depth={depth + 1} tree={tree} range={range} />
			))}
		</div>
	);
}

type TimelineProps = { from?: string; to?: string; categoryId?: string };

// Filters are applied from the url (source of truth), inputs are only a draft until "Appliquer"
export default function Timeline({ from, to, categoryId: appliedCategoryId }: TimelineProps) {
	const navigate = useNavigate();
	const location = useLocation();
	const { data: categories } = useSuspenseQuery(categoriesQuery());
	const { data: objects } = useSuspenseQuery(allObjectsQuery());

	const [periodStart, setPeriodStart] = useState(from ?? "");
	const [periodEnd, setPeriodEnd] = useState(to ?? "");
	const [categoryId, setCategoryId] = useState(appliedCategoryId ?? "");
	const appliedPeriod = from && to ? { start: from, end: to } : null;

	function applyPreset(e: React.ChangeEvent<HTMLSelectElement>) {
		const preset = e.target.value as PeriodPreset | "";
		e.target.value = "";
		if (!preset) return;
		const { start, end } = periodPresetRange(preset);
		setPeriodStart(start);
		setPeriodEnd(end);
	}

	function applyPeriod() {
		const hasPeriod = periodStart && periodEnd;
		navigate({
			to: "/lifespan/timeline",
			search: {
				from: hasPeriod ? periodStart : undefined,
				to: hasPeriod ? periodEnd : undefined,
				categoryId: categoryId || undefined,
			},
		});
	}

	function resetFilters() {
		navigate({ to: "/lifespan/timeline", search: {} });
	}

	const today = Temporal.Now.plainDateISO().toString();
	const visibleObjects = appliedPeriod
		? objects.filter((object) => isObjectInPeriod(object, appliedPeriod, today))
		: objects;

	const categoriesById = new Map(categories.map((category) => [category.id, category]));
	const objectsByCategoryId = new Map<string, Array<LifespanObjectWithStatus>>();
	for (const object of visibleObjects.toSorted(compareObjectsForTimeline)) {
		const list = objectsByCategoryId.get(object.categoryId) ?? [];
		list.push(object);
		objectsByCategoryId.set(object.categoryId, list);
	}

	const rangeStart =
		appliedPeriod?.start ??
		earliestEventDate(objects) ??
		Temporal.Now.plainDateISO().subtract({ months: 12 }).toString();
	const rangeEnd = appliedPeriod?.end ?? today;
	const bands = yearBands(rangeStart, rangeEnd);

	// categories whose parent is unknown are displayed at the root
	const childrenByParentId = new Map<string, Array<LifespanCategory>>();
	const rootCategories: Array<LifespanCategory> = [];
	for (const category of categories) {
		if (category.parentId && categoriesById.has(category.parentId)) {
			const list = childrenByParentId.get(category.parentId) ?? [];
			list.push(category);
			childrenByParentId.set(category.parentId, list);
		} else {
			rootCategories.push(category);
		}
	}
	const hasObjects = (categoryId: string): boolean =>
		objectsByCategoryId.has(categoryId) ||
		(childrenByParentId.get(categoryId) ?? []).some((child) => hasObjects(child.id));
	const appliedCategory = appliedCategoryId ? categoriesById.get(appliedCategoryId) : undefined;
	const visibleRootCategories = (appliedCategory ? [appliedCategory] : rootCategories).filter((category) =>
		hasObjects(category.id),
	);

	// select options: each parent followed by its children, sorted by name at each level
	const byName = (a: LifespanCategory, b: LifespanCategory) => a.name.localeCompare(b.name);
	const categoryOptions: Array<{ category: LifespanCategory; depth: number }> = [];
	const addCategoryOptions = (list: Array<LifespanCategory>, depth: number) => {
		for (const category of list.toSorted(byName)) {
			categoryOptions.push({ category, depth });
			addCategoryOptions(childrenByParentId.get(category.id) ?? [], depth + 1);
		}
	};
	addCategoryOptions(rootCategories, 0);
	const tree: CategoryTree = {
		childrenByParentId,
		objectsByCategoryId,
		hasObjects,
	};
	const range: TimelineRange = {
		start: rangeStart,
		end: rangeEnd,
		today,
		bands,
	};

	return (
		<div className="timeline">
			<div className="timeline-toolbar">
				<div className="timeline-legend">
					{(["in_use", "paused", "ended"] as const).map((kind) => (
						<span key={kind} className={`timeline-legend-item ${kind}`}>
							<i className={`fa-solid ${SEGMENT_ICON[kind]}`}></i> {SEGMENT_LABEL[kind]}
						</span>
					))}
					<span className="timeline-legend-item dispose">
						<i className="fa-solid fa-xmark"></i> Sorti (donné, vendu, jeté, perdu…)
					</span>
				</div>

				<div className="timeline-period-filter">
					<select defaultValue="" onChange={applyPreset} aria-label="Raccourcis de période">
						<option value="">Raccourcis…</option>
						{Object.entries(PERIOD_PRESET_LABELS).map(([preset, label]) => (
							<option key={preset} value={preset}>
								{label}
							</option>
						))}
					</select>
					<input
						type="date"
						value={periodStart}
						onChange={(e) => setPeriodStart(e.target.value)}
						aria-label="Début de la période"
					/>
					<span>-</span>
					<input
						type="date"
						value={periodEnd}
						onChange={(e) => setPeriodEnd(e.target.value)}
						aria-label="Fin de la période"
					/>
					<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Catégorie">
						<option value="">Toutes les catégories</option>
						{categoryOptions.map(({ category, depth }) => (
							<option key={category.id} value={category.id}>
								{"\u00A0\u00A0".repeat(depth)}
								{category.name}
							</option>
						))}
					</select>
					<button type="button" onClick={applyPeriod}>
						Appliquer
					</button>
					<button type="button" onClick={resetFilters}>
						Réinitialiser
					</button>
				</div>
			</div>

			{visibleRootCategories.length === 0 && (
				<p>
					{appliedPeriod || appliedCategory
						? "Aucun objet ne correspond aux filtres."
						: "Aucun objet suivi pour l'instant."}
				</p>
			)}

			<div className="timeline-header">
				<div className="timeline-header-label"></div>
				<div className="timeline-header-ticks">
					{bands.map((band, index) => (
						<div
							key={`${band.startPercent}-${band.endPercent}`}
							className={`timeline-year-band${index % 2 === 1 ? " alt" : ""}`}
							style={{
								left: `${band.startPercent}%`,
								width: `${band.endPercent - band.startPercent}%`,
							}}
						>
							{band.label}
						</div>
					))}
				</div>
			</div>

			{visibleRootCategories.map((category) => (
				<TimelineCategory key={category.id} category={category} depth={0} tree={tree} range={range} />
			))}

			<div className="fab-container">
				<button
					type="button"
					className="fab-main"
					aria-label="Ajouter un objet"
					onClick={() =>
						navigate({
							to: "/lifespan/timeline/add",
							search: (prev) => ({ ...prev, returnTo: location.href }),
							replace: true,
							resetScroll: false,
							mask: {
								to: "/lifespan/timeline",
								search: { from, to, categoryId: appliedCategoryId },
							},
						})
					}
				>
					<div className="pulse"></div>
					<div className="heart-line" aria-hidden="true">
						<i className="fa-solid fa-plus"></i>
					</div>
				</button>
			</div>
		</div>
	);
}
