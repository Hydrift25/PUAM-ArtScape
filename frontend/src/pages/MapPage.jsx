import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import BottomSheet from "../components/BottomSheet";
import ScavengerSidebar from "../components/ScavengerSidebar";
import {
	createNearbyMarkerEl,
	createAllMarkerEl,
	createUserMarkerEl,
} from "../components/ArtworkMarker";

const FOUND_STORAGE_KEY = "artscape.foundIds";
const VERIFY_RADIUS_M = 25;

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

export default function MapPage() {
	const mapContainer = useRef(null);
	const map = useRef(null);
	const markersRef = useRef([]);
	const userMarkerRef = useRef(null);
	const lastPosRef = useRef(null);
	const [sheetContent, setSheetContent] = useState(null);
	const [allArtworks, setAllArtworks] = useState([]);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [foundIds, setFoundIds] = useState(() => {
		try {
			const raw = localStorage.getItem(FOUND_STORAGE_KEY);
			return new Set(raw ? JSON.parse(raw) : []);
		} catch {
			return new Set();
		}
	});

	useEffect(() => {
		localStorage.setItem(
			FOUND_STORAGE_KEY,
			JSON.stringify([...foundIds]),
		);
	}, [foundIds]);

	function markFound(objectid) {
		setFoundIds((prev) => {
			if (prev.has(objectid)) return prev;
			const next = new Set(prev);
			next.add(objectid);
			return next;
		});
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
			alert("Couldn't get your location. Enable location services and try again.");
		}
	}

	window.verifyArtwork = (id) => {
		const art = allArtworks.find((a) => a.objectid === id);
		if (art) verifyArtwork(art);
	};

	function clearMarkers() {
		markersRef.current.forEach((m) => m.remove());
		markersRef.current = [];
	}

	async function toggleFavorite(id, buttonElement) {
		try {
			const res = await fetch(`/api/artworks/favorite?objectid=${id}`, {
				method: "POST",
			});

			if (res.ok) {
				const data = await res.json();
				if (data.favorited) {
					buttonElement.innerText = "💔 Unfavorite";
				} else {
					buttonElement.innerText = "❤️ Favorite";
				}
			}
			alert("Updated favorites!");
		} catch (error) {
			console.error("Failed to update favorite:", error);
			alert("Something went wrong. Please try again.");
		}
	}
	window.toggleFavorite = toggleFavorite;

	function getDetailedHTML(art) {
		const isFav = art.favorited;
		const buttonLabel = isFav ? "💔 Unfavorite" : "❤️ Favorite";
		const isFound = foundIds.has(art.objectid);
		const verifyLabel = isFound ? "✅ Found" : "📍 Verify I'm Here";
		const thumbnail = art.image_url
			? `${art.image_url}/full/600,/0/default.jpg`
			: null;

		return `
            <div style="width: 100%; min-width:220px; font-family: sans-serif; line-height: 1.5;">
                <b style="color: #FF5733; font-size: 12px; letter-spacing: 1px">CLOSEST ARTWORK</b>
                <h3 style="margin: 8px 0; font-size: 1.2rem">${art.title || "Untitled"}</h3>
                <p style="margin: 5px 0; font-size: 0.9rem;"><b>Date:</b> ${art.date_range || "N/A"}</p>
                ${thumbnail ? `<img src="${thumbnail}" style="width:100%; height: auto; object-fit: contain; border-radius:8px; margin: 10px 0;"/>` : ""}
                <p style="font-size: 15px; line-height: 1.4; margin-bottom: 20px">${art.description || ""}</p>
                <button onclick="verifyArtwork(${art.objectid})" ${isFound ? "disabled" : ""} style="width:100%; padding:10px; margin-bottom:8px; cursor: ${isFound ? "default" : "pointer"}; background: ${isFound ? "#e6f7ea" : "#fff0ec"}; border: 1px solid ${isFound ? "#9bd4ab" : "#ffb199"}; border-radius: 6px; font-weight: bold; color: #333;">
                    ${verifyLabel}
                </button>
                <button onclick="toggleFavorite(${art.objectid}, this)" style="width:100%; padding:10px; cursor: pointer; background: #f8f8f8; border: 1px solid #ddd; border-radius: 6px; font-weight: bold;">
                    ${buttonLabel}
                </button>
            </div>
        `;
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
			const nearbyIds = new Set(nearbyData.map((a) => a.objectid));

			clearMarkers();

			allData.forEach((art) => {
				if (nearbyIds.has(art.objectid)) return;

				const el = createAllMarkerEl();
				const marker = new mapboxgl.Marker(el)
					.setLngLat([art.lon, art.lat])
					.addTo(map.current);

				if (window.innerWidth > 600) {
					marker.setPopup(
						new mapboxgl.Popup({
							offset: 25,
							closeButton: false,
							className: "compact-popup",
						}).setHTML(
							`<h4>${art.title || "Unknown"}</h4><p>📍 Walk closer to reveal details.</p>`,
						),
					);
				} else {
					el.addEventListener("click", () =>
						setSheetContent({ art, type: "succinct" }),
					);
				}
				markersRef.current.push(marker);
			});

			nearbyData.forEach((art) => {
				const el = createNearbyMarkerEl();
				const marker = new mapboxgl.Marker(el)
					.setLngLat([art.lon, art.lat])
					.addTo(map.current);

				if (window.innerWidth > 600) {
					marker.setPopup(
						new mapboxgl.Popup({
							offset: 25,
							focusAfterOpen: false,
						}).setHTML(getDetailedHTML(art)),
					);
				} else {
					el.addEventListener("click", (e) => {
						e.stopPropagation();
						setSheetContent({ art, type: "detailed" });
					});
				}
				markersRef.current.push(marker);
			});
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
				style={{
					position: "absolute",
					top: 0,
					bottom: 0,
					width: "100%",
				}}
			/>
			<button
				onClick={() => setSidebarOpen((v) => !v)}
				style={{
					position: "fixed",
					top: 16,
					right: 16,
					zIndex: 999,
					padding: "10px 14px",
					background: "#fff",
					border: "1px solid #ddd",
					borderRadius: 8,
					boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
					cursor: "pointer",
					fontWeight: 600,
					fontFamily: "sans-serif",
				}}
			>
				🔍 Hunt ({foundIds.size}/{allArtworks.length})
			</button>
			<ScavengerSidebar
				open={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				artworks={allArtworks}
				foundIds={foundIds}
			/>
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
			/>
		</>
	);
}
