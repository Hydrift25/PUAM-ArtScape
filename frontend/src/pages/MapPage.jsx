import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import BottomSheet from "../components/BottomSheet";
import ScavengerSidebar from "../components/ScavengerSidebar";
import NearestArtworksPanel from "../components/NearestArtworksPanel";
import {
	createNearbyMarkerEl,
	createAllMarkerEl,
	createUserMarkerEl,
} from "../components/ArtworkMarker";
import { useAuth } from "../context/AuthContext";

const FOUND_STORAGE_KEY = "artscape.foundIds";
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

function fetchGeoPosition() {
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

export default function MapPage({ isGuest = false, artworks = [], isVisible = true }) {
	const { user } = useAuth();
	const mapContainer = useRef(null);
	const map = useRef(null);
	const mapInitialized = useRef(false);
	const markersRef = useRef([]);
	// objectid -> { el, art } — used by resolveMarkerStyles to mutate elements in-place
	const markerElsRef = useRef(new Map());
	const userMarkerRef = useRef(null);
	const lastPosRef = useRef(null);
	// Mirrors the artworks prop so the map.on("load") closure always sees fresh data
	const artworksRef = useRef(artworks);
	// Guards against double marker creation if artworks arrive before/after map load
	const markersLoadedRef = useRef(false);
	// Stores geolocation result so resolveMarkerStyles can be called after markers load
	const geoPositionRef = useRef(null);
	// Ensures resolveMarkerStyles only runs once
	const stylesResolvedRef = useRef(false);
	// Mirrors locationStatus state for closure access inside map.on("load")
	const locationStatusRef = useRef("pending");
	// Stores the watchPosition ID so we only start one watcher
	const watchIdRef = useRef(null);
	// Guards against double nearby fetch on the guest path (mirrors stylesResolvedRef)
	const nearbyFetchedRef = useRef(false);

	// 'pending' | 'loading' | 'granted' | 'denied'
	const [locationStatus, setLocationStatus] = useState("pending");
	const [showDeniedTooltip, setShowDeniedTooltip] = useState(false);
	const [deniedBannerDismissed, setDeniedBannerDismissed] = useState(
		() => sessionStorage.getItem("artscape.locDeniedDismissed") === "1",
	);
	const [sheetContent, setSheetContent] = useState(null);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [foundIds, setFoundIds] = useState(new Set());
	const [favoritedIds, setFavoritedIds] = useState(new Set());
	const [nearbyArtworks, setNearbyArtworks] = useState([]);
	const [panelMinimized, setPanelMinimized] = useState(false);
	// True until both /api/artworks/visited and /api/artworks/favorites resolve
	const [favoritesLoading, setFavoritesLoading] = useState(true);

	// Updates both the ref (for closure access) and the state (for rendering)
	function setLocStatus(status) {
		locationStatusRef.current = status;
		setLocationStatus(status);
	}

	// Keep ref in sync with prop
	useEffect(() => {
		artworksRef.current = artworks;
	}, [artworks]);

	// When artworks arrive and map is already loaded, create markers if not done yet.
	// Also trigger resolveMarkerStyles if geolocation already resolved first.
	useEffect(() => {
		if (!artworks.length || markersLoadedRef.current) return;
		if (map.current && map.current.isStyleLoaded()) {
			markersLoadedRef.current = true;
			loadAllMarkers(artworks);
			if (!isGuest && geoPositionRef.current && !stylesResolvedRef.current) {
				resolveMarkerStyles(
					geoPositionRef.current.lat,
					geoPositionRef.current.lon,
				);
			}
			if (isGuest && geoPositionRef.current) {
				fetchNearbyData(geoPositionRef.current.lat, geoPositionRef.current.lon);
			}
		}
		// If map isn't loaded yet, the map.on("load") callback handles initial marker creation
	}, [artworks]); // eslint-disable-line react-hooks/exhaustive-deps

	// Start watchPosition only after location is granted — iOS requires getUserMedia-style
	// gesture before watchPosition will prompt, so we wait until getCurrentPosition succeeds.
	useEffect(() => {
		if (locationStatus !== "granted") return;
		if (watchIdRef.current !== null) return;
		if (!navigator.geolocation) return;

		watchIdRef.current = navigator.geolocation.watchPosition(
			(pos) => {
				const { latitude: lat, longitude: lon } = pos.coords;
				lastPosRef.current = { lat, lon };
				if (!map.current) return;
				if (!userMarkerRef.current) {
					const el = createUserMarkerEl();
					userMarkerRef.current = new mapboxgl.Marker(el)
						.setLngLat([lon, lat])
						.addTo(map.current);
				} else {
					userMarkerRef.current.setLngLat([lon, lat]);
				}
			},
			(err) => console.error(err),
			{ enableHighAccuracy: true, maximumAge: 10000 },
		);
	}, [locationStatus]); // eslint-disable-line react-hooks/exhaustive-deps

	// When location is denied, upgrade existing muted markers to full-detail style in-place.
	// This mirrors the resolveMarkerStyles approach but without the nearby API call.
	useEffect(() => {
		if (locationStatus !== "denied") return;
		if (markerElsRef.current.size === 0) return;
		markerElsRef.current.forEach(({ el, art }) => {
			el.classList.remove("marker-all");
			el.classList.add("marker-nearby");
			el.style.opacity = "";
			el.style.filter = "";
			el.onclick = (e) => {
				e.stopPropagation();
				setSheetContent({ art, type: "detailed" });
			};
		});
	}, [locationStatus]); // eslint-disable-line react-hooks/exhaustive-deps

	// Resize Mapbox canvas when the map tab is revealed after being hidden
	useEffect(() => {
		if (isVisible && map.current) {
			map.current.resize();
		}
	}, [isVisible]);

	useEffect(() => {
		const fetchData = async () => {
			if (!user) {
				setFavoritesLoading(false);
				return;
			}
			try {
				const [visitedRes, favRes] = await Promise.all([
					fetch("/api/artworks/visited", { credentials: "include" }),
					fetch("/api/artworks/favorites", { credentials: "include" }),
				]);
				if (visitedRes.ok) {
					const data = await visitedRes.json();
					// API returns objects [{objectid, ...}] — extract ids for Set membership checks
					setFoundIds(new Set((data ?? []).map((d) => d.objectid)));
				}
				if (favRes.ok) {
					const data = await favRes.json();
					setFavoritedIds(new Set((data ?? []).map((d) => d.objectid)));
				}
			} catch (err) {
				console.error("Failed to fetch user artwork data:", err);
			} finally {
				setFavoritesLoading(false);
			}
		};
		fetchData();
	}, []);

	useEffect(() => {
		localStorage.setItem(FOUND_STORAGE_KEY, JSON.stringify([...foundIds]));
	}, [foundIds]);

	async function markFound(objectid) {
		if (!user) return;
		try {
			await fetch("/api/artworks/visited", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ objectid }),
			});
			setFoundIds((prev) => {
				if (prev.has(objectid)) return prev;
				const next = new Set(prev);
				next.add(objectid);
				return next;
			});
		} catch (error) {
			console.error("Failed to update visited artworks:", error);
			alert("Something went wrong. Please try again.");
		}
	}

	async function verifyArtwork(art) {
		if (foundIds.has(art.objectid)) {
			alert("You've already found this artwork!");
			return;
		}
		try {
			let userLat, userLon;
			if (lastPosRef.current) {
				userLat = lastPosRef.current.lat;
				userLon = lastPosRef.current.lon;
			} else {
				const pos = await fetchGeoPosition();
				userLat = pos.coords.latitude;
				userLon = pos.coords.longitude;
				lastPosRef.current = { lat: userLat, lon: userLon };
			}
			const dist = haversineMeters(
				userLat,
				userLon,
				Number(art.lat),
				Number(art.lon),
			);
			if (dist <= VERIFY_RADIUS_M) {
				markFound(art.objectid);
				alert(
					`Found! You're ${Math.round(dist)} m from "${art.title || "this artwork"}".`,
				);
			} else {
				alert(
					`Too far — you're ${Math.round(dist)} m away. Get within ${VERIFY_RADIUS_M} m to verify.`,
				);
			}
		} catch (e) {
			console.error("Verify failed:", e);
			alert(
				"Couldn't get your location. Enable location services and try again.",
			);
		}
	}

	// Called when user taps "Enable Location" — must be a direct response to a user gesture
	// so iOS Safari will actually show the permission prompt.
	async function enableLocation() {
		setLocStatus("loading");
		try {
			const pos = await fetchGeoPosition();
			const { latitude: lat, longitude: lon } = pos.coords;
			geoPositionRef.current = { lat, lon };
			lastPosRef.current = { lat, lon };
			if (map.current) map.current.setCenter([lon, lat]);
			setLocStatus("granted");
			if (!isGuest) resolveMarkerStyles(lat, lon);
			else fetchNearbyData(lat, lon);
		} catch {
			setLocStatus("denied");
		}
	}

	function dismissDeniedBanner() {
		sessionStorage.setItem("artscape.locDeniedDismissed", "1");
		setDeniedBannerDismissed(true);
	}

	function clearMarkers() {
		markersRef.current.forEach((m) => m.remove());
		markersRef.current = [];
	}

	// Creates all markers immediately using the cached artworks prop.
	// showAllDetailed: full style + detailed sheet (guests and denied-location auth users).
	// Otherwise: muted style + succinct sheet — nearby upgrade happens in resolveMarkerStyles.
	function loadAllMarkers(artworksData) {
		clearMarkers();
		markerElsRef.current.clear();

		const showAllDetailed = isGuest || locationStatusRef.current === "denied";

		if (showAllDetailed) {
			artworksData.forEach((art) => {
				const el = createNearbyMarkerEl();
				el.onclick = () => setSheetContent({ art, type: "detailed" });
				const marker = new mapboxgl.Marker(el)
					.setLngLat([art.lon, art.lat])
					.addTo(map.current);
				markersRef.current.push(marker);
				markerElsRef.current.set(art.objectid, { el, art });
			});
		} else {
			artworksData.forEach((art) => {
				const el = createAllMarkerEl();
				// Muted state applied as inline styles — does not touch class-based marker design
				el.style.opacity = "0.45";
				el.style.filter = "grayscale(80%)";
				el.style.transition = "opacity 0.4s ease, filter 0.4s ease";
				el.onclick = () => setSheetContent({ art, type: "succinct" });
				const marker = new mapboxgl.Marker(el)
					.setLngLat([art.lon, art.lat])
					.addTo(map.current);
				markersRef.current.push(marker);
				markerElsRef.current.set(art.objectid, { el, art });
			});
		}
	}

	// Guest path: populates nearbyArtworks without touching marker DOM.
	async function fetchNearbyData(lat, lon) {
		if (nearbyFetchedRef.current) return;
		nearbyFetchedRef.current = true;
		try {
			const res = await fetch(`/api/artworks/nearby?lat=${lat}&lon=${lon}`);
			const nearbyData = await res.json();
			const nearbyWithDist = nearbyData.map((a) => ({
				...a,
				distance: Math.round(haversineMeters(lat, lon, a.lat, a.lon)),
			}));
			setNearbyArtworks(nearbyWithDist.slice(0, 3));
		} catch (e) {
			console.error("Could not fetch nearby artworks", e);
			nearbyFetchedRef.current = false;
		}
	}

	// Fetches /api/artworks/nearby, then mutates existing marker DOM elements in-place.
	// Nearby: upgrade to marker-nearby class, remove muted styles, pop-in transform, detailed sheet.
	// Far: opacity 0.7, clear grayscale.
	async function resolveMarkerStyles(lat, lon) {
		if (stylesResolvedRef.current) return;
		// If markers haven't been created yet (geo beat artworks), bail out —
		// the artworks useEffect will call us again once markers exist.
		if (!markerElsRef.current.size) return;
		stylesResolvedRef.current = true;
		try {
			const res = await fetch(`/api/artworks/nearby?lat=${lat}&lon=${lon}`);
			const nearbyData = await res.json();

			const nearbyWithDist = nearbyData.map((a) => ({
				...a,
				distance: Math.round(haversineMeters(lat, lon, a.lat, a.lon)),
			}));
			setNearbyArtworks(nearbyWithDist.slice(0, 3));

			const nearbyIds = new Set(nearbyData.map((a) => a.objectid));

			markerElsRef.current.forEach(({ el, art }, objectid) => {
				if (nearbyIds.has(objectid)) {
					// Upgrade to nearby style — classList ops preserve any classes
					// Mapbox has added (e.g. mapboxgl-marker, anchor class)
					el.classList.remove("marker-all");
					el.classList.add("marker-nearby");
					// Remove muted inline styles
					el.style.opacity = "";
					el.style.filter = "";
					// Pop-in via keyframe animation on the inner visual element —
					// keeps Mapbox's transform: translate3d() on the root untouched
					const inner = el.querySelector(".marker-inner");
					if (inner) {
						inner.classList.add("marker-popin");
						inner.addEventListener(
							"animationend",
							() => inner.classList.remove("marker-popin"),
							{ once: true },
						);
					}
					// Reassign click handler to detailed sheet
					el.onclick = (e) => {
						e.stopPropagation();
						setSheetContent({ art, type: "detailed" });
					};
				} else {
					el.style.opacity = "0.7";
					el.style.filter = "";
				}
			});

		} catch (e) {
			console.error("Could not resolve marker styles", e);
			// Allow a retry on error
			stylesResolvedRef.current = false;
		}
	}

	useEffect(() => {
		if (mapInitialized.current) return;
		mapInitialized.current = true;

		map.current = new mapboxgl.Map({
			container: mapContainer.current,
			style: "mapbox://styles/mapbox/streets-v12",
			center: [-74.6514, 40.343],
			zoom: 15,
		});

		map.current.on("load", () => {
			// Load markers now if artworks already arrived; otherwise the artworks
			// useEffect will call loadAllMarkers once they come in.
			if (artworksRef.current.length > 0 && !markersLoadedRef.current) {
				markersLoadedRef.current = true;
				loadAllMarkers(artworksRef.current);
			}

			// Silently get location when permission is already granted (no prompt needed).
			// Only used from the pre-check path — not exposed to JSX.
			const doSilentGet = async () => {
				try {
					const pos = await fetchGeoPosition();
					const { latitude: lat, longitude: lon } = pos.coords;
					geoPositionRef.current = { lat, lon };
					lastPosRef.current = { lat, lon };
					if (map.current) map.current.setCenter([lon, lat]);
					locationStatusRef.current = "granted";
					setLocationStatus("granted");
					if (!isGuest) resolveMarkerStyles(lat, lon);
					else fetchNearbyData(lat, lon);
				} catch {
					locationStatusRef.current = "denied";
					setLocationStatus("denied");
				}
			};

			// Permission pre-check: skip the prompt banner if permission is already known.
			// navigator.permissions is unavailable on older iOS Safari — wrap in try/catch.
			try {
				navigator.permissions
					.query({ name: "geolocation" })
					.then((result) => {
						if (result.state === "granted") {
							doSilentGet();
						} else if (result.state === "denied") {
							locationStatusRef.current = "denied";
							setLocationStatus("denied");
						}
						// result.state === 'prompt' → leave as 'pending', banner will show
					})
					.catch(() => {
						// permissions.query returned a rejected promise — leave as pending
					});
			} catch {
				// navigator.permissions not available (old iOS Safari) — leave as pending
			}
		});
	}, []);

	const panelVisible = !panelMinimized && !sheetContent;
	const pillVisible = panelMinimized && !sheetContent;

	return (
		<>
			<div
				ref={mapContainer}
				className={`map-container ${isGuest ? "map-container-guest" : "map-container-auth"}`}
			/>
			<ScavengerSidebar
				open={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				artworks={artworks}
				foundIds={foundIds}
			/>
			<NearestArtworksPanel
				artworks={nearbyArtworks}
				onSelect={(art) => setSheetContent({ art, type: "detailed" })}
				hidden={!panelVisible}
				onMinimize={() => setPanelMinimized(true)}
			/>
			{pillVisible && (
				<button
					className={`restore-pill${isGuest ? " restore-pill--guest" : ""}`}
					onClick={() => setPanelMinimized(false)}
					aria-label="Show nearest artworks"
				>
					↑ Artworks
				</button>
			)}

			{/* Location prompt banner — shown while we're waiting for user to enable location */}
			{!isGuest && (locationStatus === "pending" || locationStatus === "loading") && (
				<div className="loc-banner loc-banner-prompt">
					<span className="loc-banner-text">
						📍 Find the 3 artworks closest to you →
					</span>
					<button
						className="loc-banner-btn"
						onClick={enableLocation}
						disabled={locationStatus === "loading"}
					>
						{locationStatus === "loading" ? "Locating…" : "Enable Location"}
					</button>
				</div>
			)}

			{/* Location denied banner — dismissable for the session */}
			{!isGuest && locationStatus === "denied" && !deniedBannerDismissed && (
				<div className="loc-banner loc-banner-denied">
					<span className="loc-banner-text">
						📍 Location off · Showing all artworks ·{" "}
						<button
							className="loc-banner-link"
							onClick={() => setShowDeniedTooltip((v) => !v)}
						>
							How to enable ↗
						</button>
					</span>
					<button
						className="loc-banner-dismiss"
						onClick={dismissDeniedBanner}
						aria-label="Dismiss"
					>
						✕
					</button>
					{showDeniedTooltip && (
						<div className="loc-denied-tooltip">
							<strong>Safari (iOS):</strong> Settings → Privacy &amp; Security → Location Services → Safari → Allow
							<br />
							<strong>Chrome (Android):</strong> Settings → Site Settings → Location → Allow
						</div>
					)}
				</div>
			)}

			<BottomSheet
				key={sheetContent?.art?.objectid}
				content={sheetContent}
				onClose={() => setSheetContent(null)}
				onVerify={verifyArtwork}
				isFound={
					sheetContent?.art
						? foundIds.has(sheetContent.art.objectid)
						: false
				}
				isFavorited={
					sheetContent?.art
						? favoritedIds.has(sheetContent.art.objectid)
						: false
				}
				isGuest={isGuest}
				user={user}
				favoritesLoading={favoritesLoading}
				locationStatus={locationStatus}
			/>
		</>
	);
}
