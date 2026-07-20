import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../services/api';
import {
  getCachedValue,
  getStaleCachedValue,
  setCachedValue,
} from '../../../services/cache';
import { HOME_STATES, type HomeFuelPrices } from '../types/home';

const HOME_FUEL_CACHE_PREFIX = 'cache:home:fuel:';
const HOME_CACHE_TTL_MS = 10 * 60 * 1000;

export function useHomeFuel(selectedState: string) {
  const [fuelPrices, setFuelPrices] = useState<HomeFuelPrices | null>(null);
  const [fuelLoading, setFuelLoading] = useState(false);

  const fetchFuelPrices = useCallback(async () => {
    try {
      setFuelLoading(true);
      const cacheKey = `${HOME_FUEL_CACHE_PREFIX}${selectedState}`;
      const cachedFuel = getCachedValue<HomeFuelPrices>(cacheKey);
      if (cachedFuel) {
        setFuelPrices(cachedFuel);
      }

      const res = await api.get<any>(`/v1/fuel/state?name=${selectedState}`);
      const data = (res as any).data || res;

      if (data && (data.PETROL || data.petrol)) {
        const nextFuel = {
          petrol: data.PETROL || data.petrol,
          diesel: data.DIESEL || data.diesel,
          cng: data.CNG || data.cng,
        };
        setFuelPrices(nextFuel);
        setCachedValue(cacheKey, nextFuel, HOME_CACHE_TTL_MS);
      } else {
        console.warn('No fuel data available for', selectedState);
      }
    } catch (error) {
      console.error('Error fetching fuel prices:', error);
      const cacheKey = `${HOME_FUEL_CACHE_PREFIX}${selectedState}`;
      const staleFuel = getStaleCachedValue<HomeFuelPrices>(cacheKey);
      if (staleFuel) {
        setFuelPrices(staleFuel);
      }
    } finally {
      setFuelLoading(false);
    }
  }, [selectedState]);

  useEffect(() => {
    if (
      selectedState &&
      selectedState !== 'Detecting...' &&
      HOME_STATES.includes(selectedState as (typeof HOME_STATES)[number])
    ) {
      void fetchFuelPrices();
    }
  }, [fetchFuelPrices, selectedState]);

  return {
    fuelPrices,
    fuelLoading,
    fetchFuelPrices,
  };
}
