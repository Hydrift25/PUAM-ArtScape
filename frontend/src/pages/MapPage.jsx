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
	const [sheetContent, setSheetContent] = useState(null);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [foundIds, setFoundIds] = useState(new Set());
	const [nearbyArtworks, setNearbyArtworks] = useState([]);

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
		}
		// If map isn't loaded yet, the map.on("load") callback handles initial marker creation
	}, [artworks]); // eslint-disable-line react-hooks/exhaustive-deps

	// Resize Mapbox canvas when the map tab is revealed after being hidden
	useEffect(() => {
		if (isVisible && map.current) {
			map.current.resize();
		}
	}, [isVisible]);

	useEffect(() => {
		const fetchData = async () => {
			if (!user) {
				setFoundIds(new Set());
				return;
			}
			try {
				const res = await fetch("/api/artworks/visited", {
					credentials: "include",
				});
				if (!res.ok) {
					setFoundIds(new Set());
					return;
				}
				const data = await res.json();
				setFoundIds(new Set(data ?? []));
			} catch (err) {
				console.error("Failed to fetch visited artworks:", err);
				setFoundIds(new Set());
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
				const pos = await getCurrentPosition();
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

	function clearMarkers() {
		markersRef.current.forEach((m) => m.remove());
		markersRef.current = [];
	}

	// Creates all markers immediately using the cached artworks prop.
	// Guests: full style, detailed sheet on click.
	// Auth: muted style (inline), succinct sheet on click — nearby upgrade happens in resolveMarkerStyles.
	function loadAllMarkers(artworksData) {
		clearMarkers();
		markerElsRef.current.clear();

		if (isGuest) {
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
				el.style.transition =
					"opacity 0.4s ease, filter 0.4s ease, transform 0.3s ease";
				el.onclick = () => setSheetContent({ art, type: "succinct" });
				const marker = new mapboxgl.Marker(el)
					.setLngLat([art.lon, art.lat])
					.addTo(map.current);
				markersRef.current.push(marker);
				markerElsRef.current.set(art.objectid, { el, art });
			});
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
					// Upgrade visual class to nearby style
					el.className = "custom-marker marker-nearby";
					// Remove muted inline styles
					el.style.opacity = "";
					el.style.filter = "";
					// Pop-in effect
					el.style.transform = "scale(1.15)";
					setTimeout(() => {
						el.style.transform = "scale(1)";
					}, 300);
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

			navigator.geolocation.getCurrentPosition(
				(pos) => {
					const { latitude: lat, longitude: lon } = pos.coords;
					geoPositionRef.current = { lat, lon };
					map.current.setCenter([lon, lat]);
					if (!isGuest) {
						resolveMarkerStyles(lat, lon);
					}
				},
				() => {
					geoPositionRef.current = { lat: 40.343, lon: -74.6514 };
					if (!isGuest) {
						resolveMarkerStyles(40.343, -74.6514);
					}
				},
			);

			navigator.geolocation.watchPosition(
				(pos) => {
					const { latitude: lat, longitude: lon } = pos.coords;
					lastPosRef.current = { lat, lon };
					if (!userMarkerRef.current) {
						const el = createUserMarkerEl();
						userMarkerRef.current = new mapboxgl.Marker(el)
							.setLngLat([lon, lat])
							.addTo(map.current);
						map.current.flyTo({ center: [lon, lat], zoom: 14 });
					} else {
						userMarkerRef.current.setLngLat([lon, lat]);
					}
				},
				(err) => console.error(err),
				{ enableHighAccuracy: true, maximumAge: 10000 },
			);
		});
	}, []);

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
			{!isGuest && (
				<NearestArtworksPanel
					artworks={nearbyArtworks}
					onSelect={(art) => setSheetContent({ art, type: "detailed" })}
					hidden={!!sheetContent}
				/>
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
				isGuest={isGuest}
				user={user}
			/>
		</>
	);
}
