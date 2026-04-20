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
	return (
		<div className={`lb-row${isMe ? " lb-row-current" : ""}`}>
			<span className="lb-row-rank">{u.rank}</span>
			<div className="lb-row-avatar">{getInitials(u.display_name)}</div>
			<div className="lb-row-info">
				<span className="lb-row-name">
					<span className="lb-row-name-text">{u.display_name}</span>
					{isMe && <span className="lb-row-you-tag">you</span>}
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
	const [expanded, setExpanded] = useState(false);

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

	const meRank = me?.rank ?? null;
	const meInTop3 = meRank !== null && meRank <= 3;
	const meInList = meRank !== null && meRank <= 10;
	const meUnranked = user && !me;

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
									className={`lb-podium-item ${podiumMeta[i].cls}${meInTop3 && u.id === user?.id ? " lb-podium-item--me" : ""}`}
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

					{/* Your Rank card — between podium and list */}
					{user && !meInTop3 && !meInList && (
						meUnranked ? (
							<div className="lb-your-rank-card lb-your-rank-unranked">
								<div className="lb-yr-avatar lb-yr-avatar--empty">?</div>
								<div className="lb-yr-info">
									<div className="lb-yr-label">your rank</div>
									<div className="lb-yr-name">Not yet ranked</div>
									<div className="lb-yr-pts">Find artworks to earn points</div>
								</div>
								<span className="lb-yr-rank">—</span>
							</div>
						) : me ? (
							<div className="lb-your-rank-card">
								<div className="lb-yr-avatar">{getInitials(me.display_name)}</div>
								<div className="lb-yr-info">
									<div className="lb-yr-label">your rank</div>
									<div className="lb-yr-name">You</div>
									<div className="lb-yr-pts">{me.score} pts</div>
								</div>
								<span className="lb-yr-rank">#{me.rank}</span>
							</div>
						) : null
					)}

					{/* Rankings list — ranks 4 onward */}
					<div className="page-card lb-rankings-card">
						<h3 className="lb-section-title">Rankings</h3>
						{rankings.slice(3, expanded ? 20 : 10).map((u) => (
							<RankRow
								key={u.id}
								u={u}
								isMe={!!(me && u.id === me.id)}
							/>
						))}

						{/* Dashed separator + pinned me row when outside top 10 */}
						{!meInList && !meUnranked && me && (
							<>
								<div className="lb-separator">
									<div className="lb-sep-line" />
									<span className="lb-sep-label">{me.rank - 10} below</span>
									<div className="lb-sep-line" />
								</div>
								<RankRow u={me} isMe={true} />
							</>
						)}

						{/* Show more / show less */}
						{rankings.length > 10 && (
							<button
								className="lb-show-more-btn"
								onClick={() => setExpanded((e) => !e)}
							>
								{expanded ? "Show less" : "Show more"}
							</button>
						)}
					</div>
				</>
			)}

			{/* How to earn points */}
			<div className="page-card lb-how-card">
				<h3 className="lb-section-title">How to Earn Points</h3>
				<div className="lb-how-item">
					<span className="lb-how-icon lb-how-orange">📷</span>
					<span>Visit an artwork in person and verify with a photo — earn 10 points</span>
				</div>
			</div>
		</div>
	);
}
