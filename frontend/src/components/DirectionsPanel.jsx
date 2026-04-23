import { useState } from "react";

function formatDistance(meters) {
	if (meters < 160) return `${Math.round((meters * 3.28084) / 10) * 10} ft`;
	return `${(meters / 1609.34).toFixed(1)} mi`;
}

function formatDuration(seconds) {
	if (seconds < 60) return "< 1 min";
	return `${Math.ceil(seconds / 60)} min`;
}

export default function DirectionsPanel({ navigationState, onBeginNavigation, onEndNavigation, isGuest }) {
	const [expanded, setExpanded] = useState(false);

	if (!navigationState) return null;

	const guestClass = isGuest ? " directions-panel--guest" : "";

	if (navigationState.mode === "preview") {
		return (
			<div className={`directions-panel${guestClass}`}>
				<div className="directions-handle" />
				<div className="directions-preview">
					<div className="directions-preview-title">
						{navigationState.destination.title || "Artwork"}
					</div>
					<div className="directions-preview-meta">
						<span>🚶</span>
						<span>
							{formatDistance(navigationState.totalDistance)} ·{" "}
							{formatDuration(navigationState.totalDuration)}
						</span>
					</div>
					<button className="directions-start-btn" onClick={onBeginNavigation}>
						Start Navigation
					</button>
					<button className="directions-cancel-btn" onClick={onEndNavigation}>
						Cancel
					</button>
				</div>
				{isGuest && <div className="directions-guest-fill" />}
			</div>
		);
	}

	if (navigationState.mode === "navigating" && !navigationState.arrived) {
		const eta = `${Math.ceil(navigationState.distanceRemaining / 80)} min`;
		return (
			<div className={`directions-panel${expanded ? " directions-panel--expanded" : ""}${guestClass}`}>
				<div
					className="directions-summary"
					onClick={() => setExpanded((e) => !e)}
				>
					<span>🚶</span>
					<span className="directions-distance">
						{formatDistance(navigationState.distanceRemaining)}
					</span>
					<span className="directions-eta">{eta}</span>
					<div className={`directions-chevron-wrap${expanded ? " directions-chevron-wrap--down" : " directions-chevron-wrap--up"}`}>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
							<polyline points="6 9 12 15 18 9" />
						</svg>
					</div>
					<button
						className="directions-end-btn"
						onClick={(e) => {
							e.stopPropagation();
							onEndNavigation();
						}}
					>
						End
					</button>
				</div>
				<div className={`directions-steps${expanded ? " directions-steps--expanded" : ""}`}>
					{navigationState.steps.map((step, i) => (
						<div key={i} className="directions-step">
							<span>•</span>
							<span className="directions-step-text">{step.instruction}</span>
							<span className="directions-step-dist">
								{formatDistance(step.distance)}
							</span>
						</div>
					))}
				</div>
				{isGuest && <div className="directions-guest-fill" />}
			</div>
		);
	}

	if (navigationState.arrived) {
		return (
			<div className={`directions-panel${guestClass}`}>
				<div className="directions-handle" />
				<div className="directions-arrived">
					<div className="directions-arrived-icon">✓</div>
					<div className="directions-arrived-heading">You&apos;ve arrived!</div>
					<div className="directions-arrived-title">
						{navigationState.destination.title || "Artwork"}
					</div>
					<button className="directions-done-btn" onClick={onEndNavigation}>
						Done
					</button>
				</div>
				{isGuest && <div className="directions-guest-fill" />}
			</div>
		);
	}

	return null;
}
