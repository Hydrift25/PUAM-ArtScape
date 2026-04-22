import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function getInitials(name) {
	if (!name) return "?";
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

function iiifImageUrl(base, width = 400) {
	if (!base) return null;
	const clean = base.replace(/\/$/, "");
	return `${clean}/full/${width},/0/default.jpg`;
}

function ArtworkGallery({ artworks, emptyMessage }) {
	if (!artworks.length) {
		return <p className="profile-gallery-empty">{emptyMessage}</p>;
	}
	return (
		<div className="profile-gallery">
			{artworks.map((art) => {
				const imgSrc = iiifImageUrl(art.image_url);
				return (
					<div key={art.objectid} className="profile-gallery-card">
						{imgSrc ? (
							<img
								src={imgSrc}
								alt={art.title || "Artwork"}
								className="profile-gallery-img"
								onError={(e) => {
									e.target.style.display = "none";
									e.target.nextSibling.style.display = "flex";
								}}
							/>
						) : null}
						<div
							className="profile-gallery-img profile-gallery-img-placeholder"
							style={{ display: imgSrc ? "none" : "flex" }}
						>
							🖼️
						</div>
						<p className="profile-gallery-title">
							{art.title || "Untitled"}
						</p>
					</div>
				);
			})}
		</div>
	);
}

export default function ProfilePage() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const [visited, setVisited] = useState([]);
	const [favorites, setFavorites] = useState([]);
	const [totalCount, setTotalCount] = useState(0);
	const [showVisited, setShowVisited] = useState(false);
	const [showFavorites, setShowFavorites] = useState(false);

	useEffect(() => {
		async function load() {
			try {
				const [visitedRes, favRes, allRes] = await Promise.all([
					fetch("/api/artworks/visited", { credentials: "include" }),
					fetch("/api/artworks/favorites", { credentials: "include" }),
					fetch("/api/artworks"),
				]);
				if (visitedRes.ok) {
					const v = await visitedRes.json();
					setVisited(v ?? []);
				}
				if (favRes.ok) {
					const f = await favRes.json();
					setFavorites(f ?? []);
				}
				if (allRes.ok) {
					const a = await allRes.json();
					setTotalCount((a ?? []).length);
				}
			} catch (err) {
				console.error("Failed to load profile data:", err);
			}
		}
		load();
	}, []);

	async function handleLogout() {
		await logout();
		navigate("/");
	}

	const visitedCount = visited.length;
	const favCount = favorites.length;
	const initials = getInitials(user?.display_name);
	const pct = totalCount ? Math.round((visitedCount / totalCount) * 100) : 0;

	return (
		<div className="page-container profile-page">
			{/* Header */}
			<div className="page-header profile-header-row">
				<h1 className="page-title">Your Profile</h1>
				<button className="profile-logout-btn" onClick={handleLogout}>
					Log Out
				</button>
			</div>

			{/* Profile card */}
			<div className="page-card profile-card">
				<div className="profile-avatar">{initials}</div>
				<h2 className="profile-name">
					{user?.display_name || "Explorer"}
				</h2>
				<p className="profile-email">{user?.email || ""}</p>
				<div className="profile-stats-row">
					<div className="profile-stat">
						<span className="profile-stat-value">0</span>
						<span className="profile-stat-label">Points</span>
					</div>
					<div className="profile-stat">
						<span className="profile-stat-value">
							{visitedCount}
						</span>
						<span className="profile-stat-label">Visited</span>
					</div>
					<div className="profile-stat">
						<span className="profile-stat-value">{favCount}</span>
						<span className="profile-stat-label">Favorited</span>
					</div>
				</div>
			</div>

			{/* Collection progress */}
			<div className="page-card">
				<h3 className="profile-card-title">Collection Progress</h3>
				<div className="scav-progress-track">
					<div
						className="scav-progress-fill"
						style={{ width: `${pct}%` }}
					/>
				</div>
				<p className="profile-progress-label">
					Artworks Found: {visitedCount}/{totalCount}
				</p>
				<p className="profile-progress-sub">
					Keep exploring to complete your collection!
				</p>
			</div>

			{/* Stat tiles */}
			<div className="profile-tiles">
				<div className="profile-tile profile-tile-orange">
					<span className="profile-tile-icon">📷</span>
					<span className="profile-tile-label">Photos Captured</span>
					<span className="profile-tile-value">{visitedCount}</span>
					<button
						className="profile-tile-view-btn"
						onClick={() => setShowVisited((s) => !s)}
					>
						{showVisited ? "Hide" : "View"}
					</button>
				</div>
				<div className="profile-tile profile-tile-pink">
					<span className="profile-tile-icon">❤️</span>
					<span className="profile-tile-label">Favorites</span>
					<span className="profile-tile-value">{favCount}</span>
					<button
						className="profile-tile-view-btn profile-tile-view-btn-pink"
						onClick={() => setShowFavorites((s) => !s)}
					>
						{showFavorites ? "Hide" : "View"}
					</button>
				</div>
			</div>

			{/* Visited artworks gallery */}
			{showVisited && (
				<div className="page-card profile-gallery-card-wrapper">
					<h3 className="profile-card-title">Visited Artworks</h3>
					<ArtworkGallery
						artworks={visited}
						emptyMessage="No artworks visited yet. Start exploring!"
					/>
				</div>
			)}

			{/* Favorites gallery */}
			{showFavorites && (
				<div className="page-card profile-gallery-card-wrapper">
					<h3 className="profile-card-title">Favorited Artworks</h3>
					<ArtworkGallery
						artworks={favorites}
						emptyMessage="No favorites yet. Heart an artwork to save it here!"
					/>
				</div>
			)}

			{/* CTA */}
			<div className="page-card profile-cta-card">
				<span className="profile-cta-icon">📷</span>
				<h3 className="profile-cta-title">Start Your Journey</h3>
				<p className="profile-cta-sub">
					Visit artworks across campus and capture photos to earn
					points!
				</p>
				<button
					className="profile-cta-btn"
					onClick={() => navigate("/hunt")}
				>
					Start Scavenger Hunt
				</button>
			</div>
		</div>
	);
}