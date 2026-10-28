import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { useSearch } from "../hooks/use-search";
import Modal from "./modal";

type SearchProps<T> = {
	isOpen: boolean;
	onClose: () => void;
	queryKey: string[];
	queryFn: (search: string) => Promise<Array<T>>;
	renderItem: (item: T, selected: boolean, clickFn: (id: T) => void) => React.ReactNode;
	linkItem: (item: T) => string | null;
	clickItem?: (item: T) => void;
};

export default function SearchModal<T>({
	isOpen,
	onClose,
	queryKey,
	queryFn,
	renderItem,
	linkItem,
	clickItem,
}: SearchProps<T>) {
	const navigate = useNavigate();

	const focusInputRef = useRef<HTMLInputElement>(null);
	const [index, setIndex] = useState(0);
	const [nbResults, setNbResults] = useState(0);
	const [search, setSearch] = useState<string>("");

	const { data } = useSearch<T>({
		queryKey,
		queryFn,
		search,
	});

	// If results changes, reset index (selected result)
	if ((data?.length ?? 0) !== nbResults) {
		setNbResults(data?.length ?? 0);
		setIndex(0);
	}

	useEffect(() => {
		if (isOpen && focusInputRef.current) {
			const id = setTimeout(() => {
				focusInputRef.current!.focus();
			}, 0);
			return () => clearTimeout(id);
		}
	}, [isOpen]);

	function navigateResults(direction: "up" | "down") {
		if (!isOpen) {
			return;
		}
		const nbResults = data?.length ?? 0;
		if (nbResults === 0) {
			return; // no result
		}
		let newIndex = direction === "up" ? index - 1 : index + 1;
		if (newIndex < 0) {
			newIndex = nbResults - 1;
		}
		if (newIndex === nbResults) {
			newIndex = 0;
		}
		setIndex(newIndex);
	}

	useHotkeys("up", () => navigateResults("up"), { enableOnFormTags: true });
	useHotkeys("down", () => navigateResults("down"), { enableOnFormTags: true });
	useHotkeys(
		"enter",
		(e) => {
			if (data?.[index]) {
				e.preventDefault(); // If focus was on menu link, it can prevent the navigation to the result
				navigateTo(data?.[index]);
			}
		},
		{ enableOnFormTags: true },
	);

	function closeModal() {
		setSearch("");
		setIndex(0);
		onClose();
	}

	function navigateTo(item: T) {
		if (clickItem) {
			clickItem(item);
			closeModal();
			return;
		}
		const link = linkItem(item);
		if (!link) {
			return;
		}
		navigate({ to: link });
		closeModal();
	}
	function clickProgram(item: T) {
		navigateTo(item);
	}

	return (
		<Modal className="search dialog-medium" isOpen={isOpen} onClose={closeModal} hasCloseBtn={false}>
			<div className="input">
				<label htmlFor="search" aria-label="Recherche">
					<i className="fa-solid fa-magnifying-glass"></i>
					<input
						id="search"
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						ref={focusInputRef}
						autoComplete="off"
						placeholder="Recherche"
					/>
				</label>

				<a onClick={closeModal}>
					<i className="fa-solid fa-close"></i>
				</a>
			</div>

			<div className="results">
				{(data ?? []).map((program, i) => renderItem(program, index === i, clickProgram))}
			</div>

			<div className="footer">
				[<i className="fa-solid fa-arrow-up"></i>] [<i className="fa-solid fa-arrow-down"></i>] pour naviguer,
				[ENTREE] pour ouvrir, [ECHAP] pour fermer
			</div>
		</Modal>
	);
}
