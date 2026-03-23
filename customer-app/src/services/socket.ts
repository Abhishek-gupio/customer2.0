import io from 'socket.io-client';
import { config } from '../config/environment';

export const getSocketBaseUrl = (): string => {
  try {
    // Remove /api/v1/customer or similar paths to get the base socket server URL
    const baseUrl = config.apiBaseUrl.replace(/\/api\/v1.*/, '');
    console.log('📡 [socket] Derived base URL:', baseUrl);
    return baseUrl;
  } catch (error) {
    console.log('📡 [socket] Error deriving base URL, using raw API URL:', config.apiBaseUrl);
    return config.apiBaseUrl;
  }
};

export const createSocket = (options?: Record<string, any>) => {
  const base = getSocketBaseUrl();
  console.log('📡 [socket] Creating socket connection to:', base);

  return io(base, {
    transports: ['websocket'],               // Use WebSockets for better performance/stability in RN
    upgrade: true,                           // Allow upgrading
    reconnection: true,
    reconnectionAttempts: 10,                // Reduced from 50 to avoid infinite loops on dead servers
    reconnectionDelay: 2000,                 // Increased slightly
    timeout: 20000,
    forceNew: true,
    ...(options || {}),
  });
};

export default createSocket;


