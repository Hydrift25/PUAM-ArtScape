import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const VERIFY_STATE = { PENDING: 0, ACCEPTED: 1, FAILED_LOCATION: 2, FAILED_IMAGE: 3 };

export default function BottomSheet({
	content,
	onClose,
	onFetchRoute,
	onToggleFavorite,
	navigationMode = false,
	verifyState = null,
	isGuest,
	favoritesLoading = false,
	isFavorited = false,
	locationStatus = "granted",
}) {
	const navigate = useNavigate();
	const [visible, setVisible] = useState(false);
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
						className={`bs-directions-btn--outline${locationStatus !== "granted" ? " btn--location-disabled" : ""}`}
						onClick={() => onFetchRoute(art)}
						disabled={locationStatus !== "granted"}
						aria-label={locationStatus !== "granted" ? "Enable location to get directions" : "Get directions"}
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
							className={`bs-directions-btn${locationStatus !== "granted" ? " btn--location-disabled" : ""}`}
							onClick={() => onFetchRoute(art)}
							disabled={locationStatus !== "granted"}
							aria-label={locationStatus !== "granted" ? "Enable location to get directions" : "Get directions"}
						>
							Get Directions
						</button>
						{locationStatus === "denied" && (
							<p className="bs-loc-denied-note" style={{ marginTop: 8 }}>
								Enable location to use in-app directions.
							</p>
						)}
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
							className={`bs-fav-overlay-btn${isFavorited ? " favorited" : ""}`}
							onClick={() => onToggleFavorite(art.objectid)}
							aria-label={isFavorited ? "Unfavorite" : "Favorite"}
							disabled={favoritesLoading}
							style={favoritesLoading ? { opacity: 0.5 } : undefined}
						>
							{isFavorited ? "❤️" : "🤍"}
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
							className={`bs-directions-btn${locationStatus !== "granted" ? " btn--location-disabled" : ""}`}
							onClick={() => onFetchRoute(art)}
							disabled={locationStatus !== "granted"}
							aria-label={locationStatus !== "granted" ? "Enable location to get directions" : "Get directions"}
						>
							Get Directions
						</button>
						{locationStatus === "denied" && (
							<p className="bs-loc-denied-note" style={{ marginTop: 8 }}>
								Enable location to use in-app directions.
							</p>
						)}
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
						{(() => {
							const isAccepted = verifyState === VERIFY_STATE.ACCEPTED;
							const isPending  = verifyState === VERIFY_STATE.PENDING;
							const label =
								isAccepted ? "✓ Visited" :
								isPending  ? "⏳ Verifying..." :
								verifyState === VERIFY_STATE.FAILED_LOCATION ? "📍 Retry — too far" :
								verifyState === VERIFY_STATE.FAILED_IMAGE    ? "📷 Retry — unclear photo" :
								"📷 Verify Visit";
							const btnClass = `bs-action-btn bs-action-visit${
								isAccepted ? " bs-action-found" :
								isPending  ? " bs-action-pending" :
								(verifyState === VERIFY_STATE.FAILED_LOCATION || verifyState === VERIFY_STATE.FAILED_IMAGE) ? " bs-action-retry" :
								""
							}`;
							return (
								<button
									className={btnClass}
									onClick={() => !isAccepted && !isPending && navigate(`/hunt?objectid=${art.objectid}`)}
									disabled={isAccepted || isPending}
								>
									{label}
								</button>
							);
						})()}
						<button
							className={`bs-action-btn${isFavorited ? " bs-action-unfav" : " bs-action-fav"}`}
							onClick={() => onToggleFavorite(art.objectid)}
							disabled={favoritesLoading}
							style={favoritesLoading ? { opacity: 0.5 } : undefined}
						>
							{isFavorited ? "💔 Unfavorite" : "❤️ Save to Favorites"}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
