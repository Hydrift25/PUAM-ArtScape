import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function ScavengerPage({ artworks = [] }) {
	const { user, login } = useAuth();
	const [finds, setFinds] = useState([]);
	const [stats, setStats] = useState(null);
	const [cameraOpen, setCameraOpen] = useState(false);
	const [stream, setStream] = useState(null);
	const [capturedImage, setCapturedImage] = useState(null);
	const [locationStatus, setLocationStatus] = useState("pending");
	const [nearbyIds, setNearbyIds] = useState(new Set());
	const [nearbyDistances, setNearbyDistances] = useState(new Map());
	const [showDeniedTooltip, setShowDeniedTooltip] = useState(false);
	const [lockedNudge, setLockedNudge] = useState(null);
	const videoRef = useRef(null);

	async function enableLocation() {
		setLocationStatus("loading");
		try {
			const pos = await new Promise((resolve, reject) =>
				navigator.geolocation.getCurrentPosition(resolve, reject, {
					enableHighAccuracy: true,
					maximumAge: 60000,
					timeout: 20000,
				})
			);
			const { latitude: lat, longitude: lon } = pos.coords;
			const res = await fetch(`/api/artworks/nearby?lat=${lat}&lon=${lon}`, { credentials: "include" });
			if (res.ok) {
				const nearby = await res.json();
				setNearbyIds(new Set(nearby.map((a) => a.objectid)));
				setNearbyDistances(new Map(nearby.map((a) => [a.objectid, a.distance_m])));
			}
			setLocationStatus("granted");
		} catch {
			setLocationStatus("denied");
		}
	}

	useEffect(() => {
		if (!navigator.permissions) return;
		navigator.permissions.query({ name: "geolocation" }).then((result) => {
			if (result.state === "granted") {
				enableLocation();
			} else if (result.state === "denied") {
				setLocationStatus("denied");
			}
			// "prompt" → leave as "pending"
		}).catch(() => {});
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Auto-clear locked nudge after 2500ms
	useEffect(() => {
		if (lockedNudge == null) return;
		const id = setTimeout(() => setLockedNudge(null), 2500);
		return () => clearTimeout(id);
	}, [lockedNudge]);

	const refreshFindsAndStats = useCallback(async () => {
		if (!user) return;
		try {
			const [findsRes, statsRes] = await Promise.all([
				fetch("/api/scavenger/finds", { credentials: "include" }),
				fetch("/api/scavenger/stats", { credentials: "include" }),
			]);
			if (findsRes.ok) setFinds(await findsRes.json());
			if (statsRes.ok) setStats(await statsRes.json());
		} catch (err) {
			console.error("Failed to load scavenger data:", err);
		}
	}, [user]);

	useEffect(() => {
		refreshFindsAndStats();
	}, [refreshFindsAndStats]);

	// Attach stream to video element once camera modal is open
	useEffect(() => {
		if (cameraOpen && stream && videoRef.current && !capturedImage) {
			videoRef.current.srcObject = stream;
		}
	}, [cameraOpen, stream, capturedImage]);

	// Stop stream on unmount
	useEffect(() => {
		return () => {
			if (stream) stream.getTracks().forEach((t) => t.stop());
		};
	}, [stream]);

	async function openCamera() {
		try {
			const s = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: "environment" },
			});
			setStream(s);
			setCapturedImage(null);
			setCameraOpen(true);
		} catch {
			alert(
				"Camera permission denied. Please allow camera access to capture artworks.",
			);
		}
	}

	function capturePhoto() {
		if (!videoRef.current) return;
		const canvas = document.createElement("canvas");
		canvas.width = videoRef.current.videoWidth;
		canvas.height = videoRef.current.videoHeight;
		canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
		setCapturedImage(canvas.toDataURL("image/jpeg"));
		stream.getTracks().forEach((t) => t.stop());
		setStream(null);
	}

	function closeCamera() {
		if (stream) stream.getTracks().forEach((t) => t.stop());
		setStream(null);
		setCapturedImage(null);
		setCameraOpen(false);
	}

	const findsMap = new Map(finds.map((f) => [f.objectid, f]));
	const total = artworks.length;
	const foundCount = stats?.total_finds ?? 0;
	const score = stats?.total_score ?? 0;
	const pct = total ? Math.round((foundCount / total) * 100) : 0;

	// Sort: unlocked (nearby, not found) by distance → locked (not found) by title → found by title
	const allNearbyFound =
		locationStatus === "granted" &&
		nearbyIds.size > 0 &&
		[...nearbyIds].every((id) => findsMap.has(id));

	const sortedArtworks = (() => {
		const unlocked = [];
		const locked = [];
		const foundList = [];
		for (const art of artworks) {
			if (findsMap.has(art.objectid)) {
				foundList.push(art);
			} else if (nearbyIds.has(art.objectid)) {
				unlocked.push(art);
			} else {
				locked.push(art);
			}
		}
		unlocked.sort(
			(a, b) =>
				(nearbyDistances.get(a.objectid) ?? Infinity) -
				(nearbyDistances.get(b.objectid) ?? Infinity),
		);
		locked.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
		foundList.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
		return [...unlocked, ...locked, ...foundList];
	})();

	if (!user) {
		return (
			<div className="page-container scav-page">
				<div className="page-header">
					<h1 className="page-title">Scavenger Hunt</h1>
				</div>
				<div className="page-card scav-guest-card">
					<p className="scav-guest-msg">
						Sign in to track your finds and earn points.
					</p>
					<button className="scav-signin-btn" onClick={login}>
						Sign In with Google
					</button>
				</div>
			</div>
		);
	}

	const locationDeniedOrDismissed =
		locationStatus === "denied" || locationStatus === "dismissed";

	return (
		<div className="page-container scav-page">
			{/* Camera modal */}
			{cameraOpen && (
				<div className="camera-overlay">
					<div className="camera-modal">
						<button
							className="camera-close-btn"
							onClick={closeCamera}
							aria-label="Close camera"
						>
							✕
						</button>
						{capturedImage ? (
							<>
								<img
									src={capturedImage}
									className="camera-captured"
									alt="Captured"
								/>
								<div className="camera-modal-actions">
									<button
										className="camera-retake-btn"
										onClick={() => {
											setCapturedImage(null);
											openCamera();
										}}
									>
										Retake
									</button>
									<button
										className="camera-confirm-btn"
										onClick={closeCamera}
									>
										Confirm
									</button>
								</div>
							</>
						) : (
							<>
								<video
									ref={videoRef}
									autoPlay
									playsInline
									className="camera-video"
								/>
								<button
									className="camera-capture-btn"
									onClick={capturePhoto}
									aria-label="Capture photo"
								/>
							</>
						)}
					</div>
				</div>
			)}

			{/* Location banners */}
			{(locationStatus === "pending" || locationStatus === "loading") && (
				<div className="loc-banner loc-banner-prompt">
					<span className="loc-banner-text">📍 Unlock the 3 artworks closest to you →</span>
					<button
						className="loc-banner-btn"
						onClick={enableLocation}
						disabled={locationStatus === "loading"}
					>
						{locationStatus === "loading" ? "Locating…" : "Enable Location"}
					</button>
				</div>
			)}
			{locationStatus === "denied" && (
				<div className="loc-banner loc-banner-denied">
					<span className="loc-banner-text">
						📍 Location off · All artworks locked ·{" "}
						<button className="loc-banner-link" onClick={() => setShowDeniedTooltip((v) => !v)}>
							How to enable ↗
						</button>
					</span>
					<button className="loc-banner-dismiss" onClick={() => setLocationStatus("dismissed")} aria-label="Dismiss">✕</button>
					{showDeniedTooltip && (
						<div className="loc-denied-tooltip">
							<strong>Safari (iOS):</strong> Settings → Privacy &amp; Security → Location Services → Safari → Allow<br />
							<strong>Chrome (Android):</strong> Settings → Site Settings → Location → Allow
						</div>
					)}
				</div>
			)}

			{/* Header */}
			<div className="page-header">
				<h1 className="page-title">Scavenger Hunt</h1>
				<p className="page-subtitle">
					Capture all {total} artworks to complete the hunt
				</p>
			</div>

			{/* Progress + stats card */}
			<div className="page-card scav-progress-card">
				<div className="scav-progress-row">
					<span className="scav-progress-label">
						{foundCount} / {total} artworks
					</span>
					<span className="scav-points-badge">{score} pts</span>
				</div>
				<div className="scav-progress-track">
					<div
						className="scav-progress-fill"
						style={{ width: `${pct}%` }}
					/>
				</div>
				<span className="scav-progress-pct">{pct}% complete</span>
				<div className="scav-stats-row">
					<div className="scav-stat-item">
						<span className="scav-stat-val">{foundCount}</span>
						<span className="scav-stat-label">Artworks Found</span>
					</div>
					<div className="scav-stat-divider" />
					<div className="scav-stat-item">
						<span className="scav-stat-val">{score}</span>
						<span className="scav-stat-label">Points</span>
					</div>
				</div>
			</div>

			{/* All nearby found callout */}
			{allNearbyFound && (
				<div className="page-card scav-all-nearby-found">
					<p className="scav-all-nearby-found-msg">
						🎉 You've found everything nearby — keep exploring to unlock more!
					</p>
				</div>
			)}

			{/* Artwork list */}
			<div className="scav-list">
				{sortedArtworks.map((art) => {
					const found = findsMap.has(art.objectid);
					const unlocked = nearbyIds.has(art.objectid);
					const locked = !found && !unlocked;
					const distance = nearbyDistances.get(art.objectid);
					const thumb = art.image_url
						? `${art.image_url}/full/120,/0/default.jpg`
						: null;
					return (
						<div
							key={art.objectid}
							className={`scav-card${found ? " scav-card-found" : ""}${locked ? " scav-card-locked" : ""}`}
							onClick={locked ? () => setLockedNudge(art.objectid) : undefined}
						>
							<div className="scav-card-thumb-wrap">
								{thumb ? (
									<img
										src={thumb}
										alt=""
										className={`scav-card-thumb${found ? "" : " scav-thumb-grey"}`}
									/>
								) : (
									<div className="scav-card-thumb-placeholder" />
								)}
							</div>
							<div className="scav-card-info">
								<span className="scav-card-title">
									{art.title || "Untitled"}
								</span>
								<span
									className={`scav-card-status${found ? " scav-status-found" : " scav-status-pending"}`}
								>
									{found ? "✓ Verified" : "Not found"}
								</span>
								{locked && lockedNudge === art.objectid && (
									<p className="scav-card-nudge">
										{distance != null
											? `Walk closer to unlock · ${Math.round(distance)}m away`
											: "Walk closer to unlock"}
									</p>
								)}
							</div>
							{!found && unlocked && (
								<div className="scav-card-actions">
									<button
										className="scav-camera-btn"
										onClick={openCamera}
										aria-label="Take photo to verify"
									>
										📷
									</button>
								</div>
							)}
							{locked && (
								<div className="scav-card-actions">
									<button
										className="scav-camera-btn btn--location-disabled"
										disabled
										aria-label="Get closer to verify this artwork"
									>
										📷
									</button>
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
