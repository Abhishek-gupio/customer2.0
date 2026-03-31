import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://customerapi.gupio.tech/api";
    const SOCKET_URL = API_BASE.replace(/\/api$/, "").replace(/\/$/, "");

    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 20000,
    });
  }
  return socket;
};
