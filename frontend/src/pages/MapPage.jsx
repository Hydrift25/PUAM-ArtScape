import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import BottomSheet from "../components/BottomSheet";
import {
	createNearbyMarkerEl,
	createAllMarkerEl,
	createUserMarkerEl,
} from "../components/ArtworkMarker";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapPage() {
	const mapContainer = useRef(null);
	const map = useRef(null);
	const markersRef = useRef([]);
	const userMarkerRef = useRef(null);
	const [sheetContent, setSheetContent] = useState(null);

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
			<BottomSheet
				key={sheetContent?.art?.objectid}
				content={sheetContent}
				onClose={() => setSheetContent(null)}
			/>
		</>
	);
}
