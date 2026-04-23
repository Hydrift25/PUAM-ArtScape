import { useEffect, useMemo, useRef, useState } from "react";

const MAX_RESULTS = 8;

export default function SearchBar({ artworks = [], onSelect }) {
	const [query, setQuery] = useState("");
	const [focused, setFocused] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);
	const wrapperRef = useRef(null);

	const results = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		const matches = [];
		for (const art of artworks) {
			const title = (art.title || "").toLowerCase();
			const artist = (art.artist || "").toLowerCase();
			if (title.includes(q) || artist.includes(q)) {
				matches.push(art);
				if (matches.length >= MAX_RESULTS) break;
			}
		}
		return matches;
	}, [query, artworks]);

	useEffect(() => {
		setActiveIndex(0);
	}, [query]);

	useEffect(() => {
		function handleClickOutside(e) {
			if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
				setFocused(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	function pick(art) {
		onSelect?.(art);
		setQuery("");
		setFocused(false);
	}

	function handleKeyDown(e) {
		if (!results.length) return;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((i) => (i + 1) % results.length);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((i) => (i - 1 + results.length) % results.length);
		} else if (e.key === "Enter") {
			e.preventDefault();
			pick(results[activeIndex]);
		} else if (e.key === "Escape") {
			setQuery("");
			setFocused(false);
		}
	}

	const showDropdown = focused && query.trim().length > 0;

	return (
		<div className="search-bar" ref={wrapperRef}>
			<div className="search-bar-input-wrap">
				<span className="search-bar-icon" aria-hidden>🔍</span>
				<input
					type="text"
					className="search-bar-input"
					placeholder="Search artworks…"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onFocus={() => setFocused(true)}
					onKeyDown={handleKeyDown}
					aria-label="Search artworks"
				/>
				{query && (
					<button
						type="button"
						className="search-bar-clear"
						onClick={() => setQuery("")}
						aria-label="Clear search"
					>
						✕
					</button>
				)}
			</div>
			{showDropdown && (
				<ul className="search-bar-dropdown" role="listbox">
					{results.length === 0 ? (
						<li className="search-bar-empty">No artworks match</li>
					) : (
						results.map((art, i) => (
							<li
								key={art.objectid}
								role="option"
								aria-selected={i === activeIndex}
								className={`search-bar-result${i === activeIndex ? " search-bar-result--active" : ""}`}
								onMouseEnter={() => setActiveIndex(i)}
								onMouseDown={(e) => {
									e.preventDefault();
									pick(art);
								}}
							>
								<span className="search-bar-result-title">
									{art.title || "Untitled"}
								</span>
								{art.artist && (
									<span className="search-bar-result-artist">
										{art.artist}
									</span>
								)}
							</li>
						))
					)}
				</ul>
			)}
		</div>
	);
}
