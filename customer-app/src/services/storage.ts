import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_VEHICLE_KEY = 'customer_active_vehicle_number';

/**
 * Storage service for customer app
 * Used to persist active vehicle number for background geolocation headless task
 */
class StorageService {
  /**
   * Store a value in AsyncStorage
   */
  async setItem(key: string, value: any): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      console.error('[Storage] Error storing data:', error);
      throw error;
    }
  }

  /**
   * Retrieve a value from AsyncStorage
   */
  async getItem<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('[Storage] Error retrieving data:', error);
      return null;
    }
  }

  /**
   * Remove a value from AsyncStorage
   */
  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('[Storage] Error removing data:', error);
      throw error;
    }
  }

  /**
   * Set active vehicle number for background geolocation
   */
  async setActiveVehicleNumber(vehicleNumber: string | null): Promise<void> {
    if (!vehicleNumber) {
      await this.removeItem(ACTIVE_VEHICLE_KEY);
      return;
    }
    await this.setItem(ACTIVE_VEHICLE_KEY, vehicleNumber);
  }

  /**
   * Get active vehicle number for background geolocation
   */
  async getActiveVehicleNumber(): Promise<string | null> {
    return this.getItem<string>(ACTIVE_VEHICLE_KEY);
  }

  /**
   * Clear active vehicle number
   */
  async clearActiveVehicleNumber(): Promise<void> {
    await this.removeItem(ACTIVE_VEHICLE_KEY);
  }
}

export const storageService = new StorageService();
export default storageService;

