import Geolocation from '@react-native-community/geolocation';
import { Platform, PermissionsAndroid, AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { storageService } from './storage';
import { config } from '../config/environment';

/**
 * Customer Location Service
 * Automatically sends customer location to API so valet can see customer position
 * Works continuously in background, similar to valet location polling
 * 
 * BACKGROUND LOCATION SUPPORT:
 * - Uses Geolocation.watchPosition() which continues in background when "always" permission is granted
 * - Location updates are sent every 10 seconds to the server
 * - Works when app is in background (minimized)
 * - Works when app is closed IF "always" location permission is granted
 * - On iOS: Requires "Always Allow" location permission for background tracking
 * - On Android: Requires "Allow all the time" location permission for background tracking
 * 
 * IMPORTANT: For location to work when app is completely closed:
 * 1. User must grant "always" location permission (not just "when in use")
 * 2. Android: May need additional background location permission in AndroidManifest.xml
 * 3. iOS: Requires background location capability enabled in Xcode
 */
class CustomerLocationService {
  private pollingInterval: any = null;
  private watchId: number | null = null;
  private isPolling = false;
  private currentVehicleNumber: string | null = null;
  private appStateSubscription: any = null;
  private lastLocationSent: number = 0;
  private readonly LOCATION_SEND_INTERVAL = 10000; // Send location every 10 seconds
  private currentLocation: { lat: number; lng: number } | null = null;

  /**
   * Start sending customer location updates for a specific vehicle
   * @param vehicleNumber - The vehicle number for this request
   */
  async startPolling(vehicleNumber: string): Promise<void> {
    const vnum = vehicleNumber.toUpperCase().trim();
    
    if (this.isPolling && this.currentVehicleNumber === vnum) {
      console.log('📍 Customer location polling already active for vehicle:', vnum);
      return;
    }

    // Stop any existing polling
    this.stopPolling();

    try {
      console.log('🚀 Starting customer location polling for vehicle:', vnum);
      
      // Request location permission
      console.log('🔐 Requesting location permission for customer location sharing...');
      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        console.warn('⚠️ Customer location permission denied - location will not be sent');
        console.warn('⚠️ Valet will not be able to see customer location until permission is granted');
        return;
      }

      console.log('✅ Location permission granted - starting location sharing...');
      this.currentVehicleNumber = vnum;
      this.isPolling = true;

      // Store vehicle number
      await storageService.setActiveVehicleNumber(vnum);

      // Get initial location and send immediately
      console.log('📍 Getting initial customer location and sending to server...');
      await this.sendLocation(vnum);
      console.log('✅ Initial customer location sent successfully');

      // Use Geolocation.watchPosition for background location tracking
      // Watch position for continuous updates (works in background with proper permissions)
      this.watchId = Geolocation.watchPosition(
        async (position) => {
          const now = Date.now();
          // Throttle: only send if enough time has passed since last send
          if (now - this.lastLocationSent < this.LOCATION_SEND_INTERVAL) {
            return;
          }

          try {
            const coords = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            this.currentLocation = coords;

            if (this.currentVehicleNumber && this.isPolling && this.currentVehicleNumber === vnum) {
              await this.sendLocationToServer(this.currentVehicleNumber, coords);
              this.lastLocationSent = now;
              console.log('📍 [CUSTOMER_LOCATION] Location sent (works in background/closed):', coords);
            } else if (!this.isPolling) {
              console.log('🛑 [CUSTOMER_LOCATION] Polling stopped - not sending location');
            }
          } catch (error) {
            console.error('❌ Failed to send customer location update from watchPosition:', error);
          }
        },
        (error) => {
          console.error('❌ Customer location watch error:', error);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 10, // Update every 10 meters
          interval: this.LOCATION_SEND_INTERVAL,
          fastestInterval: 5000,
          // Note: watchPosition continues in background when "always" permission is granted
        }
      );

      // Fallback: Also use setInterval for foreground (more reliable in foreground)
      this.pollingInterval = setInterval(async () => {
          if (AppState.currentState === 'active' && this.isPolling && this.currentVehicleNumber === vnum) {
            try {
              await this.sendLocation(vnum);
            } catch (error) {
              // Only log if still polling for this vehicle
              if (this.isPolling && this.currentVehicleNumber === vnum) {
                console.error('❌ Failed to send customer location update:', error);
              }
            }
          }
        }, this.LOCATION_SEND_INTERVAL);

      // Monitor app state to ensure location continues in background
      this.setupAppStateListener();

      console.log('✅ Customer location polling started for vehicle:', vnum);
      console.log('✅ Customer location will send updates every 10 seconds');
      console.log('✅ Location sharing is ACTIVE - valet can now see customer position');
    } catch (error: any) {
      console.error('❌ Failed to start customer location polling:', error);
      this.isPolling = false;
      this.currentVehicleNumber = null;
      throw error;
    }
  }

  /**
   * Request location permission
   */
  private async requestLocationPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        // Request fine location permission (required for accurate tracking)
        const fineGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Allow location access',
            message: 'We use your location so the valet can find you, even when the app is closed.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
            buttonNeutral: 'Ask me later',
          }
        );
        
        // For Android 10+ (API 29+), also request background location permission
        // This allows location tracking when app is completely closed
        if (Platform.Version >= 29 && fineGranted === PermissionsAndroid.RESULTS.GRANTED) {
          try {
            // Check if background location permission is already granted to avoid showing alert repeatedly
            const backgroundStatus = await PermissionsAndroid.check(
              PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION as any
            );
            
            if (!backgroundStatus) {
              // Only request if not already granted
              const backgroundGranted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION as any,
                {
                  title: 'Allow background location',
                  message: 'Allow location access even when the app is closed, so valet can always find you.',
                  buttonPositive: 'Allow',
                  buttonNegative: 'Deny',
                }
              );
              if (backgroundGranted === PermissionsAndroid.RESULTS.GRANTED) {
                console.log('✅ Customer location: Background location permission granted - location will work when app is closed');
              } else {
                console.warn('⚠️ Customer location: Background location permission denied - location may stop when app is closed');
              }
            } else {
              console.log('✅ Customer location: Background location permission already granted');
            }
          } catch (e) {
            // Background location permission may not be available on older Android versions
            console.log('ℹ️ Customer location: Background location permission not available (Android < 10)');
          }
        }

        if (fineGranted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('✅ Android: Fine location permission granted');
          return true;
        }

        // Fallback to coarse location if fine location denied
        console.log('⚠️ Android: Fine location denied, trying coarse location...');
        const coarseGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
        );

        if (coarseGranted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('✅ Android: Coarse location permission granted (less accurate)');
          return true;
        }
        
        console.warn('❌ Android: Both fine and coarse location permissions denied');
        return false;
      }

      const requestAuth = Geolocation.requestAuthorization as
        | ((mode?: 'always' | 'whenInUse') => Promise<'granted' | 'denied' | 'restricted' | 'always' | 'whenInUse' | void> | void)
        | undefined;

      if (typeof requestAuth === 'function') {
        // Request 'always' permission for background location tracking (works when app is closed)
        // This allows location sharing to continue even when app is completely closed
        console.log('📱 iOS: Requesting "always" location permission...');
        const authStatus = await requestAuth('always');
        if (typeof authStatus === 'string') {
          const isAuthorized = authStatus === 'granted' || authStatus === 'always' || authStatus === 'whenInUse';
          if (isAuthorized && authStatus === 'always') {
            console.log('✅ iOS: "Always" permission granted - location will work when app is closed');
            return true;
          } else if (isAuthorized && (authStatus === 'granted' || authStatus === 'whenInUse')) {
            console.log('⚠️ iOS: "WhenInUse" permission granted - location may stop when app is closed');
            console.log('⚠️ For best experience, please enable "Always" in Settings > Privacy > Location Services');
            return true; // Still allow, but warn user
          } else {
            console.warn('❌ iOS: Location permission denied');
            return false;
          }
        }
      }

      // Fallback: assume permission is available (for older iOS versions or if requestAuth is not available)
      console.log('ℹ️ iOS: Using default location permission (may need to be configured in Info.plist)');
      return true;
    } catch (error) {
      console.warn('⚠️ Customer location permission request failed:', error);
      return false;
    }
  }

  /**
   * Setup app state listener to handle background/foreground transitions
   */
  private setupAppStateListener(): void {
    if (this.appStateSubscription) {
      return; // Already set up
    }

    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        console.log('📱 Customer app went to background - location tracking continues via watchPosition');
        console.log('✅ Location will continue even if app is closed (with "always" permission)');
        // watchPosition continues in background, so location sharing should work
      } else if (nextAppState === 'active') {
        console.log('📱 Customer app became active - location tracking active');
        // Send location immediately when app becomes active
        if (this.currentVehicleNumber && this.isPolling) {
          this.sendLocation(this.currentVehicleNumber).catch(err => {
            console.error('❌ Failed to send customer location on app active:', err);
          });
        }
      }
    });
  }

  /**
   * Send location to server (internal method)
   */
  private async sendLocationToServer(
    vehicleNumber: string,
    coords: { lat: number; lng: number }
  ): Promise<void> {
    // Double-check that we're still polling for this vehicle before sending
    if (!this.isPolling || this.currentVehicleNumber !== vehicleNumber) {
      console.log('🛑 [CUSTOMER_LOCATION] Skipping location send - polling stopped or vehicle changed');
      return;
    }

    try {
      console.log('📍 [CUSTOMER_LOCATION] Sending location for vehicle:', vehicleNumber);
      console.log('📍 [CUSTOMER_LOCATION] Coordinates:', coords);

      const baseUrl = config.apiBaseUrl.replace('/customer', '');
      const fullUrl = `${baseUrl}/customer-location/${vehicleNumber}`;

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: coords.lat,
          longitude: coords.lng,
          timestamp: Date.now()
        })
      });

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const responseData = await response.json();
        
        if (response.status === 429) {
          console.warn('⚠️ [CUSTOMER_LOCATION] Rate limited (429) - will retry');
          return;
        }
        
        if (responseData.success) {
          console.log('✅ [CUSTOMER_LOCATION] Location sent successfully for vehicle:', vehicleNumber);
          console.log('✅ [CUSTOMER_LOCATION] Valet can now see customer position at:', coords.lat.toFixed(6), coords.lng.toFixed(6));
        } else {
          console.warn('⚠️ [CUSTOMER_LOCATION] Failed to send:', responseData.message);
        }
      } else {
        if (response.status === 429) {
          console.warn('⚠️ [CUSTOMER_LOCATION] Rate limited (429) - slowing down');
        } else if (response.ok) {
          // Even if not JSON, if response is OK, location was likely received
          console.log('✅ [CUSTOMER_LOCATION] Location sent (non-JSON response, status:', response.status, ')');
        } else {
          console.error('❌ [CUSTOMER_LOCATION] Non-JSON response:', response.status);
        }
      }
    } catch (error: any) {
      // Don't log network errors if polling has been stopped (expected behavior)
      if (!this.isPolling || this.currentVehicleNumber !== vehicleNumber) {
        return; // Silently ignore if polling was stopped
      }
      
      // Only log if it's a real error and we're still polling
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('Network request failed') || errorMessage.includes('Network request falled')) {
        console.warn('⚠️ [CUSTOMER_LOCATION] Network error (may be due to cancelled request):', errorMessage);
      } else {
        console.error('❌ [CUSTOMER_LOCATION] Error sending location:', error);
      }
    }
  }

  /**
   * Send current location to API server
   */
  private async sendLocation(vehicleNumber: string): Promise<void> {
    try {
      // Get current location
      let coords;
      try {
        const position = await new Promise<any>((resolve, reject) => {
          Geolocation.getCurrentPosition(
            resolve,
            reject,
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
          );
        });
        
        coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        this.currentLocation = coords;
        console.log('📍 [CUSTOMER_LOCATION] Got location for vehicle:', vehicleNumber);
      } catch (locationError: any) {
        if (locationError.code === 1 || locationError.message?.includes('permission')) {
          console.error('❌ [CUSTOMER_LOCATION] Location permission denied for vehicle:', vehicleNumber);
          return;
        } else if (locationError.message?.includes('timeout') || locationError.code === 3) {
          console.error('❌ [CUSTOMER_LOCATION] Location timeout for vehicle:', vehicleNumber);
          return;
        } else {
          console.error('❌ [CUSTOMER_LOCATION] Failed to get location for vehicle:', vehicleNumber);
          return;
        }
      }
      
      if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
        console.error('❌ [CUSTOMER_LOCATION] Invalid coordinates for vehicle:', vehicleNumber);
        return;
      }
      
      // Check if still polling before sending
      if (this.isPolling && this.currentVehicleNumber === vehicleNumber) {
        await this.sendLocationToServer(vehicleNumber, coords);
        this.lastLocationSent = Date.now();
      } else {
        console.log('🛑 [CUSTOMER_LOCATION] Polling stopped - not sending location');
      }
    } catch (error: any) {
      console.error('❌ [CUSTOMER_LOCATION] Error in sendLocation:', error);
    }
  }

  /**
   * Stop sending location updates
   */
  stopPolling(): void {
    // Clear interval
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    // Clear watch position
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    // Remove app state listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    // Clear stored vehicle number
    storageService.clearActiveVehicleNumber();

    this.isPolling = false;
    this.currentVehicleNumber = null;
    this.currentLocation = null;
    console.log('🛑 Customer location polling stopped');
  }

  /**
   * Check if currently polling
   */
  isActive(): boolean {
    return this.isPolling;
  }

  /**
   * Get current vehicle number being tracked
   */
  getCurrentVehicle(): string | null {
    return this.currentVehicleNumber;
  }

  /**
   * Get current location (if available)
   */
  getCurrentLocation(): { lat: number; lng: number } | null {
    return this.currentLocation;
  }
}

export const customerLocationService = new CustomerLocationService();
export default customerLocationService;

