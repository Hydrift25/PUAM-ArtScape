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

export default function MapPage({ isGuest = false }) {
	const { user } = useAuth();
	const mapContainer = useRef(null);
	const map = useRef(null);
	const markersRef = useRef([]);
	const userMarkerRef = useRef(null);
	const lastPosRef = useRef(null);
	const [sheetContent, setSheetContent] = useState(null);
	const [allArtworks, setAllArtworks] = useState([]);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [foundIds, setFoundIds] = useState(new Set());
	const [nearbyArtworks, setNearbyArtworks] = useState([]);

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

	async function loadArtworks(lat, lon) {
		try {
			const [nearbyRes, allRes] = await Promise.all([
				fetch(`/api/artworks/nearby?lat=${lat}&lon=${lon}`),
				fetch("/api/artworks"),
			]);
			const nearbyData = await nearbyRes.json();
			const allData = await allRes.json();
			setAllArtworks(allData);

			// Compute distances for NearestArtworksPanel (auth only)
			const nearbyWithDist = nearbyData.map((a) => ({
				...a,
				distance: Math.round(haversineMeters(lat, lon, a.lat, a.lon)),
			}));
			setNearbyArtworks(nearbyWithDist.slice(0, 3));

			const nearbyIds = new Set(nearbyData.map((a) => a.objectid));
			clearMarkers();

			if (isGuest) {
				// Guest: every artwork uses nearby-style marker, every click opens detailed sheet
				allData.forEach((art) => {
					const el = createNearbyMarkerEl();
					const marker = new mapboxgl.Marker(el)
						.setLngLat([art.lon, art.lat])
						.addTo(map.current);
					el.addEventListener("click", () =>
						setSheetContent({ art, type: "detailed" }),
					);
					markersRef.current.push(marker);
				});
			} else {
				// Auth: all markers use BottomSheet
				allData.forEach((art) => {
					if (nearbyIds.has(art.objectid)) return;

					const el = createAllMarkerEl();
					const marker = new mapboxgl.Marker(el)
						.setLngLat([art.lon, art.lat])
						.addTo(map.current);
					el.addEventListener("click", () =>
						setSheetContent({ art, type: "succinct" }),
					);
					markersRef.current.push(marker);
				});

				nearbyData.forEach((art) => {
					const el = createNearbyMarkerEl();
					const marker = new mapboxgl.Marker(el)
						.setLngLat([art.lon, art.lat])
						.addTo(map.current);
					el.addEventListener("click", (e) => {
						e.stopPropagation();
						setSheetContent({ art, type: "detailed" });
					});
					markersRef.current.push(marker);
				});
			}
		} catch (e) {
			console.error("Could not load map data", e);
		}
	}

	useEffect(() => {
		if (map.current) return;

		map.current = new mapboxgl.Map({
			container: mapContainer.current,
			style: "mapbox://styles/mapbox/streets-v12",
			center: [-74.6514, 40.343],
			zoom: 15,
		});

		map.current.on("load", () => {
			navigator.geolocation.getCurrentPosition(
				(pos) => {
					map.current.setCenter([
						pos.coords.longitude,
						pos.coords.latitude,
					]);
					loadArtworks(pos.coords.latitude, pos.coords.longitude);
				},
				() => loadArtworks(40.343, -74.6514),
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
				artworks={allArtworks}
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