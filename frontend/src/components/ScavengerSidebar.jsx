import { useMemo } from "react";

export default function ScavengerSidebar({
	open,
	onClose,
	artworks,
	foundIds,
}) {
	const { foundCount, total, sorted } = useMemo(() => {
		const sorted = [...artworks].sort((a, b) => {
			const af = foundIds.has(a.objectid) ? 0 : 1;
			const bf = foundIds.has(b.objectid) ? 0 : 1;
			if (af !== bf) return af - bf;
			return (a.title || "").localeCompare(b.title || "");
		});
		return {
			foundCount: artworks.filter((a) => foundIds.has(a.objectid)).length,
			total: artworks.length,
			sorted,
		};
	}, [artworks, foundIds]);

	const pct = total ? Math.round((foundCount / total) * 100) : 0;

	return (
		<aside
			style={{
				position: "fixed",
				top: 0,
				right: 0,
				height: "100%",
				width: 340,
				maxWidth: "90vw",
				background: "#fff",
				boxShadow: "-4px 0 16px rgba(0,0,0,0.15)",
				transform: open ? "translateX(0)" : "translateX(100%)",
				transition: "transform 0.25s ease",
				zIndex: 1000,
				display: "flex",
				flexDirection: "column",
				fontFamily: "sans-serif",
			}}
		>
			<header
				style={{
					padding: "16px 20px",
					borderBottom: "1px solid #eee",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				<div>
					<h2 style={{ margin: 0, fontSize: "1.1rem" }}>
						Scavenger Hunt
					</h2>
					<div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
						{foundCount} / {total} found ({pct}%)
					</div>
				</div>
				<button
					onClick={onClose}
					style={{
						background: "none",
						border: "none",
						fontSize: 22,
						cursor: "pointer",
						color: "#666",
					}}
					aria-label="Close sidebar"
				>
					×
				</button>
			</header>

			<div
				style={{
					height: 6,
					background: "#eee",
					position: "relative",
				}}
			>
				<div
					style={{
						height: "100%",
						width: `${pct}%`,
						background: "#FF5733",
						transition: "width 0.3s ease",
					}}
				/>
			</div>

			<ul
				style={{
					listStyle: "none",
					margin: 0,
					padding: 0,
					overflowY: "auto",
					flex: 1,
				}}
			>
				{sorted.map((art) => {
					const found = foundIds.has(art.objectid);
					const thumb = art.image_url
						? `${art.image_url}/full/120,/0/default.jpg`
						: null;
					return (
						<li
							key={art.objectid}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 12,
								padding: "12px 20px",
								borderBottom: "1px solid #f3f3f3",
								opacity: found ? 1 : 0.55,
								background: found ? "#fff8f5" : "#fff",
							}}
						>
							<div
								style={{
									width: 48,
									height: 48,
									borderRadius: 8,
									background: "#eee",
									flexShrink: 0,
									overflow: "hidden",
									filter: found ? "none" : "grayscale(100%)",
								}}
							>
								{thumb && (
									<img
										src={thumb}
										alt=""
										style={{
											width: "100%",
											height: "100%",
											objectFit: "cover",
										}}
									/>
								)}
							</div>
							<div style={{ flex: 1, minWidth: 0 }}>
								<div
									style={{
										fontSize: 14,
										fontWeight: 600,
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
									}}
								>
									{art.title || "Untitled"}
								</div>
								<div style={{ fontSize: 12, color: "#888" }}>
									{art.date_range || ""}
								</div>
							</div>
							<div style={{ fontSize: 18 }}>
								{found ? "✅" : "◻️"}
							</div>
						</li>
					);
				})}
			</ul>
		</aside>
	);
}
