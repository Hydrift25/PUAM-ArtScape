import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

const RANK_COLORS = { 1: "#FFD700", 2: "#C0C0C0", 3: "#CD7F32" };

function getInitials(name) {
	if (!name) return "?";
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

function RankRow({ u, isMe }) {
	const rankColor = RANK_COLORS[u.rank] ?? null;
	return (
		<div className={`lb-row${isMe ? " lb-row-current" : ""}`}>
			<span
				className="lb-row-rank"
				style={rankColor ? { color: rankColor } : undefined}
			>
				#{u.rank}
			</span>
			<div className="lb-row-avatar">{getInitials(u.display_name)}</div>
			<div className="lb-row-info">
				<span className="lb-row-name">
					{u.display_name}
					{isMe ? " (you)" : ""}
				</span>
				<span className="lb-row-sub">{u.total_finds} artworks found</span>
			</div>
			<span className="lb-row-points">{u.score} pts</span>
		</div>
	);
}

export default function LeaderboardPage() {
	const { user } = useAuth();
	const [rankings, setRankings] = useState([]);
	const [me, setMe] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function load() {
			try {
				const promises = [
					fetch("/api/leaderboard", { credentials: "include" }),
				];
				if (user) {
					promises.push(
						fetch("/api/leaderboard/me", { credentials: "include" }),
					);
				}
				const [lbRes, meRes] = await Promise.all(promises);
				if (lbRes.ok) setRankings(await lbRes.json());
				if (meRes?.ok) setMe(await meRes.json());
			} catch (err) {
				console.error("Failed to load leaderboard:", err);
			} finally {
				setLoading(false);
			}
		}
		load();
	}, [user]);

	const top3 = rankings.slice(0, 3);
	// Podium display order: silver (left), gold (center, tallest), bronze (right)
	const podiumOrder = [top3[1], top3[0], top3[2]];
	const podiumMeta = [
		{ cls: "podium-silver", label: "#2" },
		{ cls: "podium-gold", label: "#1" },
		{ cls: "podium-bronze", label: "#3" },
	];

	const meInTop20 = me && rankings.some((u) => u.id === me.id);

	if (loading) {
		return (
			<div className="page-container lb-page">
				<div className="page-header">
					<h1 className="page-title">🏆 Leaderboard</h1>
				</div>
				<div className="page-card lb-loading">Loading rankings…</div>
			</div>
		);
	}

	return (
		<div className="page-container lb-page">
			{/* Header */}
			<div className="page-header">
				<h1 className="page-title">🏆 Leaderboard</h1>
				<p className="page-subtitle">Top art explorers on campus</p>
			</div>

			{rankings.length === 0 ? (
				<div className="page-card lb-empty">
					No rankings yet — be the first to find some art!
				</div>
			) : (
				<>
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
										{u.score} pts
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
						{rankings.map((u) => (
							<RankRow
								key={u.id}
								u={u}
								isMe={!!(me && u.id === me.id)}
							/>
						))}
					</div>

					{/* Pinned card when current user is outside the top 20 */}
					{me && !meInTop20 && (
						<div className="page-card lb-rankings-card">
							<h3 className="lb-section-title">Your Ranking</h3>
							<RankRow u={me} isMe={true} />
						</div>
					)}
				</>
			)}

			{/* How to earn points */}
			<div className="page-card lb-how-card">
				<h3 className="lb-section-title">How to Earn Points</h3>
				<div className="lb-how-item">
					<span className="lb-how-icon lb-how-orange">📍</span>
					<span>Find an artwork — earn 5 points</span>
				</div>
				<div className="lb-how-item">
					<span className="lb-how-icon lb-how-blue">✓</span>
					<span>Get verified — earn 10 points (coming soon)</span>
				</div>
			</div>
		</div>
	);
}
