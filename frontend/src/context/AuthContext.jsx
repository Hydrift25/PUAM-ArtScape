import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);
	const [guest, setGuest] = useState(false);

	useEffect(() => {
		fetch("/api/auth/me", { credentials: 'include' })
			.then((res) => res.json())
			.then((data) => {
				setUser(data.user !== undefined ? data.user : data);
			})
			.catch(() => {
				setUser(null);
			})
			.finally(() => {
				setLoading(false);
			});
	}, []);

	function login() {
		window.location.href = "/api/auth/login";
	}

	async function logout() {
		try {
			await fetch("/api/auth/logout", { credentials: 'include' });
		} catch (_) {}
		setUser(null);
		setGuest(false);
	}

	function continueAsGuest() {
		setGuest(true);
	}

	return (
		<AuthContext.Provider value={{ user, loading, guest, login, logout, continueAsGuest }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	return useContext(AuthContext);
}
