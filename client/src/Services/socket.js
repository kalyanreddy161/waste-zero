import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Do NOT auto-connect. The socket will be explicitly connected after the user
// session is established (see Topbar.jsx), to prevent the server rejecting the
// connection as "unauthorized" before the session cookie is set.
const socket = io(API_URL, {
  withCredentials: true,
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  transports: ["websocket"],
});

export default socket;
