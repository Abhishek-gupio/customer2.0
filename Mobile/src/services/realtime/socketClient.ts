import { io, Socket } from 'socket.io-client';
import { SOCKET_BASE_URL } from '../../config';
import { getAccessToken } from '../storage';

let socket: Socket | null = null;

/**
 * One shared, authenticated Socket.io connection for the whole app (notifications,
 * chat typing/presence, etc.) instead of each screen opening its own — a chat
 * screen benefits from an already-warm connection when the user navigates in,
 * and typing indicators are latency-sensitive.
 *
 * The server only trusts the identity verified from `auth.token` (see
 * Backend/src/socket.ts) — the `join` event's userId argument is ignored server-side,
 * so this token is what actually determines which room this socket can join.
 */
export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(SOCKET_BASE_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    timeout: 20000,
    autoConnect: false,
    auth: (cb) => cb({ token: getAccessToken() }),
  });
  return socket;
}

let joinedUserId: string | null = null;

/** Connect (if needed) and join the given user's room. Safe to call repeatedly. */
export function connectAndJoin(userId: string): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  const doJoin = () => {
    if (joinedUserId === userId && s.connected) return;
    s.emit('join', userId);
    joinedUserId = userId;
  };
  if (s.connected) doJoin();
  else s.once('connect', doJoin);
  return s;
}

export function disconnectSocket(): void {
  joinedUserId = null;
  socket?.disconnect();
}
