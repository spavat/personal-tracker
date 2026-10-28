import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { artistsQuery, saveArtist } from "./api";

type ArtistSearchSelectProps = {
	value?: number;
	onChange: (artistId: number, artistName: string) => void;
	placeholder?: string;
};

export default function ArtistSearchSelect({ value, onChange, placeholder }: ArtistSearchSelectProps) {
	const [search, setSearch] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
	const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const queryClient = useQueryClient();
	const { data = [] } = useQuery(artistsQuery());

	const createMutation = useMutation({
		mutationFn: saveArtist,
		onSuccess: async (_result, variables) => {
			await queryClient.invalidateQueries({ queryKey: ["shows", "artists"] });
			// the list is displayed here, so invalidateQueries has just refetched it: reuse it as is
			const artists = await queryClient.query({ ...artistsQuery(), staleTime: "static" });
			const created = artists.find((artist) => artist.name === variables.name);
			if (created) {
				selectArtist(created.id, created.name);
			}
		},
	});

	// The input shows the selected artist, or what the user is typing while the list is open.
	const selectedName = data.find((artist) => artist.id === value)?.name ?? "";
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

	const matches = data.filter((artist) => artist.name.toLowerCase().includes(search.trim().toLowerCase()));
	const trimmedSearch = search.trim();
	const hasExactMatch = matches.some((artist) => artist.name.toLowerCase() === trimmedSearch.toLowerCase());
	const canCreate = trimmedSearch !== "" && !hasExactMatch;

	function selectArtist(artistId: number, artistName: string) {
		onChange(artistId, artistName);
		setSearch(artistName);
		setIsOpen(false);
		inputRef.current?.blur();
	}

	function clearArtist() {
		onChange(0, "");
		setSearch("");
		setIsOpen(false);
		inputRef.current?.blur();
	}

	function createArtist() {
		if (!canCreate || createMutation.isPending) {
			return;
		}
		createMutation.mutate({ name: trimmedSearch });
	}

	return (
		<span className="artist-search-select">
			<input
				ref={inputRef}
				type="text"
				autoComplete="off"
				placeholder={placeholder}
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
							selectArtist(matches[0].id, matches[0].name);
						} else {
							createArtist();
						}
					}
				}}
			/>
			{displayed !== "" && (
				<button
					type="button"
					className="artist-search-select-clear"
					tabIndex={-1}
					onMouseDown={(e) => e.preventDefault()}
					onClick={clearArtist}
					title="Effacer l'artiste"
				>
					<i className="fa-regular fa-circle-xmark"></i>
				</button>
			)}
			{isOpen &&
				position &&
				portalTarget &&
				createPortal(
					<div
						className="artist-search-select-results"
						style={{ top: position.top, left: position.left, width: position.width }}
					>
						{canCreate && (
							<div
								className="artist-search-select-item create"
								onMouseDown={(e) => e.preventDefault()}
								onClick={createArtist}
							>
								<i className="fa-regular fa-plus"></i> Créer l'artiste « {trimmedSearch} »
							</div>
						)}
						{matches.map((artist) => (
							<div
								key={artist.id}
								className={`artist-search-select-item ${artist.id === value ? "selected" : ""}`}
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => selectArtist(artist.id, artist.name)}
							>
								{artist.name}
							</div>
						))}
						{matches.length === 0 && !canCreate && (
							<div className="artist-search-select-empty">Aucun artiste</div>
						)}
					</div>,
					portalTarget,
				)}
		</span>
	);
}
