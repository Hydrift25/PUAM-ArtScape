import { useState } from "react";

export default function BottomSheet({ content, onClose, onVerify, isFound }) {
	const [favorited, setFavorited] = useState(
		content?.art?.favorited ?? false,
	);

	if (!content) return null;

	const { art, type } = content;
	const thumbnail = art.image_url
		? `${art.image_url}/full/600,/0/default.jpg`
		: null;

	async function toggleFavorite() {
		try {
			const res = await fetch(
				`/api/artworks/favorite?objectid=${art.objectid}`,
				{
					method: "POST",
				},
			);
			if (res.ok) {
				const data = await res.json();
				setFavorited(data.favorited);
				alert("Updated favorites!");
			}
		} catch (err) {
			console.error("Failed to update favorite:", err);
			alert("Something went wrong. Please try again.");
		}
	}

	return (
		<div className="bottom-sheet show">
			<button className="close-sheet" onClick={onClose}>
				✕
			</button>
			{type === "detailed" ? (
				<div
					style={{
						width: "100%",
						minWidth: "220px",
						fontFamily: "sans-serif",
						lineHeight: 1.5,
					}}
				>
					<b
						style={{
							color: "#FF5733",
							fontSize: "12px",
							letterSpacing: "1px",
						}}
					>
						CLOSEST ARTWORK
					</b>
					<h3 style={{ margin: "8px 0", fontSize: "1.2rem" }}>
						{art.title || "Untitled"}
					</h3>
					<p style={{ margin: "5px 0", fontSize: "0.9rem" }}>
						<b>Date:</b> {art.date_range || "N/A"}
					</p>
					{thumbnail && (
						<img
							src={thumbnail}
							style={{
								width: "100%",
								height: "auto",
								objectFit: "contain",
								borderRadius: "8px",
								margin: "10px 0",
							}}
						/>
					)}
					<p
						style={{
							fontSize: "15px",
							lineHeight: 1.4,
							marginBottom: "20px",
						}}
					
						dangerouslySetInnerHTML={{__html: art.description || ""}}
					/>
					<button
						onClick={() => onVerify && onVerify(art)}
						disabled={isFound}
						style={{
							width: "100%",
							padding: "10px",
							marginBottom: "8px",
							cursor: isFound ? "default" : "pointer",
							background: isFound ? "#e6f7ea" : "#fff0ec",
							border: `1px solid ${isFound ? "#9bd4ab" : "#ffb199"}`,
							borderRadius: "6px",
							fontWeight: "bold",
						}}
					>
						{isFound ? "✅ Found" : "📍 Verify I'm Here"}
					</button>
					<button
						onClick={toggleFavorite}
						style={{
							width: "100%",
							padding: "10px",
							cursor: "pointer",
							background: "#f8f8f8",
							border: "1px solid #ddd",
							borderRadius: "6px",
							fontWeight: "bold",
						}}
					>
						{favorited ? "💔 Unfavorite" : "❤️ Favorite"}
					</button>
				</div>
			) : (
				<div style={{ textAlign: "center", fontFamily: "sans-serif" }}>
					<h4>{art.title || "Unknown Artwork"}</h4>
					<p style={{ fontSize: "13px", color: "#666" }}>
						📍 Walk closer to reveal details.
					</p>
				</div>
			)}
		</div>
	);
}
