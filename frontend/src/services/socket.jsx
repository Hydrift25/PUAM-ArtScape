import { io } from "socket.io-client";

let socket = null;

export function initSocket(userId) {
	if (socket) return socket;
	const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:8000";
	socket = io(SOCKET_URL, {
		auth: { user_id: userId },
		transports: ["websocket", "polling"],
	});
	return socket;
}

export function getSocket() {
	return socket;
}

export function disconnectSocket() {
	if (socket) {
		socket.disconnect();
		socket = null;
	}
}
