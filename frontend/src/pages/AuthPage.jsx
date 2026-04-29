import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { AboutModal, HelpModal } from "../components/InfoModals";

function MapPinIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="32" height="32">
			<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
		</svg>
	);
}

function GoogleIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
			<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
			<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
			<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
			<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
		</svg>
	);
}

export default function AuthPage() {
	const { login, continueAsGuest } = useAuth();
	const [showAbout, setShowAbout] = useState(false);
	const [showHelp, setShowHelp] = useState(false);
	const cancelled = new URLSearchParams(window.location.search).get("auth_cancelled") === "true";

	return (
		<div className="auth-page">
			<div className="auth-content">
				<div className="auth-icon-circle">
					<MapPinIcon />
				</div>
				<h1 className="auth-title">Princeton ArtScape</h1>
				<p className="auth-subtitle">There's art around every corner. Start walking!</p>
				<div className="auth-card">
					<h2 className="auth-card-heading">Welcome</h2>
					{cancelled
						? <p className="auth-card-subheading auth-cancelled">Sign-in was cancelled. Try again?</p>
						: <p className="auth-card-subheading">Sign in to start your art exploration journey</p>
					}
					<button className="auth-btn-google" onClick={login}>
						<GoogleIcon />
						Sign in with Google
					</button>
					<hr className="auth-divider" />
					<button className="auth-btn-guest" onClick={continueAsGuest}>
						Continue to Map
					</button>
				</div>
				<div className="auth-stats">
					<div className="auth-stat-item">
						<span className="auth-stat-value">50+</span>
						<span className="auth-stat-label">Artworks</span>
					</div>
					<div className="auth-stat-item">
						<span className="auth-stat-value">GPS</span>
						<span className="auth-stat-label">Tracking</span>
					</div>
					<div className="auth-stat-item">
						<span className="auth-stat-value">Hunt</span>
						<span className="auth-stat-label">Scavenger</span>
					</div>
				</div>
			</div>

			<footer className="auth-footer">
				<button className="auth-footer-link" onClick={() => setShowAbout(true)}>About</button>
				<button className="auth-footer-link" onClick={() => setShowHelp(true)}>Help</button>
			</footer>

			<AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />
			<HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
		</div>
	);
}
