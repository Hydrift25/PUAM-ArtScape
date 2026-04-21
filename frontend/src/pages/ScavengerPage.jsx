import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { io } from "socket.io-client";
import mapboxgl from "mapbox-gl";

export default function ScavengerPage({ artworks = [] }) {
	const { user, login } = useAuth();
	const [finds, setFinds] = useState([]);
	const [stats, setStats] = useState(null);
	const [cameraOpen, setCameraOpen] = useState(false);
	const [stream, setStream] = useState(null);
	const [capturedImage, setCapturedImage] = useState(null);
	const [currObjectId, setCurrObjectId] = useState(null);
	const videoRef = useRef(null);
	const VERIFY_RADIUS_M = 200;

	function haversineMeters(lat1, lon1, lat2, lon2) {
		const R = 6371000;
		const toRad = (d) => (d * Math.PI) / 180;
		const dLat = toRad(lat2 - lat1);
		const dLon = toRad(lon2 - lon1);
		const a =
			Math.sin(dLat / 2) ** 2 +
			Math.cos(toRad(lat1)) *
			Math.cos(toRad(lat2)) *
			Math.sin(dLon / 2) ** 2;
		return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	}

	function getCurrentPosition() {
		return new Promise((resolve, reject) => {
			if (!navigator.geolocation) {
				reject(new Error("Geolocation not supported"));
				return;
			}
			navigator.geolocation.getCurrentPosition(resolve, reject, {
				enableHighAccuracy: true,
				maximumAge: 60000,
				timeout: 20000,
			});
		});
	}

	mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

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

	function AutoUpdateHuntPage() {
		useEffect(() => {
			const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:42560';

			const socket = io(SOCKET_URL, {
				auth: { user_id: user.id }
			});

			socket.on("image_processed", async (data) => {
				console.log("Image processed:", data.objectid);

				await refreshFindsAndStats();
			});

			return () => socket.disconnect();
		});
	}

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

	async function uploadPhoto() {
		if (!capturedImage) return;

		const blob = await fetch(capturedImage).then(res => res.blob());

		const formData = new FormData();
		formData.append("image", blob, "photo.jpg");

		const response = await fetch("/api/upload", {
			method: "POST",
			body: formData,
		});

		const data = await response.json();

		handleVerifyUserSubmission(data.image_url);
	}

	function closeCamera() {
		if (stream) stream.getTracks().forEach((t) => t.stop());
		setStream(null);
		setCapturedImage(null);
		setCameraOpen(false);
	}

	async function handleVerifyUserSubmission(userImageUrl) {
		try {
			await fetch("/api/scavenger/find", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ currObjectId, userImageUrl }),
			});
			await refreshFindsAndStats();
		} catch (err) {
			console.error("Failed to mark found:", err);
		}
	}

	const findsMap = new Map(finds.map((f) => [f.objectid, f]));
	const total = artworks.length;
	const foundCount = stats?.total_finds ?? 0;
	const score = stats?.total_score ?? 0;
	const pct = total ? Math.round((foundCount / total) * 100) : 0;

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
										onClick={() => {
											uploadPhoto();
											closeCamera();
										}}
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

			{/* Header */}
			<div className="page-header">
				<h1 className="page-title">Scavenger Hunt</h1>
				<p className="page-subtitle">
					Capture all {total} artworks to complete the hunt
				</p>
				<AutoUpdateHuntPage />
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

			{/* Artwork list */}
			<div className="scav-list">
				{artworks.map((art) => {
					const found = findsMap.has(art.objectid);
					const thumb = art.image_url
						? `${art.image_url}/full/120,/0/default.jpg`
						: null;
					return (
						<div
							key={art.objectid}
							className={`scav-card${found ? " scav-card-found" : ""}`}
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
							</div>
							{!found && (
								<div className="scav-card-actions">
									<button
										className="scav-camera-btn"
										onClick={() => {
											setCurrObjectId(art.objectid);
											openCamera();
										}}
										aria-label="Take photo to verify"
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
