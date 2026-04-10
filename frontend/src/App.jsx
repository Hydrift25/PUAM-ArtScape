import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import MapPage from "./pages/MapPage";
import AuthPage from "./pages/AuthPage";
import ScavengerPage from "./pages/ScavengerPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import ProfilePage from "./pages/ProfilePage";

function getInitials(name) {
	if (!name) return "?";
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

function MapIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
			<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
		</svg>
	);
}

function CameraIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
			<path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
		</svg>
	);
}

function TrophyIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
			<path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H8l-1 2h10l-1-2h-3v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
		</svg>
	);
}

function PersonIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
			<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
		</svg>
	);
}

function GuestNavbar() {
	const { login } = useAuth();
	return (
		<nav className="app-navbar">
			<div className="navbar-left">
				<span className="navbar-title">📍 Princeton Art Explorer</span>
				<span className="navbar-subtitle">Guest Mode · Map View Only</span>
			</div>
			<button className="navbar-signin-btn" onClick={login}>
				Sign In
			</button>
		</nav>
	);
}

function AuthNavbar() {
	const { user } = useAuth();
	const initials = getInitials(user?.display_name);
	return (
		<nav className="app-navbar">
			<div className="navbar-left">
				<span className="navbar-title">📍 Princeton Art Explorer</span>
				<span className="navbar-subtitle">Discover art across campus</span>
			</div>
			<div className="navbar-avatar">
				{user?.avatar_url ? (
					<img
						src={user.avatar_url}
						alt={initials}
						className="navbar-avatar-img"
					/>
				) : (
					<span>{initials}</span>
				)}
			</div>
		</nav>
	);
}

function BottomNav() {
	return (
		<nav className="bottom-nav">
			<NavLink
				to="/"
				end
				className={({ isActive }) =>
					`bottom-nav-tab${isActive ? " active" : ""}`
				}
			>
				<MapIcon />
				<span>Map</span>
			</NavLink>
			<NavLink
				to="/hunt"
				className={({ isActive }) =>
					`bottom-nav-tab${isActive ? " active" : ""}`
				}
			>
				<CameraIcon />
				<span>Hunt</span>
			</NavLink>
			<NavLink
				to="/leaderboard"
				className={({ isActive }) =>
					`bottom-nav-tab${isActive ? " active" : ""}`
				}
			>
				<TrophyIcon />
				<span>Leaderboard</span>
			</NavLink>
			<NavLink
				to="/profile"
				className={({ isActive }) =>
					`bottom-nav-tab${isActive ? " active" : ""}`
				}
			>
				<PersonIcon />
				<span>Profile</span>
			</NavLink>
		</nav>
	);
}

function AppContent() {
	const { user, loading, guest } = useAuth();

	if (loading) {
		return (
			<div className="auth-spinner-wrap">
				<div className="auth-spinner" />
			</div>
		);
	}

	if (!user && !guest) {
		return <AuthPage />;
	}

	const isGuest = !user && guest;

	return (
		<BrowserRouter>
			{isGuest ? (
				<>
					<GuestNavbar />
					<MapPage isGuest={true} />
				</>
			) : (
				<>
					<AuthNavbar />
					<Routes>
						<Route path="/" element={<MapPage isGuest={false} />} />
						<Route path="/hunt" element={<ScavengerPage />} />
						<Route path="/leaderboard" element={<LeaderboardPage />} />
						<Route path="/profile" element={<ProfilePage />} />
					</Routes>
					<BottomNav />
				</>
			)}
		</BrowserRouter>
	);
}

export default function App() {
	return (
		<AuthProvider>
			<AppContent />
		</AuthProvider>
	);
}