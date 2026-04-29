import { useEffect } from "react";

function AboutContent() {
	return (
		<>
			<section>
				<p
					style={{
						margin: "0 0 6px",
						fontSize: "0.68rem",
						fontWeight: 700,
						letterSpacing: "0.08em",
						textTransform: "uppercase",
						color: "#888",
					}}
				>
					What is ArtScape?
				</p>
				<p style={{ margin: 0, lineHeight: 1.65 }}>
					PUAM ArtScape is an interactive web app for discovering public
					art across Princeton University's campus. Browse the full
					collection on an interactive map, or sign in to unlock the
					scavenger hunt — find artworks in person, verify with a photo,
					and climb the leaderboard.
				</p>
			</section>

			<section>
				<p
					style={{
						margin: "0 0 6px",
						fontSize: "0.68rem",
						fontWeight: 700,
						letterSpacing: "0.08em",
						textTransform: "uppercase",
						color: "#888",
					}}
				>
					The Collection
				</p>
				<p style={{ margin: 0, lineHeight: 1.65 }}>
					Artwork data is sourced from the Princeton University Art
					Museum's public collection. Locations and metadata are provided
					for educational and exploratory purposes. For authoritative
					information, visit the{" "}
					<a
						href="https://artmuseum.princeton.edu"
						target="_blank"
						rel="noreferrer"
						style={{
							color: "#E8450A",
							textDecoration: "none",
							fontWeight: 500,
						}}
					>
						PUAM website
					</a>
					.
				</p>
			</section>

			<section>
				<p
					style={{
						margin: "0 0 10px",
						fontSize: "0.68rem",
						fontWeight: 700,
						letterSpacing: "0.08em",
						textTransform: "uppercase",
						color: "#888",
					}}
				>
					Built By
				</p>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "6px",
						marginBottom: "10px",
					}}
				>
					{[
						{ name: "Dev Patel", role: "Lead Developer" },
						{ name: "Arnav Sadeesh", role: "Developer" },
						{ name: "Arnav Ambre", role: "Developer" },
						{ name: "Sakthivel Vijayakumar", role: "Developer" },
					].map(({ name, role }, i) => (
						<div
							key={i}
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "baseline",
								gap: "12px",
							}}
						>
							<span style={{ fontWeight: 500 }}>{name}</span>
							<span
								style={{
									color: "#888",
									fontSize: "0.85rem",
									whiteSpace: "nowrap",
								}}
							>
								{role}
							</span>
						</div>
					))}
				</div>
				<p style={{ margin: 0, color: "#888", fontSize: "0.85rem" }}>
					Built as a student project at Princeton University.
				</p>
			</section>

			<section>
				<p
					style={{
						margin: "0 0 10px",
						fontSize: "0.68rem",
						fontWeight: 700,
						letterSpacing: "0.08em",
						textTransform: "uppercase",
						color: "#888",
					}}
				>
					Powered By
				</p>
				<div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
					{[
						"Mapbox GL JS",
						"Google OAuth",
						"Princeton University Art Museum",
					].map((tech) => (
						<span
							key={tech}
							style={{
								fontSize: "0.8rem",
								padding: "3px 10px",
								borderRadius: "999px",
								background: "#f2f2f2",
								color: "#444",
							}}
						>
							{tech}
						</span>
					))}
				</div>
			</section>

			<section
				style={{
					background: "#fafafa",
					border: "1px solid #eee",
					borderRadius: "8px",
					padding: "14px 16px",
				}}
			>
				<p
					style={{
						margin: "0 0 6px",
						fontSize: "0.68rem",
						fontWeight: 700,
						letterSpacing: "0.08em",
						textTransform: "uppercase",
						color: "#888",
					}}
				>
					Terms &amp; Disclaimer
				</p>
				<p
					style={{
						margin: 0,
						lineHeight: 1.65,
						fontSize: "0.875rem",
						color: "#555",
					}}
				>
					This app is a student project and is not officially affiliated
					with or endorsed by Princeton University or the Princeton
					University Art Museum. Artwork locations and details are provided
					for exploratory purposes and may not be fully accurate. Photos
					submitted during the scavenger hunt are stored and used only
					within this app. We collect your name and email via Google
					sign-in solely to create and identify your account — this data is
					not shared with third parties.
				</p>
			</section>
		</>
	);
}

