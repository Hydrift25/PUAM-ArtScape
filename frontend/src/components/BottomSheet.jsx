import { useState, useEffect, useRef } from "react";

/*
verifyState:
0 = submitted, 1 = accepted,
2 = failed due to location, 3 = failed due to image,
4 = not submitted
*/

const VERIFY_LABELS = {
	0: "Submitted for verification, in review",
	1: "✅ Verified",
	2: "📷 Take another Photo to Verify: please get closer to the artwork!",
	3: "📷 Take another Photo to Verify: please take a clear picture of the artwork!",
	4: "📷 Take Photo to Verify",
};

export default function BottomSheet({
	content,
	onClose,
	onVerify,
	onFetchRoute,
	navigationMode = false,
	verifyState,
	isGuest,
	favoritesLoading = false,
	isFavorited = false,
	locationStatus = "granted",
}) {
	const isFound = verifyState == 1 ? true : false;
	const [visible, setVisible] = useState(false);
	const [favorited, setFavorited] = useState(isFavorited);

	// Sync if the sheet is open while favoritesLoading resolves
	useEffect(() => {
		setFavorited(isFavorited);
	}, [isFavorited]);
	const sheetRef = useRef(null);
	const touchStartY = useRef(null);
	const touchCurrentY = useRef(null);

	// Slide up on mount (and on remount when key changes)
	useEffect(() => {
		const frame = requestAnimationFrame(() => setVisible(true));
		return () => cancelAnimationFrame(frame);
	}, []);

	function handleClose() {
		setVisible(false);
		setTimeout(() => onClose(), 300);
	}

	// Swipe-to-dismiss touch handlers
	function handleTouchStart(e) {
		touchStartY.current = e.touches[0].clientY;
		touchCurrentY.current = e.touches[0].clientY;
	}

	function handleTouchMove(e) {
		if (touchStartY.current === null) return;
		const deltaY = e.touches[0].clientY - touchStartY.current;
		touchCurrentY.current = e.touches[0].clientY;
		if (deltaY > 0 && sheetRef.current) {
			// Preserve the desktop translateX(-50%) alongside the drag offset
			const isDesktop = window.innerWidth > 600;
			sheetRef.current.style.transform = isDesktop
				? `translateX(-50%) translateY(${deltaY}px)`
				: `translateY(${deltaY}px)`;
			sheetRef.current.style.transition = "none";
		}
	}

	function handleTouchEnd() {
		if (touchStartY.current === null) return;
		const deltaY = touchCurrentY.current - touchStartY.current;
		touchStartY.current = null;
		touchCurrentY.current = null;

		if (sheetRef.current) {
			// Restore CSS transition so snap-back or slide-down is animated
			sheetRef.current.style.transition = "";
			sheetRef.current.style.transform = "";
		}

		if (deltaY > 60) {
			handleClose();
		}
		// else: clearing inline transform + visible=true → CSS snaps back to show position
	}

	if (!content) return null;

	const { art, type } = content;
	const thumbnail = art.image_url
		? `${art.image_url}/full/600,/0/default.jpg`
		: null;

	if (navigationMode) {
		return (
			<div ref={sheetRef} className="bottom-sheet show bs-nav-mini">
				<div className="bs-nav-mini-content">
					<span className="bs-nav-mini-title">{art.title || "Artwork"}</span>
					<span className="bs-nav-badge">Navigating</span>
				</div>
			</div>
		);
	}

	async function toggleFavorite() {
		try {
			const res = await fetch("/api/artworks/favorite", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ objectid: art.objectid }),
			});
			if (res.ok) {
				const data = await res.json();
				setFavorited(data.favorited);
			}
		} catch (err) {
			console.error("Failed to update favorite:", err);
			alert("Something went wrong. Please try again.");
		}
	}

	return (
		<div
			ref={sheetRef}
			className={`bottom-sheet${visible ? " show" : ""}`}
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
		>
			{/* Sticky header: pill centred, X pinned to top-right */}
			<div className="bs-header">
				<div className="bs-drag-handle" />
				<button
					className="bs-close-btn"
					onClick={handleClose}
					aria-label="Close"
				>
					✕
				</button>
			</div>

			{type === "succinct" ? (
				<div className="bs-succinct">
					<h4 className="bs-succinct-title">
						{art.title || "Unknown Artwork"}
					</h4>
					<p className="bs-succinct-hint">
						📍 Walk closer to reveal details.
					</p>
					<button
						className="bs-directions-btn--outline"
						onClick={() => onFetchRoute(art)}
						disabled={locationStatus !== "granted"}
					>
						Get Directions
					</button>
					{locationStatus !== "granted" && (
						<p className="bs-loc-denied-note">
							Enable location to use in-app directions.
						</p>
					)}
				</div>
			) : isGuest ? (
				/* ── GUEST detailed sheet ── */
				<div className="bs-sheet-content">
					{/* Guest banner */}
					<div className="bs-guest-banner">
						<div className="bs-guest-banner-left">
							<span className="bs-guest-lock">🔒</span>
							<div>
								<div className="bs-guest-banner-title">
									Viewing as Guest
								</div>
								<div className="bs-guest-banner-text">
									Sign in to bookmark artworks, track visits, and
									participate in scavenger hunts!
								</div>
							</div>
						</div>
						<a href="/api/auth/login" className="bs-guest-signin-btn">
							Sign In
						</a>
					</div>

					{/* Artwork image */}
					{thumbnail && (
						<img
							src={thumbnail}
							alt={art.title}
							className="bs-image"
						/>
					)}

					{/* Content card */}
					<div className="bs-card">
						<h2 className="bs-title">{art.title || "Untitled"}</h2>
						{art.artist && (
							<p className="bs-artist">{art.artist}</p>
						)}
						<div className="bs-tag-row">
							{art.date_range && (
								<span className="bs-tag">{art.date_range}</span>
							)}
							{art.medium && (
								<span className="bs-tag">{art.medium}</span>
							)}
						</div>
					</div>

					{/* Location card */}
					<div className="bs-card">
						<div className="bs-card-heading">
							<span className="bs-card-icon">📍</span>
							<span>Location</span>
						</div>
						<p className="bs-location-text">
							{art.location || "Princeton University Campus"}
						</p>
						<button
							className="bs-directions-btn"
							onClick={() => onFetchRoute(art)}
						>
							Get Directions
						</button>
					</div>

					{/* About card */}
					{art.description && (
						<div className="bs-card">
							<div className="bs-card-heading">
								<span className="bs-card-icon">🖼️</span>
								<span>About This Work</span>
							</div>
							<div
								className="bs-description"
								dangerouslySetInnerHTML={{
									__html: art.description,
								}}
							/>
						</div>
					)}

					{/* CTA card */}
					<div className="bs-cta-card">
						<p className="bs-cta-title">Ready to Visit?</p>
						<p className="bs-cta-subtitle">
							Sign in to take photos at artworks, earn 10 points per verified find, and compete on the leaderboard.
						</p>
						<a href="/api/auth/login" className="bs-cta-btn">
							🔒 Sign In to Start
						</a>
					</div>
				</div>
			) : (
				/* ── AUTH detailed sheet ── */
				<div className="bs-sheet-content">
					{/* Image with favorite overlay */}
					<div className="bs-image-wrap">
						{thumbnail && (
							<img
								src={thumbnail}
								alt={art.title}
								className="bs-image"
							/>
						)}
						<button
							className={`bs-fav-overlay-btn${favorited ? " favorited" : ""}`}
							onClick={toggleFavorite}
							aria-label={favorited ? "Unfavorite" : "Favorite"}
							disabled={favoritesLoading}
							style={favoritesLoading ? { opacity: 0.5 } : undefined}
						>
							{favorited ? "❤️" : "🤍"}
						</button>
					</div>

					{/* Content card */}
					<div className="bs-card">
						<h2 className="bs-title">{art.title || "Untitled"}</h2>
						{art.artist && (
							<p className="bs-artist">{art.artist}</p>
						)}
						<div className="bs-tag-row">
							{art.date_range && (
								<span className="bs-tag">{art.date_range}</span>
							)}
							{art.medium && (
								<span className="bs-tag">{art.medium}</span>
							)}
						</div>
					</div>

					{/* Location card */}
					<div className="bs-card">
						<div className="bs-card-heading">
							<span className="bs-card-icon">📍</span>
							<span>Location</span>
						</div>
						<p className="bs-location-text">
							{art.location || "Princeton University Campus"}
						</p>
						<button
							className="bs-directions-btn"
							onClick={() => onFetchRoute(art)}
						>
							Get Directions
						</button>
					</div>

					{/* About card */}
					{art.description && (
						<div className="bs-card">
							<div className="bs-card-heading">
								<span className="bs-card-icon">🖼️</span>
								<span>About This Work</span>
							</div>
							<div
								className="bs-description"
								dangerouslySetInnerHTML={{
									__html: art.description,
								}}
							/>
						</div>
					)}

					{/* Action buttons */}
					<div className="bs-actions">
						<button
							className={`bs-action-btn bs-action-visit${isFound ? " bs-action-found" : ""}`}
							onClick={() =>
								!isFound && locationStatus !== "denied" && onVerify && onVerify(art)
							}
							disabled={isFound || favoritesLoading || locationStatus === "denied"}
							style={favoritesLoading ? { opacity: 0.5 } : undefined}
						>
							{VERIFY_LABELS[verifyState] ?? "Unknown"}
						</button>
						{!isFound && locationStatus === "denied" && (
							<p className="bs-loc-denied-note">
								Enable location to confirm you&apos;re near this artwork before verifying.
							</p>
						)}
						<button
							className={`bs-action-btn${favorited ? " bs-action-unfav" : " bs-action-fav"}`}
							onClick={toggleFavorite}
							disabled={favoritesLoading}
							style={favoritesLoading ? { opacity: 0.5 } : undefined}
						>
							{favorited ? "💔 Unfavorite" : "❤️ Save to Favorites"}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
