import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

// TODO: Replace with real data once /api/leaderboard is implemented on the backend
const PLACEHOLDER_USERS = [
	{ id: 1, display_name: "Alex Chen", email: null, points: 450, visited: 18, rank: 1 },
	{ id: 2, display_name: "Sarah Kim", email: null, points: 380, visited: 15, rank: 2 },
	{ id: 3, display_name: "Jordan Lee", email: null, points: 320, visited: 13, rank: 3 },
	{ id: 4, display_name: "Morgan Davis", email: null, points: 280, visited: 11, rank: 4 },
	{ id: 5, display_name: "Taylor Park", email: null, points: 210, visited: 8, rank: 5 },
];

function getInitials(name) {
	if (!name) return "?";
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

export default function LeaderboardPage() {
	const { user } = useAuth();
	const [rankings, setRankings] = useState(PLACEHOLDER_USERS);

	useEffect(() => {
		// TODO: /api/leaderboard endpoint does not exist yet — falls back to placeholder data
		fetch("/api/leaderboard", { credentials: "include" })
			.then((res) => {
				if (!res.ok) throw new Error("Not implemented");
				return res.json();
			})
			.then((data) => setRankings(data))
			.catch(() => setRankings(PLACEHOLDER_USERS));
	}, []);

	const top3 = rankings.slice(0, 3);
	const rest = rankings.slice(3);

	// Podium display order: silver (left), gold (center, tallest), bronze (right)
	const podiumOrder = [top3[1], top3[0], top3[2]];
	const podiumMeta = [
		{ cls: "podium-silver", label: "#2" },
		{ cls: "podium-gold", label: "#1" },
		{ cls: "podium-bronze", label: "#3" },
	];

	return (
		<div className="page-container lb-page">
			{/* Header */}
			<div className="page-header">
				<h1 className="page-title">🏆 Leaderboard</h1>
				<p className="page-subtitle">Top art explorers on campus</p>
			</div>

			{/* Podium */}
			<div className="lb-podium">
				{podiumOrder.map((u, i) =>
					u ? (
						<div
							key={u.id}
							className={`lb-podium-item ${podiumMeta[i].cls}`}
						>
							<div className="lb-podium-avatar">
								{getInitials(u.display_name)}
							</div>
							<span className="lb-podium-name">
								{u.display_name.split(" ")[0]}
							</span>
							<span className="lb-podium-points">
								{u.points} pts
							</span>
							<div className="lb-podium-base">
								{podiumMeta[i].label}
							</div>
						</div>
					) : null,
				)}
			</div>

			{/* All rankings */}
			<div className="page-card lb-rankings-card">
				<h3 className="lb-section-title">All Rankings</h3>
				{rankings.map((u) => {
					const isMe = user && u.email && u.email === user.email;
					return (
						<div
							key={u.id}
							className={`lb-row${isMe ? " lb-row-current" : ""}`}
						>
							<span className="lb-row-rank">#{u.rank}</span>
							<div className="lb-row-avatar">
								{getInitials(u.display_name)}
							</div>
							<div className="lb-row-info">
								<span className="lb-row-name">
									{u.display_name}
								</span>
								<span className="lb-row-sub">
									{u.visited} artworks found
								</span>
							</div>
							<span className="lb-row-points">
								{u.points} pts
							</span>
						</div>
					);
				})}
			</div>

			{/* How to earn points */}
			<div className="page-card lb-how-card">
				<h3 className="lb-section-title">How to Earn Points</h3>
				<div className="lb-how-item">
					<span className="lb-how-icon lb-how-orange">📍</span>
					<span>Visit an artwork — earn 10 points</span>
				</div>
				<div className="lb-how-item">
					<span className="lb-how-icon lb-how-blue">📷</span>
					<span>Capture a photo — earn 5 bonus points</span>
				</div>
			</div>
		</div>
	);
}