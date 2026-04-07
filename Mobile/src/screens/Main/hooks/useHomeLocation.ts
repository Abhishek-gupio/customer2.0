import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { GEO } from '../../../config';
import {
  getCachedValue,
  getStaleCachedValue,
  setCachedValue,
} from '../../../services/cache';
import { HOME_STATES } from '../types/home';

let Geolocation: any = null;
try {
  const geoModule = require('@react-native-community/geolocation') as any;
  Geolocation = geoModule?.default ?? geoModule;
} catch {
  Geolocation = null;
}

const HOME_LOCATION_CACHE_KEY = 'cache:home:location';
const HOME_CACHE_TTL_MS = 10 * 60 * 1000;

type ReverseGeocodeResult = {
  display: string;
  state: string;
};

export function useHomeLocation() {
  const [selectedState, setSelectedState] = useState('Detecting...');
  const [userLocationDisplay, setUserLocationDisplay] =
    useState('Detecting...');
  const [locationLoading, setLocationLoading] = useState(false);
  const [isGpsPrecise, setIsGpsPrecise] = useState(false);
  const fuelStateLockedByUserRef = useRef(false);
  const isGpsPreciseRef = useRef(false);
  const userLocationDisplayRef = useRef('Detecting...');
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isGpsPreciseRef.current = isGpsPrecise;
  }, [isGpsPrecise]);

  useEffect(() => {
    userLocationDisplayRef.current = userLocationDisplay;
  }, [userLocationDisplay]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
        const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
        const fineHas = await PermissionsAndroid.check(fine);
        const coarseHas = await PermissionsAndroid.check(coarse);
        if (fineHas || coarseHas) {
          return true;
        }
        const results = await PermissionsAndroid.requestMultiple([
          fine,
          coarse,
        ]);
        return (
          results[fine] === PermissionsAndroid.RESULTS.GRANTED ||
          results[coarse] === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch {
        return false;
      }
    }

    if (Platform.OS === 'ios' && Geolocation?.requestAuthorization) {
      try {
        const status = await Geolocation.requestAuthorization('whenInUse');
        return (
          status === 'granted' ||
          status === 'authorized' ||
          status === 'authorizedWhenInUse'
        );
      } catch {
        return false;
      }
    }

    return true;
  }, []);

  const reverseGeocode = useCallback(
    async (lat: number, lon: number): Promise<ReverseGeocodeResult | null> => {
      try {
        const cachedLocation = getCachedValue<ReverseGeocodeResult>(
          HOME_LOCATION_CACHE_KEY,
        );
        if (cachedLocation) {
          return cachedLocation;
        }

        const base = GEO.reverseGeocodeBase.replace(/\/$/, '');
        const url = `${base}/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&zoom=18`;
        const res = await fetch(url, {
          headers: { 'User-Agent': GEO.userAgent },
        });
        const data = await res.json();
        const addr = data?.address;
        if (!addr) {
          return null;
        }

        const primary =
          addr.suburb ||
          addr.neighbourhood ||
          addr.locality ||
          addr.village ||
          addr.town ||
          addr.city ||
          addr.state_district;
        const townOrCity = addr.town || addr.city;
        const stateOrCountry = addr.state || addr.region || addr.country;
        const secondary =
          townOrCity && townOrCity !== primary ? townOrCity : stateOrCountry;
        const display =
          primary && secondary
            ? `${primary}, ${secondary}`
            : primary || secondary || 'Unknown Location';

        const nextLocation = { display, state: addr.state || '' };
        setCachedValue(
          HOME_LOCATION_CACHE_KEY,
          nextLocation,
          HOME_CACHE_TTL_MS,
        );
        return nextLocation;
      } catch {
        const staleLocation = getStaleCachedValue<ReverseGeocodeResult>(
          HOME_LOCATION_CACHE_KEY,
        );
        if (staleLocation) {
          return staleLocation;
        }
        return null;
      }
    },
    [],
  );

  const fetchUserLocationWithRetry = useCallback(
    async (attempt = 0) => {
      const maxAttempts = 20;

      try {
        setLocationLoading(true);

        if (Geolocation) {
          const permitted = await requestLocationPermission();
          if (permitted) {
            const coords = await new Promise<{
              lat: number;
              lon: number;
            } | null>(resolve => {
              Geolocation.getCurrentPosition(
                (position: any) =>
                  resolve({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                  }),
                () => resolve(null),
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 },
              );
            });

            if (coords) {
              const geo = await reverseGeocode(coords.lat, coords.lon);
              if (geo) {
                setUserLocationDisplay(geo.display);
                if (
                  !fuelStateLockedByUserRef.current &&
                  geo.state &&
                  HOME_STATES.includes(
                    geo.state as (typeof HOME_STATES)[number],
                  )
                ) {
                  setSelectedState(geo.state);
                }
                setIsGpsPrecise(true);
                setLocationLoading(false);
                return;
              }
            }
          }
        }

        if (!isGpsPreciseRef.current) {
          let geo: any = null;
          for (const ipUrl of GEO.ipProviders) {
            try {
              const res = await fetch(ipUrl, {
                headers: { 'User-Agent': GEO.userAgent },
              });
              const data = await res.json();
              const region =
                data?.region || data?.region_name || data?.regionName;
              if (data?.city && region) {
                geo = { ...data, region };
                break;
              }
            } catch {
              // ignore provider failures and keep trying fallbacks
            }
          }

          if (geo) {
            setUserLocationDisplay(`${geo.city}, ${geo.region}`);
            if (
              !fuelStateLockedByUserRef.current &&
              geo.region &&
              HOME_STATES.includes(geo.region as (typeof HOME_STATES)[number])
            ) {
              setSelectedState(geo.region);
            }
          }
        }

        if (!isGpsPreciseRef.current && attempt < maxAttempts) {
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }
          retryTimeoutRef.current = setTimeout(() => {
            void fetchUserLocationWithRetry(attempt + 1);
          }, 10000);
        } else if (
          !isGpsPreciseRef.current &&
          attempt >= maxAttempts &&
          !userLocationDisplayRef.current.includes(',')
        ) {
          setUserLocationDisplay('Location not available');
          setLocationLoading(false);
        } else {
          setLocationLoading(false);
        }
      } catch (error) {
        console.error('Location detection failed:', error);
        if (!isGpsPreciseRef.current && attempt < maxAttempts) {
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }
          retryTimeoutRef.current = setTimeout(() => {
            void fetchUserLocationWithRetry(attempt + 1);
          }, 10000);
        } else {
          setLocationLoading(false);
        }
      }
    },
    [requestLocationPermission, reverseGeocode],
  );

  return {
    selectedState,
    setSelectedState,
    userLocationDisplay,
    locationLoading,
    isGpsPrecise,
    fetchUserLocationWithRetry,
    fuelStateLockedByUserRef,
  };
}