function HelpContent() {
	return (
		<>
			{[
				{
					icon: "🗺️",
					title: "Exploring the Map",
					body: "Anyone can browse the map — no account needed. Tap any pin to see artwork details including title, artist, date, medium, and location. Use pinch-to-zoom or the +/− controls to navigate.",
				},
				{
					icon: "👤",
					title: "Guest vs. Signed In",
					body: "As a guest, all artwork details are visible but scavenger hunt features — finding artworks, favoriting, and the leaderboard — are unavailable. Sign in with Google to unlock the full experience.",
				},
				{
					icon: "📍",
					title: "Location & Proximity",
					body: "The scavenger hunt requires your location. Tap \"Enable Location\" and your browser will ask for permission. If you deny it, the map still works fully — you just won't be able to verify finds. You can reset location permissions in your browser settings at any time.",
				},
				{
					icon: "📸",
					title: "Finding Artwork",
					body: "When you're close enough to an artwork, it unlocks in the Hunt tab. Tap it, then use your camera to take a photo as verification. Verified finds earn 10 points and count toward your leaderboard rank.",
				},
				{
					icon: "❤️",
					title: "Favorites",
					body: "Tap the heart icon on any artwork's detail panel to save it. You can view your saved artworks from your profile.",
				},
				{
					icon: "🏆",
					title: "Leaderboard",
					body: "Rankings are based on verified photo finds only. The top 10 players are shown by default — tap \"Show More\" to expand to the top 20. Your rank is always shown even if you're outside the top 20.",
				},
			].map(({ icon, title, body }) => (
				<div
					key={title}
					style={{
						display: "flex",
						gap: "14px",
						padding: "13px 0",
						borderBottom: "1px solid #f0f0f0",
						alignItems: "flex-start",
					}}
				>
					<span
						style={{
							fontSize: "1.2rem",
							lineHeight: 1,
							marginTop: "2px",
							flexShrink: 0,
						}}
					>
						{icon}
					</span>
					<div>
						<p
							style={{
								margin: "0 0 3px",
								fontWeight: 600,
								fontSize: "0.925rem",
							}}
						>
							{title}
						</p>
						<p
							style={{
								margin: 0,
								lineHeight: 1.6,
								fontSize: "0.875rem",
								color: "#555",
							}}
						>
							{body}
						</p>
					</div>
				</div>
			))}

			<div style={{ marginTop: "18px" }}>
				<p
					style={{
						margin: "0 0 10px",
						fontSize: "0.68rem",
						fontWeight: 700,
						letterSpacing: "0.08em",
						textTransform: "uppercase",
						color: "#888",
					}}
				>
					Troubleshooting
				</p>
				<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
					{[
						{
							label: "Location not working?",
							body: "Make sure you've granted location permission in your browser. On iOS, go to Settings → Privacy & Security → Location Services → Safari → Allow. On Android, go to Settings → Site Settings → Location → Allow.",
						},
						{
							label: "Photo not submitting?",
							body: "Check that you've allowed camera access in your browser. Try retaking the photo if the upload stalls.",
						},
						{
							label: "Pins not showing?",
							body: "Try refreshing the page. If the issue persists, check your internet connection.",
						},
					].map(({ label, body }) => (
						<div key={label}>
							<p style={{ margin: "0 0 2px", fontSize: "0.875rem" }}>
								<em style={{ fontWeight: 600, fontStyle: "italic" }}>
									{label}
								</em>
							</p>
							<p
								style={{
									margin: 0,
									fontSize: "0.875rem",
									color: "#555",
									lineHeight: 1.55,
								}}
							>
								{body}
							</p>
						</div>
					))}
				</div>
			</div>
		</>
	);
}

export function AboutModal({ isOpen, onClose }) {
	useEffect(() => {
		if (!isOpen) return;
		const handler = (e) => { if (e.key === "Escape") onClose(); };
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [isOpen, onClose]);

	if (!isOpen) return null;
	return (
		<div className="info-modal-overlay" onClick={onClose}>
			<div className="info-modal" onClick={(e) => e.stopPropagation()}>
				<div className="info-modal-header">
					<h2 className="info-modal-title">About ArtScape</h2>
					<button className="info-modal-close" onClick={onClose}>✕</button>
				</div>
				<div className="info-modal-body info-modal-body--about">
					<AboutContent />
				</div>
			</div>
		</div>
	);
}

export function HelpModal({ isOpen, onClose }) {
	useEffect(() => {
		if (!isOpen) return;
		const handler = (e) => { if (e.key === "Escape") onClose(); };
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [isOpen, onClose]);

	if (!isOpen) return null;
	return (
		<div className="info-modal-overlay" onClick={onClose}>
			<div className="info-modal" onClick={(e) => e.stopPropagation()}>
				<div className="info-modal-header">
					<h2 className="info-modal-title">Help</h2>
					<button className="info-modal-close" onClick={onClose}>✕</button>
				</div>
				<div className="info-modal-body">
					<HelpContent />
				</div>
			</div>
		</div>
	);
}
