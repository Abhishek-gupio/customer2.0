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
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
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
