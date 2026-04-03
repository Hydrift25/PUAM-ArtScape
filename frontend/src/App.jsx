import { BrowserRouter, Routes, Route } from "react-router-dom";
import MapPage from "./pages/MapPage";
// import FavoritesPage from './pages/FavoritesPage'
// import ScavengerPage from './pages/ScavengerPage'
// import LeaderboardPage from './pages/LeaderboardPage'
// <Route path="/favorite" element={<FavoritesPage />} />
// <Route path="/scavenger" element={<ScavengerPage />} />
// <Route path="/leaderboard" element={<LeaderboardPage />} />

export default function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<MapPage />} />
			</Routes>
		</BrowserRouter>
	);
}
