import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function relativeTime(iso) {
	if (!iso) return "";
	const then = new Date(iso);
	const diff = Math.floor((Date.now() - then.getTime()) / 1000);
	if (diff < 60) return "just now";
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
	return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

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
	const [activeTab, setActiveTab] = useState("found");

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
	const verifiedCount = visited.filter((v) => v.verify_state === 1).length;
	const favCount = favorites.length;

	const activity = useMemo(() => {
		const events = [
			...visited
				.filter((v) => v.verify_state === 1 && v.found_at)
				.map((v) => ({
					kind: "verified",
					title: v.title,
					at: v.found_at,
					objectid: v.objectid,
				})),
			...favorites
				.filter((f) => f.saved_at)
				.map((f) => ({
					kind: "favorited",
					title: f.title,
					at: f.saved_at,
					objectid: f.objectid,
				})),
		];
		events.sort((a, b) => new Date(b.at) - new Date(a.at));
		return events.slice(0, 5);
	}, [visited, favorites]);
	const initials = getInitials(user?.display_name);
	const pct = totalCount ? Math.round((verifiedCount / totalCount) * 100) : 0;

	return (
		<div className="page-container profile-page">
			{/* Header */}
			<div className="page-header profile-header-row">
				<h1 className="page-title">Your Profile</h1>
				<button
					className="profile-logout-btn"
					onClick={handleLogout}
				>
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
							{verifiedCount}
						</span>
						<span className="profile-stat-label">Found</span>
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
					Artworks Found: {verifiedCount}/{totalCount}
				</p>
				<p className="profile-progress-sub">
					Keep exploring to complete your collection!
				</p>
			</div>

			{/* Stat tiles — act as tab triggers */}
			<div className="profile-tiles">
				<div
					className={`profile-tile profile-tile-orange ${activeTab === "found" ? "profile-tile--active profile-tile--active-orange" : "profile-tile--inactive"}`}
					onClick={() => setActiveTab("found")}
				>
					<span className="profile-tile-icon">📷</span>
					<span className="profile-tile-label">Visited</span>
					<span className="profile-tile-value">{verifiedCount}</span>
				</div>
				<div
					className={`profile-tile profile-tile-pink ${activeTab === "favorited" ? "profile-tile--active profile-tile--active-pink" : "profile-tile--inactive"}`}
					onClick={() => setActiveTab("favorited")}
				>
					<span className="profile-tile-icon">❤️</span>
					<span className="profile-tile-label">Favorites</span>
					<span className="profile-tile-value">{favCount}</span>
				</div>
			</div>

			{/* Gallery card — flush below active tile */}
			<div className={`page-card profile-gallery-wrapper profile-gallery-wrapper--${activeTab}`}>
				{activeTab === "found" ? (
					<ArtworkGallery
						artworks={visited.filter((v) => v.verify_state === 1)}
						emptyMessage="No artworks verified yet — start exploring!"
					/>
				) : (
					<ArtworkGallery
						artworks={favorites}
						emptyMessage="No favorites yet. Heart an artwork to save it here!"
					/>
				)}
			</div>

			{/* Recent activity */}
			<div className="page-card">
				<h3 className="profile-card-title">Recent Activity</h3>
				{activity.length === 0 ? (
					<p className="profile-activity-empty">
						No recent activity yet — go find some art!
					</p>
				) : (
					<ul className="profile-activity-list">
						{activity.map((ev, i) => (
							<li
								key={`${ev.kind}-${ev.objectid}-${i}`}
								className="profile-activity-row"
							>
								<span
									className={`profile-activity-icon profile-activity-icon--${ev.kind}`}
								>
									{ev.kind === "verified" ? "📷" : "❤️"}
								</span>
								<div className="profile-activity-text">
									<span className="profile-activity-action">
										{ev.kind === "verified"
											? "Verified"
											: "Favorited"}
									</span>
									<span className="profile-activity-title">
										{ev.title || "Untitled"}
									</span>
								</div>
								<span className="profile-activity-time">
									{relativeTime(ev.at)}
								</span>
							</li>
						))}
					</ul>
				)}
			</div>

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
