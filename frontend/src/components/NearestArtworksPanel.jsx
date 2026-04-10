const RANK_LABELS = ["#1", "#2", "#3"];

export default function NearestArtworksPanel({ artworks, onSelect, hidden }) {
	if (!artworks || artworks.length === 0) return null;

	return (
		<div className={`nearest-panel${hidden ? " nearest-panel--hidden" : ""}`}>
			<h3 className="nearest-panel-title">Nearest Artworks</h3>
			{artworks.map((art, i) => {
				const thumb = art.image_url
					? `${art.image_url}/full/120,/0/default.jpg`
					: null;
				const dist =
					art.distance != null
						? art.distance < 1000
							? `${art.distance}m`
							: `${(art.distance / 1000).toFixed(1)}km`
						: null;

				return (
					<button
						key={art.objectid}
						className="nearest-row"
						onClick={() => onSelect(art)}
					>
						<span className="nearest-rank">{RANK_LABELS[i]}</span>
						<div className="nearest-thumb-wrap">
							{thumb ? (
								<img
									src={thumb}
									alt=""
									className="nearest-thumb"
								/>
							) : (
								<div className="nearest-thumb-placeholder" />
							)}
						</div>
						<div className="nearest-info">
							<span className="nearest-name">
								{art.title || "Untitled"}
							</span>
							{art.artist && (
								<span className="nearest-artist">
									{art.artist}
								</span>
							)}
						</div>
						{dist && (
							<span className="nearest-dist-badge">{dist}</span>
						)}
					</button>
				);
			})}
		</div>
	);
}