import { io } from "socket.io-client";

let socket = null;
let status = "disconnected";
const listeners = new Set();

function setStatus(next) {
	if (status === next) return;
	status = next;
	for (const cb of listeners) cb(status);
}

export function initSocket(userId) {
	if (socket) return socket;
	const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:8000";
	socket = io(SOCKET_URL, {
		auth: { user_id: userId },
		transports: ["websocket", "polling"],
	});
	setStatus("reconnecting");
	socket.on("connect", () => setStatus("connected"));
	socket.on("disconnect", () => setStatus("reconnecting"));
	socket.on("connect_error", (err) => console.warn("[socket] connect_error:", err?.message));
	socket.io.on("reconnect_attempt", () => setStatus("reconnecting"));
	socket.io.on("reconnect", () => setStatus("connected"));
	socket.io.on("reconnect_failed", () => {
		console.warn("[socket] reconnect_failed — giving up");
		setStatus("failed");
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
	setStatus("disconnected");
}

export function getSocketStatus() {
	return status;
}

export function subscribeSocketStatus(cb) {
	listeners.add(cb);
	cb(status);
	return () => listeners.delete(cb);
}
