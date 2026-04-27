import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import BottomSheet from "../components/BottomSheet";
import DirectionsPanel from "../components/DirectionsPanel";
import NearestArtworksPanel from "../components/NearestArtworksPanel";
import SearchBar from "../components/SearchBar";
import {
	createNearbyMarkerEl,
	createAllMarkerEl,
	createUserMarkerEl,
} from "../components/ArtworkMarker";
import { useAuth } from "../context/AuthContext";

const FOUND_STORAGE_KEY = "artscape.foundIds";
const VERIFY_STATE = { PENDING: 0, ACCEPTED: 1, FAILED_LOCATION: 2, FAILED_IMAGE: 3 };
const DEV_BYPASS_LOCATION = import.meta.env.VITE_DEV_BYPASS_LOCATION === "true";

function CrosshairIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" xmlns="http://www.w3.org/2000/svg">
			<circle cx="10" cy="10" r="7.5" />
			<line x1="10" y1="1" x2="10" y2="5" />
			<line x1="10" y1="15" x2="10" y2="19" />
			<line x1="1" y1="10" x2="5" y2="10" />
			<line x1="15" y1="10" x2="19" y2="10" />
		</svg>
	);
}

function NavigationArrowIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
			<path d="M10 2 L18 18 L10 14 L2 18 Z" />
		</svg>
	);
}

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

