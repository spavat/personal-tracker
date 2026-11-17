import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SearchSelectItem<Id> = { id: Id; name: string };

type SearchSelectProps<Id> = {
	items: Array<SearchSelectItem<Id>>;
	value?: Id | null;
	onChange: (id: Id | null, name: string) => void;
	// creates the item typed when none has exactly its name; resolves with the created item, then selected
	onCreate?: (name: string) => Promise<SearchSelectItem<Id>>;
	createLabel?: (name: string) => string;
	emptyLabel?: string;
	clearTitle?: string;
	placeholder?: string;
	"aria-label"?: string;
};

// A text input filtering a list of items, to pick one or create it
export default function SearchSelect<Id>({
	items,
	value,
	onChange,
	onCreate,
	createLabel = (name) => `Créer « ${name} »`,
	emptyLabel = "Aucun résultat",
	clearTitle = "Effacer",
	placeholder,
	"aria-label": ariaLabel,
}: SearchSelectProps<Id>) {
	const [search, setSearch] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
	const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// The input shows the selected item, or what the user is typing while the list is open.
	const selectedName = items.find((item) => item.id === value)?.name ?? "";
	const displayed = isOpen ? search : selectedName;

	// Track the input's viewport position so the results can be portaled to <body>,
	// escaping any scrollable ancestor that would otherwise clip them.
	useLayoutEffect(() => {
		if (!isOpen) {
			return;
		}
		function updatePosition() {
			const rect = inputRef.current?.getBoundingClientRect();
			if (rect) {
				setPosition({ top: rect.bottom, left: rect.left, width: rect.width });
			}
		}
		updatePosition();
		window.addEventListener("scroll", updatePosition, true);
		window.addEventListener("resize", updatePosition);
		return () => {
			window.removeEventListener("scroll", updatePosition, true);
			window.removeEventListener("resize", updatePosition);
		};
	}, [isOpen]);

	const trimmedSearch = search.trim();
	const matches = items.filter((item) => item.name.toLowerCase().includes(trimmedSearch.toLowerCase()));
	const hasExactMatch = matches.some((item) => item.name.toLowerCase() === trimmedSearch.toLowerCase());
	const canCreate = onCreate !== undefined && trimmedSearch !== "" && !hasExactMatch;

	function selectItem(id: Id | null, name: string) {
		onChange(id, name);
		setSearch(name);
		setIsOpen(false);
		inputRef.current?.blur();
	}

	async function createItem() {
		if (!onCreate || !canCreate || isCreating) {
			return;
		}
		setIsCreating(true);
		try {
			const created = await onCreate(trimmedSearch);
			selectItem(created.id, created.name);
		} finally {
			setIsCreating(false);
		}
	}

	return (
		// a div, not a span: `.form-field span:first-of-type` styles the field labels
		<div className="search-select">
			<input
				ref={inputRef}
				type="text"
				autoComplete="off"
				placeholder={placeholder}
				aria-label={ariaLabel}
				value={displayed}
				onFocus={(e) => {
					// start editing from the current name
					setSearch(selectedName);
					// A <dialog> shown via showModal() renders in the browser's top layer, above
					// regular body content regardless of z-index — so portal into it when nested
					// inside one, instead of always targeting <body>.
					setPortalTarget(e.currentTarget.closest("dialog") ?? document.body);
					setIsOpen(true);
				}}
				onBlur={() => setIsOpen(false)}
				onChange={(e) => setSearch(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && isOpen) {
						e.preventDefault();
						e.stopPropagation();
						if (matches.length > 0) {
							selectItem(matches[0].id, matches[0].name);
						} else {
							createItem();
						}
					}
				}}
			/>
			{displayed !== "" && (
				<button
					type="button"
					className="search-select-clear"
					tabIndex={-1}
					onMouseDown={(e) => e.preventDefault()}
					onClick={() => selectItem(null, "")}
					title={clearTitle}
				>
					<i className="fa-regular fa-circle-xmark"></i>
				</button>
			)}
			{isOpen &&
				position &&
				portalTarget &&
				createPortal(
					<div
						className="search-select-results"
						style={{ top: position.top, left: position.left, width: position.width }}
					>
						{canCreate && (
							<div
								className="search-select-item create"
								onMouseDown={(e) => e.preventDefault()}
								onClick={createItem}
							>
								<i className="fa-regular fa-plus"></i> {createLabel(trimmedSearch)}
							</div>
						)}
						{matches.map((item) => (
							<div
								key={String(item.id)}
								className={`search-select-item ${item.id === value ? "selected" : ""}`}
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => selectItem(item.id, item.name)}
							>
								{item.name}
							</div>
						))}
						{matches.length === 0 && !canCreate && <div className="search-select-empty">{emptyLabel}</div>}
					</div>,
					portalTarget,
				)}
		</div>
	);
}
