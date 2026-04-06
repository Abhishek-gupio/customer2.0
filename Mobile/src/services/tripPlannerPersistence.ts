import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlanningState } from '../screens/Other/tripPlannerTypes';

const BASE_KEY = '@trip_planning_state';

const getStorageKey = (tripId?: string) => tripId ? `${BASE_KEY}:${tripId}` : BASE_KEY;

export const savePlanningState = async (state: PlanningState, tripId?: string) => {
  try {
    const jsonValue = JSON.stringify(state);
    await AsyncStorage.setItem(getStorageKey(tripId), jsonValue);
  } catch (e) {
    console.error('Error saving planning state:', e);
  }
};

export const loadPlanningState = async (tripId?: string): Promise<PlanningState | null> => {
  try {
    const jsonValue = await AsyncStorage.getItem(getStorageKey(tripId));
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error('Error loading planning state:', e);
    return null;
  }
};

export const clearPlanningState = async (tripId?: string) => {
  try {
    await AsyncStorage.removeItem(getStorageKey(tripId));
  } catch (e) {
    console.error('Error clearing planning state:', e);
  }
};
