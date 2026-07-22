import { useEffect } from 'react';
import { io } from 'socket.io-client';

/**
 * Opens a dedicated Socket.IO connection authenticated as the given parking
 * actor (dealer/employee/admin) and calls `onUpdate` whenever the backend
 * emits `parking_live_update` (parking.service.ts's emitParkingLiveUpdate).
 * A fresh connection per mount — simpler than sharing the app's existing
 * unauthenticated `lib/socket.ts` singleton across multiple actor types.
 */
export function useParkingLiveSocket(
  token: string | null,
  actorType: 'dealer' | 'parkingEmployee' | 'admin',
  onUpdate: () => void,
) {
  useEffect(() => {
    if (!token) return;
    const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://customerapi.gupio.tech/api';
    const SOCKET_URL = API_BASE.replace(/\/api$/, '').replace(/\/$/, '');
    // websocket-only, no polling fallback: a polling handshake is a series
    // of separate HTTP requests that all have to land on the same backend
    // instance, which needs load-balancer sticky sessions to guarantee. A
    // single long-lived WebSocket connection has no such requirement — it's
    // one connection to one instance for its whole life, sticky by
    // construction. Trade-off: a client on a network that blocks raw
    // WebSocket (rare for this audience) won't fall back, it just won't connect.
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: { token, actorType },
    });
    socket.on('connect', () => socket.emit('join'));
    socket.on('parking_live_update', onUpdate);
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, actorType]);
}