function getBearing(lat1, lon1, lat2, lon2) {
	const dLon = (lon2 - lon1) * Math.PI / 180;
	const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
	const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
		Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
	return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
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

export default function MapPage({ isGuest = false, artworks = [], isVisible = true, setUserLocation = null }) {
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
	// Tracks the last lat/lon where nearby data was fetched — used to debounce movement updates (>10m threshold)
	const lastNearbyRefreshPosRef = useRef(null);

	// 'pending' | 'loading' | 'granted' | 'denied'
	const [locationStatus, setLocationStatus] = useState("pending");
	const [showDeniedTooltip, setShowDeniedTooltip] = useState(false);
	const [deniedBannerDismissed, setDeniedBannerDismissed] = useState(
		() => sessionStorage.getItem("artscape.locDeniedDismissed") === "1",
	);
	const [sheetContent, setSheetContent] = useState(null);
	const [findsMap, setFindsMap] = useState(new Map());
	const [favoritedIds, setFavoritedIds] = useState(new Set());
	const [nearbyArtworks, setNearbyArtworks] = useState([]);
	const [panelMinimized, setPanelMinimized] = useState(false);
	// True until both /api/artworks/visited and /api/artworks/favorites resolve
	const [favoritesLoading, setFavoritesLoading] = useState(true);

	const [navigationState, setNavigationState] = useState(null);
	const [showRecenter, setShowRecenter] = useState(false);
	const preNavCameraRef = useRef(null);
	// Mirrors navigationState for closure access in marker onclick handlers
	const navigationStateRef = useRef(null);
	const userInteractingRef = useRef(false);
	const onPositionUpdateRef = useRef(null);

	// Updates both the ref (for closure access) and the state (for rendering).
	// Also writes to sessionStorage so ScavengerPage can initialize without a flash.
	function setLocStatus(status) {
		locationStatusRef.current = status;
		setLocationStatus(status);
		if (status === "granted" || status === "denied") {
			sessionStorage.setItem("artscape.locationStatus", status);
		}
	}

	// Keep ref in sync with prop
	useEffect(() => {
		artworksRef.current = artworks;
	}, [artworks]);

	useEffect(() => {
		navigationStateRef.current = navigationState;
	}, [navigationState]);

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
		if (DEV_BYPASS_LOCATION) return;
		if (locationStatus !== "granted") return;
		if (watchIdRef.current !== null) return;
		if (!navigator.geolocation) return;

		watchIdRef.current = navigator.geolocation.watchPosition(
			(pos) => {
				const { latitude: lat, longitude: lon } = pos.coords;
				lastPosRef.current = { lat, lon };
				setUserLocation?.({ lat, lon });
				if (!map.current) return;
				if (!userMarkerRef.current) {
					const el = createUserMarkerEl();
					userMarkerRef.current = new mapboxgl.Marker(el)
						.setLngLat([lon, lat])
						.addTo(map.current);
				} else {
					userMarkerRef.current.setLngLat([lon, lat]);
				}
				const last = lastNearbyRefreshPosRef.current;
				const movedEnough = !last || haversineMeters(lat, lon, last.lat, last.lon) > 10;
				if (movedEnough) {
					if (!isGuest && stylesResolvedRef.current && markerElsRef.current.size > 0) {
						refreshNearbyState(lat, lon);
					} else if (isGuest && nearbyFetchedRef.current) {
						lastNearbyRefreshPosRef.current = { lat, lon };
						fetch(`/api/artworks/nearby?lat=${lat}&lon=${lon}`)
							.then((r) => r.json())
							.then((data) => setNearbyArtworks(data.map((a) => ({ ...a, distance: Math.round(a.distance_m) })).slice(0, 3)))
							.catch(() => {});
					}
				}
			},
			null,
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
				if (navigationStateRef.current) return;
				e.stopPropagation();
				setSheetContent({ art, type: "detailed" });
			};
		});
	}, [locationStatus]); // eslint-disable-line react-hooks/exhaustive-deps

	// Resize Mapbox canvas when the map tab is revealed; also refresh finds so markers
	// reflect any scavenger finds completed while on another tab.
	useEffect(() => {
		if (isVisible && map.current) {
			map.current.resize();
		}
		if (isVisible && user) {
			fetch("/api/artworks/visited", { credentials: "include" })
				.then((r) => (r.ok ? r.json() : null))
				.then((data) => {
					if (data) setFindsMap(new Map(data.map((d) => [d.objectid, d.verify_state])));
				})
				.catch(() => {});
		}
	}, [isVisible]); // eslint-disable-line react-hooks/exhaustive-deps

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
					setFindsMap(new Map((data ?? []).map((d) => [d.objectid, d.verify_state])));
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
		const accepted = [...findsMap.entries()]
			.filter(([, v]) => v === VERIFY_STATE.ACCEPTED)
			.map(([k]) => k);
		localStorage.setItem(FOUND_STORAGE_KEY, JSON.stringify(accepted));
	}, [findsMap]);

	const foundIds = new Set(
		[...findsMap.entries()]
			.filter(([, v]) => v === VERIFY_STATE.ACCEPTED)
			.map(([k]) => k)
	);

	async function toggleFavorite(objectid) {
		try {
			const res = await fetch("/api/artworks/favorite", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ objectid }),
			});
			if (res.ok) {
				const data = await res.json();
				setFavoritedIds((prev) => {
					const next = new Set(prev);
					if (data.favorited) next.add(objectid);
					else next.delete(objectid);
					return next;
				});
			}
		} catch (err) {
			console.error("Failed to update favorite:", err);
			alert("Something went wrong. Please try again.");
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
			setUserLocation?.({ lat, lon });
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

		const showAllDetailed = isGuest || locationStatusRef.current === "denied" || DEV_BYPASS_LOCATION;

		if (showAllDetailed) {
			artworksData.forEach((art) => {
				const el = createNearbyMarkerEl();
				el.onclick = () => {
					if (navigationStateRef.current) return;
					setSheetContent({ art, type: "detailed" });
				};
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
				el.onclick = () => {
					if (navigationStateRef.current) return;
					setSheetContent({ art, type: "succinct" });
				};
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
				distance: Math.round(a.distance_m),
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
				distance: Math.round(a.distance_m),
			}));
			setNearbyArtworks(nearbyWithDist.slice(0, 3));
			lastNearbyRefreshPosRef.current = { lat, lon };

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
						if (navigationStateRef.current) return;
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

	// Repeatable version of resolveMarkerStyles — no one-time guard, handles both
	// near→far and far→near transitions. Called from the watchPosition tick on movement >10m.
	async function refreshNearbyState(lat, lon) {
		if (!markerElsRef.current.size) return;
		lastNearbyRefreshPosRef.current = { lat, lon };
		try {
			const res = await fetch(`/api/artworks/nearby?lat=${lat}&lon=${lon}`);
			const nearbyData = await res.json();
			const nearbyWithDist = nearbyData.map((a) => ({
				...a,
				distance: Math.round(a.distance_m),
			}));
			setNearbyArtworks(nearbyWithDist.slice(0, 3));
			const nearbyIds = new Set(nearbyData.map((a) => a.objectid));
			markerElsRef.current.forEach(({ el, art }, objectid) => {
				const isNearby = nearbyIds.has(objectid);
				const wasNearby = el.classList.contains("marker-nearby");
				if (isNearby && !wasNearby) {
					el.classList.remove("marker-all");
					el.classList.add("marker-nearby");
					el.style.opacity = "";
					el.style.filter = "";
					const inner = el.querySelector(".marker-inner");
					if (inner) {
						inner.classList.add("marker-popin");
						inner.addEventListener(
							"animationend",
							() => inner.classList.remove("marker-popin"),
							{ once: true },
						);
					}
					el.onclick = (e) => {
						if (navigationStateRef.current) return;
						e.stopPropagation();
						setSheetContent({ art, type: "detailed" });
					};
				} else if (!isNearby && wasNearby) {
					el.classList.remove("marker-nearby");
					el.classList.add("marker-all");
					el.style.opacity = "0.7";
					el.style.filter = "";
					el.onclick = () => {
						if (navigationStateRef.current) return;
						setSheetContent({ art, type: "succinct" });
					};
				}
			});
		} catch (e) {
			console.error("Could not refresh nearby state", e);
		}
	}

	async function fetchRoute(art) {
		if (!lastPosRef.current) return;

		preNavCameraRef.current = {
			center: map.current.getCenter(),
			zoom: map.current.getZoom(),
			pitch: map.current.getPitch(),
			bearing: map.current.getBearing(),
		};

		const origin = `${lastPosRef.current.lon},${lastPosRef.current.lat}`;
		const destination = `${art.lon},${art.lat}`;
		const token = import.meta.env.VITE_MAPBOX_TOKEN;
		const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${origin};${destination}?steps=true&geometries=geojson&overview=full&access_token=${token}`;

		let routeData;
		try {
			const res = await fetch(url);
			const json = await res.json();
			if (!json.routes || json.routes.length === 0) {
				return;
			}
			routeData = json.routes[0];
		} catch (err) {
			console.error("Directions API error:", err);
			return;
		}

		const coords = routeData.geometry.coordinates;
		const steps = routeData.legs[0].steps.map((s) => ({
			instruction: s.maneuver.instruction,
			distance: s.distance,
		}));

		map.current.getSource("route").setData({
			type: "Feature",
			geometry: routeData.geometry,
		});
		map.current.getSource("route-traveled").setData({
			type: "Feature",
			geometry: { type: "LineString", coordinates: [] },
		});

		const lons = coords.map((c) => c[0]);
		const lats = coords.map((c) => c[1]);
		map.current.fitBounds(
			[
				[Math.min(...lons), Math.min(...lats)],
				[Math.max(...lons), Math.max(...lats)],
			],
			{ padding: { top: 80, bottom: 280, left: 40, right: 40 }, duration: 800 },
		);

		setNavigationState({
			mode: "preview",
			route: coords,
			steps,
			destination: { lat: art.lat, lng: art.lon, title: art.title, objectid: art.objectid },
			totalDistance: routeData.distance,
			totalDuration: routeData.duration,
			watchId: null,
		});
	}

	function beginNavigation() {
		setNavigationState((prev) => {
			if (!prev || prev.mode !== "preview") return prev;

			const watchId = DEV_BYPASS_LOCATION
				? -1
				: navigator.geolocation.watchPosition(
					(position) => onPositionUpdate(position, prev.route, prev.destination),
					null,
					{ enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
				);

			return {
				...prev,
				mode: "navigating",
				distanceRemaining: prev.totalDistance,
				watchId,
			};
		});

		// flyTo is outside the setter — safe from double-invocation in strict mode
		const current = navigationStateRef.current;
		if (current && map.current && lastPosRef.current) {
			map.current.flyTo({
				center: [lastPosRef.current.lon, lastPosRef.current.lat],
				zoom: 17,
				pitch: 60,
				bearing: getBearing(
					lastPosRef.current.lat, lastPosRef.current.lon,
					current.destination.lat, current.destination.lng,
				),
				duration: 1000,
				essential: true,
			});
		}
	}

	function onPositionUpdate(position, routeCoords, destination) {
		const { latitude, longitude, accuracy } = position.coords;
		lastPosRef.current = { lat: latitude, lon: longitude };

		const distanceRemaining = haversineMeters(
			latitude,
			longitude,
			destination.lat,
			destination.lng,
		);

		if (accuracy <= 30 && map.current) {
			let closestIdx = 0;
			let minDist = Infinity;
			routeCoords.forEach(([cLon, cLat], idx) => {
				const d = haversineMeters(latitude, longitude, cLat, cLon);
				if (d < minDist) {
					minDist = d;
					closestIdx = idx;
				}
			});

			const traveled = routeCoords.slice(0, closestIdx + 1);
			if (traveled.length >= 2) {
				map.current.getSource("route-traveled").setData({
					type: "Feature",
					geometry: { type: "LineString", coordinates: traveled },
				});
			}
		}

		if (accuracy <= 30 && map.current && !userInteractingRef.current) {
			map.current.easeTo({
				center: [longitude, latitude],
				bearing: getBearing(latitude, longitude, destination.lat, destination.lng),
				pitch: 60,
				duration: 1000,
				essential: false,
			});
		}

		setNavigationState((prev) => {
			if (!prev || prev.mode !== "navigating") return prev;
			if (distanceRemaining < 15) {
				return { ...prev, distanceRemaining: 0, arrived: true };
			}
			return { ...prev, distanceRemaining };
		});
	}

	function endNavigation() {
		userInteractingRef.current = false;
		setShowRecenter(false);

		setNavigationState((prev) => {
			if (prev?.watchId && prev.watchId !== -1) navigator.geolocation.clearWatch(prev.watchId);
			return null;
		});

		if (map.current) {
			map.current.getSource("route").setData({
				type: "Feature",
				geometry: { type: "LineString", coordinates: [] },
			});
			map.current.getSource("route-traveled").setData({
				type: "Feature",
				geometry: { type: "LineString", coordinates: [] },
			});
			if (preNavCameraRef.current) {
				map.current.flyTo({
					center: preNavCameraRef.current.center,
					zoom: preNavCameraRef.current.zoom,
					pitch: preNavCameraRef.current.pitch ?? 0,
					bearing: preNavCameraRef.current.bearing ?? 0,
					duration: 800,
				});
			}
		}
	}

	onPositionUpdateRef.current = onPositionUpdate;

	useEffect(() => {
		if (mapInitialized.current) return;
		mapInitialized.current = true;

		map.current = new mapboxgl.Map({
			container: mapContainer.current,
			style: "mapbox://styles/mapbox/streets-v12",
			center: [-74.6514, 40.343],
			zoom: 15,
			minZoom: 13,
			maxZoom: 20,
			maxBounds: [[-74.678, 40.332], [-74.632, 40.360]]
		});

		map.current.on("load", () => {
			map.current.addSource("route", {
				type: "geojson",
				data: { type: "Feature", geometry: { type: "LineString", coordinates: [] } },
			});
			map.current.addSource("route-traveled", {
				type: "geojson",
				data: { type: "Feature", geometry: { type: "LineString", coordinates: [] } },
			});
			map.current.addLayer({
				id: "route-line",
				type: "line",
				source: "route",
				layout: { "line-join": "round", "line-cap": "round" },
				paint: { "line-color": "#E8450A", "line-width": 5, "line-opacity": 0.85 },
			});
			map.current.addLayer({
				id: "route-line-traveled",
				type: "line",
				source: "route-traveled",
				layout: { "line-join": "round", "line-cap": "round" },
				paint: { "line-color": "#999999", "line-width": 5, "line-opacity": 0.5 },
			});

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
					setUserLocation?.({ lat, lon });
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

			if (DEV_BYPASS_LOCATION) {
				// Demo mode: start at the center of Princeton campus with a synthetic position.
				const demoLat = 40.3435;
				const demoLon = -74.6514;
				geoPositionRef.current = { lat: demoLat, lon: demoLon };
				lastPosRef.current = { lat: demoLat, lon: demoLon };
				setUserLocation?.({ lat: demoLat, lon: demoLon });
				map.current.setCenter([demoLon, demoLat]);
				locationStatusRef.current = "granted";
				setLocationStatus("granted");
				const demoEl = createUserMarkerEl();
				userMarkerRef.current = new mapboxgl.Marker(demoEl)
					.setLngLat([demoLon, demoLat])
					.addTo(map.current);
				if (!isGuest) resolveMarkerStyles(demoLat, demoLon);
				else fetchNearbyData(demoLat, demoLon);
			} else {
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
			}

			const interactionStart = () => {
				userInteractingRef.current = true;
				setShowRecenter(true);
			};
			map.current.on("dragstart", interactionStart);
			map.current.on("pitchstart", interactionStart);
			map.current.on("rotatestart", interactionStart);
		});
	}, []);

	useEffect(() => {
		return () => {
			if (navigationState?.watchId && navigationState.watchId !== -1) {
				navigator.geolocation.clearWatch(navigationState.watchId);
			}
		};
	}, [navigationState?.watchId]);

	useEffect(() => {
		if (!DEV_BYPASS_LOCATION) return;
		if (locationStatus !== "granted") return;

		const STEP_LAT = 0.00018;  // ~20 m north/south
		const STEP_LON = 0.000236; // ~20 m east/west at Princeton's latitude

		const handleKeyDown = (e) => {
			if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
			e.preventDefault();

			const current = lastPosRef.current;
			if (!current) return;

			let { lat, lon } = current;
			if (e.key === "ArrowUp") lat += STEP_LAT;
			else if (e.key === "ArrowDown") lat -= STEP_LAT;
			else if (e.key === "ArrowRight") lon += STEP_LON;
			else if (e.key === "ArrowLeft") lon -= STEP_LON;

			lastPosRef.current = { lat, lon };
			geoPositionRef.current = { lat, lon };
			setUserLocation?.({ lat, lon });

			if (userMarkerRef.current) {
				userMarkerRef.current.setLngLat([lon, lat]);
			}

			const navState = navigationStateRef.current;
			if (navState?.mode === "navigating") {
				const syntheticPos = { coords: { latitude: lat, longitude: lon, accuracy: 1 } };
				onPositionUpdateRef.current?.(syntheticPos, navState.route, navState.destination);
			} else {
				const last = lastNearbyRefreshPosRef.current;
				if (!last || haversineMeters(lat, lon, last.lat, last.lon) > 10) {
					if (!isGuest && stylesResolvedRef.current && markerElsRef.current.size > 0) {
						refreshNearbyState(lat, lon);
					} else if (isGuest) {
						lastNearbyRefreshPosRef.current = { lat, lon };
						fetch(`/api/artworks/nearby?lat=${lat}&lon=${lon}`)
							.then((r) => r.json())
							.then((data) => setNearbyArtworks(data.map((a) => ({ ...a, distance: Math.round(a.distance_m) })).slice(0, 3)))
							.catch(() => {});
					}
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [locationStatus]); // eslint-disable-line react-hooks/exhaustive-deps

	function handleMapRecenter() {
		if (!map.current) return;
		const center =
			locationStatus === "granted" && lastPosRef.current
				? [lastPosRef.current.lon, lastPosRef.current.lat]
				: [-74.6551, 40.3457];
		map.current.flyTo({ center, zoom: 15, pitch: 0, bearing: 0, duration: 600 });
	}

	function handleRecenter() {
		userInteractingRef.current = false;
		setShowRecenter(false);
		if (lastPosRef.current && navigationState && map.current) {
			map.current.flyTo({
				center: [lastPosRef.current.lon, lastPosRef.current.lat],
				bearing: getBearing(
					lastPosRef.current.lat, lastPosRef.current.lon,
					navigationState.destination.lat, navigationState.destination.lng,
				),
				pitch: 60,
				zoom: 17,
				duration: 600,
				essential: true,
			});
		}
	}

	const panelVisible = !panelMinimized && !sheetContent && !navigationState;
	const pillVisible = panelMinimized && !sheetContent && !navigationState;

	return (
		<>
			<div
				ref={mapContainer}
				className={`map-container ${isGuest ? "map-container-guest" : "map-container-auth"}`}
			/>
			<SearchBar
				artworks={artworks}
				onSelect={(art) => {
					if (!map.current) return;
					map.current.flyTo({
						center: [art.lon, art.lat],
						zoom: 18,
						duration: 700,
						essential: true,
					});
					const showDetailed =
						isGuest ||
						locationStatus === "denied" ||
						DEV_BYPASS_LOCATION ||
						nearbyArtworks.some((a) => a.objectid === art.objectid);
					setSheetContent({ art, type: showDetailed ? "detailed" : "succinct" });
				}}
			/>
			<div className="map-controls">
				<button
					className="map-control-btn"
					onClick={() => map.current?.zoomIn()}
					aria-label="Zoom in"
				>
					+
				</button>
				<button
					className="map-control-btn"
					onClick={() => map.current?.zoomOut()}
					aria-label="Zoom out"
				>
					−
				</button>
				<button
					className="map-control-btn"
					onClick={handleMapRecenter}
					aria-label="Recenter map"
				>
					<CrosshairIcon />
				</button>
			</div>
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

			{DEV_BYPASS_LOCATION && (
				<div className="demo-mode-banner">
					Demo Mode · Arrow keys to move
				</div>
			)}

			{/* Location prompt banner — shown while we're waiting for user to enable location */}
			{!DEV_BYPASS_LOCATION && (locationStatus === "pending" || locationStatus === "loading") && (
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
			{!DEV_BYPASS_LOCATION && locationStatus === "denied" && !deniedBannerDismissed && (
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
				onFetchRoute={fetchRoute}
				onToggleFavorite={toggleFavorite}
				navigationMode={!!navigationState}
				verifyState={findsMap.get(sheetContent?.art?.objectid) ?? null}
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
			{navigationState && (
				<DirectionsPanel
					navigationState={navigationState}
					onBeginNavigation={beginNavigation}
					onEndNavigation={endNavigation}
					isGuest={isGuest}
				/>
			)}
			{navigationState?.mode === "navigating" && (
				<button
					className={`recenter-btn${showRecenter ? " recenter-btn--visible" : " recenter-btn--hidden"}${isGuest ? " recenter-btn--guest" : ""}`}
					onClick={handleRecenter}
					aria-label="Re-center map"
				>
					<NavigationArrowIcon />
				</button>
			)}
		</>
	);
}
