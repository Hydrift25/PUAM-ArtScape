import { useEffect, useRef, useState } from "react";

const POPOVER_WIDTH = 220;

function getInitials(name) {
	if (!name) return "?";
	return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function ExitIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
		</svg>
	);
}

export default function ProfileDropdown({ user, onLogout }) {
	const [isOpen, setIsOpen] = useState(false);
	const [showAbout, setShowAbout] = useState(false);
	const [showHelp, setShowHelp] = useState(false);
	const containerRef = useRef(null);
	const triggerRef = useRef(null);
	const popoverRef = useRef(null);
	// Position stored in ref — no re-render needed on open; resize uses direct DOM update
	const posRef = useRef({ top: 0, right: 0 });

	const initials = getInitials(user?.display_name);

	function computePosition() {
		if (!triggerRef.current) return;
		const rect = triggerRef.current.getBoundingClientRect();
		const top = rect.bottom + 8;
		const rawRight = window.innerWidth - rect.right;
		// Clamp: if popover left edge would be within 8px of screen edge, anchor to left instead
		const clamp = window.innerWidth - rawRight - POPOVER_WIDTH < 8;
		posRef.current = clamp ? { top, left: 8 } : { top, right: rawRight };
	}

	function handleTriggerClick() {
		if (isOpen) {
			setIsOpen(false);
			return;
		}
		computePosition();
		setIsOpen(true);
	}

	useEffect(() => {
		if (!isOpen) return;

		function handleMouseDown(e) {
			if (containerRef.current && !containerRef.current.contains(e.target)) {
				setIsOpen(false);
			}
		}

		function handleKeyDown(e) {
			if (e.key === "Escape") setIsOpen(false);
		}

		function handleResize() {
			if (!triggerRef.current || !popoverRef.current) return;
			computePosition();
			const pos = posRef.current;
			popoverRef.current.style.top = `${pos.top}px`;
			if (pos.left !== undefined) {
				popoverRef.current.style.left = `${pos.left}px`;
				popoverRef.current.style.right = "auto";
			} else {
				popoverRef.current.style.right = `${pos.right}px`;
				popoverRef.current.style.left = "auto";
			}
		}

		document.addEventListener("mousedown", handleMouseDown);
		document.addEventListener("keydown", handleKeyDown);
		window.addEventListener("resize", handleResize);

		return () => {
			document.removeEventListener("mousedown", handleMouseDown);
			document.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("resize", handleResize);
		};
	}, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

	const pos = posRef.current;
	const popoverStyle = {
		top: `${pos.top}px`,
		...(pos.left !== undefined
			? { left: `${pos.left}px` }
			: { right: `${pos.right}px` }),
	};

	return (
		<div ref={containerRef} className="profile-dropdown">
			<button
				ref={triggerRef}
				className="profile-dropdown-trigger"
				onClick={handleTriggerClick}
				aria-label="Open account menu"
				aria-expanded={isOpen}
				aria-haspopup="menu"
			>
				{/* Reuses existing .navbar-avatar circle for visual continuity */}
				<div className="navbar-avatar">
					{user?.avatar_url ? (
						<img
							src={user.avatar_url}
							alt={initials}
							className="navbar-avatar-img"
						/>
					) : (
						<span>{initials}</span>
					)}
				</div>
			</button>

			{isOpen && (
				<div
					ref={popoverRef}
					className="profile-dropdown-popover"
					style={popoverStyle}
					role="menu"
				>
					{/* User info row */}
					<div className="profile-dropdown-user-row">
						<div className="profile-dropdown-avatar">
							{user?.avatar_url ? (
								<img src={user.avatar_url} alt={initials} />
							) : (
								<span>{initials}</span>
							)}
						</div>
						<div className="profile-dropdown-user-info">
							<span className="profile-dropdown-name">
								{user?.display_name || "User"}
							</span>
							<span className="profile-dropdown-email">
								{user?.email || ""}
							</span>
						</div>
					</div>

					<hr className="profile-dropdown-divider" />

					<button
						className="profile-dropdown-menu-btn"
						onClick={() => { setIsOpen(false); setShowAbout(true); }}
						role="menuitem"
					>
						<span className="profile-dropdown-menu-icon">ℹ</span>
						About
					</button>
					<button
						className="profile-dropdown-menu-btn"
						onClick={() => { setIsOpen(false); setShowHelp(true); }}
						role="menuitem"
					>
						<span className="profile-dropdown-menu-icon">?</span>
						Help
					</button>

					<hr className="profile-dropdown-divider" />

					{/* Sign out — bottom of menu, destructive action */}
					<button
						className="profile-dropdown-signout-btn"
						onClick={() => { setIsOpen(false); onLogout(); }}
						role="menuitem"
					>
						<ExitIcon />
						Sign Out
					</button>
				</div>
			)}

			{showAbout && (
				<div className="pd-modal-overlay" onClick={() => setShowAbout(false)}>
					<div className="pd-modal" onClick={(e) => e.stopPropagation()}>
						<div className="pd-modal-header">
							<h2 className="pd-modal-title">About ArtScape</h2>
							<button className="pd-modal-close" onClick={() => setShowAbout(false)}>✕</button>
						</div>
						<p className="pd-modal-body">
							Princeton ArtScape lets you explore public artworks across the Princeton University campus. Browse an interactive map, get walking directions to any piece, and complete a scavenger hunt by visiting and photographing artworks in person.
						</p>
					</div>
				</div>
			)}

			{showHelp && (
				<div className="pd-modal-overlay" onClick={() => setShowHelp(false)}>
					<div className="pd-modal" onClick={(e) => e.stopPropagation()}>
						<div className="pd-modal-header">
							<h2 className="pd-modal-title">Help</h2>
							<button className="pd-modal-close" onClick={() => setShowHelp(false)}>✕</button>
						</div>
						<p className="pd-modal-body">
							Tap any marker on the map to see artwork details. Walk within 200 m of a piece and tap <strong>Verify Visit</strong> to mark it found. In the Scavenger Hunt tab, unlock nearby artworks and snap a photo for extra verification.
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
