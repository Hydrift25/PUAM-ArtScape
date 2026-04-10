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

export default function ProfilePage() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const [visitedCount, setVisitedCount] = useState(0);
	const [favCount, setFavCount] = useState(0);
	const [totalCount, setTotalCount] = useState(0);

	useEffect(() => {
		async function load() {
			try {
				const [visitedRes, favRes, allRes] = await Promise.all([
					fetch("/api/artworks/visited", { credentials: "include" }),
					fetch("/api/artworks/favorites", {
						credentials: "include",
					}),
					fetch("/api/artworks"),
				]);
				if (visitedRes.ok) {
					const v = await visitedRes.json();
					setVisitedCount((v ?? []).length);
				}
				if (favRes.ok) {
					const f = await favRes.json();
					setFavCount((f ?? []).length);
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

	const initials = getInitials(user?.display_name);
	const pct = totalCount ? Math.round((visitedCount / totalCount) * 100) : 0;

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
					<span className="profile-tile-value">0</span>
				</div>
				<div className="profile-tile profile-tile-pink">
					<span className="profile-tile-icon">❤️</span>
					<span className="profile-tile-label">Favorites</span>
					<span className="profile-tile-value">{favCount}</span>
				</div>
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