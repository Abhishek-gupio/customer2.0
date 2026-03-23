import { config } from '../config/environment';
import authStorage from './authStorage';

async function getToken(): Promise<string> {
  try {
    const token = await authStorage.getToken();
    return token || '';
  } catch {
    return '';
  }
}

// Helper function to create fetch with timeout
const fetchWithTimeout = (url: string, options: any, timeout: number = config.timeout): Promise<Response> => {
  return Promise.race([
    fetch(url, options),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout)
    )
  ]);
};

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  createdAt: string;
}

export async function getNotifications(): Promise<NotificationItem[]> {
  try {
    const base = config.apiBaseUrl;
    const token = await getToken();
    
    if (!token) {
      console.error('❌ [getNotifications] Access token required');
      throw new Error('Access token required');
    }

    const url = `${base}/notifications`;
    console.log(`🔍 [getNotifications] Fetching notifications from: ${url}`);
    
    const res = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      },
      config.timeout
    );

    const json = await res.json();
    console.log(`📬 [getNotifications] Response status: ${res.status}, success: ${json?.success}`);
    
    if (!res.ok || !json?.success) {
      console.error(`❌ [getNotifications] Error: ${json?.message || 'Failed to fetch notifications'}`);
      throw new Error(json?.message || 'Failed to fetch notifications');
    }

    const notifications = json.data || [];
    console.log(`✅ [getNotifications] Received ${notifications.length} notifications`);
    return notifications;
  } catch (error: any) {
    console.error('❌ [getNotifications] Exception:', error);
    
    // Provide more helpful error messages
    if (error.message?.includes('timeout')) {
      throw new Error('Request timed out. Please check your internet connection and try again.');
    } else if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection and ensure the server is running.');
    }
    
    throw error;
  }
}

/**
 * Store a notification in the backend when received on device
 * This ensures notifications appear on the Notification page
 */
export async function storeNotification(title: string, body: string, data?: Record<string, any>): Promise<boolean> {
  try {
    const base = config.apiBaseUrl;
    const token = await getToken();
    
    if (!token) {
      console.error('❌ [storeNotification] Access token required');
      return false;
    }

    const url = `${base}/notifications/store`;
    console.log(`💾 [storeNotification] Storing notification: ${title}`);
    
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          body,
          data
        })
      },
      config.timeout
    );

    const json = await res.json();
    
    if (!res.ok || !json?.success) {
      console.error(`❌ [storeNotification] Error: ${json?.message || 'Failed to store notification'}`);
      return false;
    }

    console.log(`✅ [storeNotification] Notification stored successfully`);
    return true;
  } catch (error: any) {
    console.error('❌ [storeNotification] Exception:', error);
    
    // Log more details for debugging
    if (error.message?.includes('timeout')) {
      console.error('⚠️ [storeNotification] Request timed out');
    } else if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
      console.error('⚠️ [storeNotification] Network error - server may be unreachable');
    }
    
    return false;
  }
}

