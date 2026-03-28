import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Linking,
  Modal,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MapView, { Polyline, Marker } from 'react-native-maps';
import Share from 'react-native-share';
// @ts-ignore
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import { useNavigation } from '../../lib/react-navigation-native';
import { tripExpenseService, type TripRoute, type TripExpenseResult } from '../../services/tripExpenseService';
import { placesService, type SearchSuggestion } from '../../services/placesService';
import { vehicleService, type Vehicle } from '../../services/vehicleService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decodePolyline } from '../../utils/polyline';
import LinearGradient from 'react-native-linear-gradient';
import { Clock, HeartPulse, Zap, ChevronRight, ArrowLeft, ChevronDown, ChevronUp, Info, AlertTriangle, CheckCircle2, Receipt, Route, Timer, Share2, Maximize2, X, MapPin, Navigation, List, Sparkles, History, BarChart3 } from 'lucide-react-native';
import TripPlannerFlow from './TripPlannerFlow';
import { loadPlanningState } from '../../services/tripPlannerPersistence';
import { PlanningState } from './tripPlannerTypes';
import TripHistoryModal from './components/TripHistoryModal';
import { HistoryEntry } from '../../services/tripHistoryTypes';
import { analyticsService, tripPlannerAnalytics } from '../../services/analytics';

// ─── Colors (matching app dark theme) ────────────────────────────────────────
const C = {
  bg: '#000000',
  card: '#1C1C1E',
  cardBorder: '#2C2C2E',
  accent: '#FFD700',
  accentLight: 'rgba(255, 215, 0, 0.1)',
  accentBg: 'rgba(255, 215, 0, 0.1)',
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  textMuted: '#555555',
  green: '#32D74B',
  greenBg: 'rgba(50, 215, 75, 0.12)',
  orange: '#FF9F0A',
  orangeBg: 'rgba(255, 159, 10, 0.12)',
  red: '#FF453A',
  inputBg: '#1A1A1A',
  inputBorder: '#2C2C2E',
  divider: '#2C2C2E',
};

// Helper functions for Vehicle Health vs Trip Distance
const getHealthAssessment = (score: number | undefined, distanceKm: number | undefined) => {
  const dScore = score || 0;
  const dist = distanceKm || 0;
  
  if (!score) {
    return {
      icon: 'ℹ️',
      color: C.textSecondary,
      message: 'Vehicle health data unavailable. Make sure your vehicle is serviced regularly before long trips.'
    };
  }

  if (dist > 500 && dScore < 80) {
    return {
      icon: '⚠️',
      color: C.orange,
      message: `Warning: Your vehicle health is ${Math.round(dScore)}/100. For a long trip of ${Math.round(dist)}km, a full checkup is recommended.`
    };
  } else if (dist > 200 && dScore < 60) {
    return {
      icon: '⚠️',
      color: C.orange,
      message: `Warning: Your vehicle health is ${Math.round(dScore)}/100. It might not be ideal for this ${Math.round(dist)}km trip without a checkup.`
    };
  } else if (dScore < 40) {
    return {
      icon: '🛑',
      color: C.red,
      message: `Critical: Your vehicle health is ${Math.round(dScore)}/100. Get it serviced before embarking on trips.`
    };
  } else {
    return {
      icon: '✅',
      color: C.green,
      message: `Your vehicle health (${Math.round(dScore)}/100) is good for this trip. Drive safely!`
    };
  }
};

const getFirstWord = (value?: string) => {
  if (!value) return '';
  const parts = value.trim().split(/\s+/);
  return parts[0] || '';
};

const getModelFirstWord = (model?: string, makeFirstWord?: string) => {
  if (!model) return '';
  const parts = model.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (!makeFirstWord) return parts[0];
  const first = parts[0];
  const isSameAsMake = first.toLowerCase() === makeFirstWord.toLowerCase();
  if (!isSameAsMake) return first;
  return parts[1] || '';
};

export default function TripExpenseScreen() {
  const navigation = useNavigation();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [waypoints, setWaypoints] = useState<string[]>([]);
  
  const [fromSuggestions, setFromSuggestions] = useState<SearchSuggestion[]>([]);
  const [toSuggestions, setToSuggestions] = useState<SearchSuggestion[]>([]);
  const [waypointSuggestions, setWaypointSuggestions] = useState<{ [key: number]: SearchSuggestion[] }>({});

  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const [showWaypointSuggestions, setShowWaypointSuggestions] = useState<{ [key: number]: boolean }>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<TripExpenseResult | null>(null);
  const [primaryVehicle, setPrimaryVehicle] = useState<Vehicle | null>(null);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [amenities, setAmenities] = useState<any[]>([]);
  const [searchingAmenities, setSearchingAmenities] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showTraffic, setShowTraffic] = useState(true);
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(false);
  const [showFullMap, setShowFullMap] = useState(false);
  const [isPlanningMode, setIsPlanningMode] = useState(false);
  const [isHistoryMode, setIsHistoryMode] = useState(false);
  const [planningData, setPlanningData] = useState<PlanningState | null>(null);
  const [requestedPlanningStep, setRequestedPlanningStep] = useState<number | undefined>(undefined);

  const tripId = useMemo(() => {
    if (!from || !to) return undefined;
    return `${from.trim()}_${to.trim()}`.replace(/\s+/g, '_').toLowerCase();
  }, [from, to]);

  useEffect(() => {
    const loadCachedData = async () => {
      try {
        const [cachedResult, cachedDraft] = await Promise.all([
          AsyncStorage.getItem('last_trip_result'),
          AsyncStorage.getItem('trip_inputs_draft'),
        ]);

        if (cachedResult) {
          setResult(JSON.parse(cachedResult));
        }

        if (cachedDraft) {
          const draft = JSON.parse(cachedDraft);
          if (draft.from) setFrom(draft.from);
          if (draft.to) setTo(draft.to);
          if (draft.waypoints) setWaypoints(draft.waypoints);
        }
      } catch (e) {
        console.warn('Failed to load cached data', e);
      }
    };
    loadCachedData();
  }, []);

  useEffect(() => {
    analyticsService.trackScreenView('trip_expense_screen');
  }, []);

  useEffect(() => {
    const fetchPlanningData = async () => {
      try {
        const data = await loadPlanningState(tripId);
        setPlanningData(data);
      } catch (e) {
        console.warn('Failed to load planning data', e);
      }
    };
    fetchPlanningData();
  }, [tripId]);

  useEffect(() => {
    const fetchVehicle = async () => {
      try {
        const vehicles = await vehicleService.getVehicles();
        const primary = vehicles.find(v => v.isPrimary) || vehicles[0];
        if (primary) {
          setPrimaryVehicle(primary);
        }
      } catch (e) {
        console.warn('Failed to fetch vehicles', e);
      }
    };
    fetchVehicle();
  }, []);

  // Save Result
  useEffect(() => {
    if (result) {
      AsyncStorage.setItem('last_trip_result', JSON.stringify(result)).catch(e => 
        console.warn('Failed to cache trip result', e)
      );
    }
  }, [result]);

  // Save Draft (Inputs)
  useEffect(() => {
    AsyncStorage.setItem('trip_inputs_draft', JSON.stringify({ from, to, waypoints })).catch(e => 
      console.warn('Failed to cache inputs draft', e)
    );
  }, [from, to, waypoints]);

  const searchTimeout = useRef<any>(null);
  const selectedRoute: TripRoute | null =
    result?.routes?.[selectedRouteIdx] ?? null;
  const mapRef = useRef<MapView>(null);

  const allRoutePolylines = useMemo(() => {
    if (!result?.routes) return [];
    return result.routes
      .filter(r => !!r.polyline)
      .map(r => ({
        coords: decodePolyline(r.polyline || ''),
        route: r
      }));
  }, [result]);

  const routePolyline = useMemo(() => {
    return allRoutePolylines[selectedRouteIdx]?.coords || [];
  }, [allRoutePolylines, selectedRouteIdx]);

  const cheapestRouteIdx = useMemo(() => {
    if (!result?.routes?.length) return -1;
    return result.routes.reduce((bestIdx, route, idx, routes) => {
      return route.costs.total < routes[bestIdx].costs.total ? idx : bestIdx;
    }, 0);
  }, [result]);

  const fastestRouteIdx = useMemo(() => {
    if (!result?.routes?.length) return -1;
    const toMinutes = (route: TripRoute) => (route.duration.hours * 60) + route.duration.minutes;
    return result.routes.reduce((bestIdx, route, idx, routes) => {
      return toMinutes(route) < toMinutes(routes[bestIdx]) ? idx : bestIdx;
    }, 0);
  }, [result]);

  useEffect(() => {
    if (routePolyline.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(routePolyline, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [routePolyline]);

  const handleSearch = (text: string, type: 'from' | 'to' | number) => {
    if (type === 'from') {
      setFrom(text);
      if (text.length < 3) {
        setFromSuggestions([]);
        setShowFromSuggestions(false);
        return;
      }
    } else if (type === 'to') {
      setTo(text);
      if (text.length < 3) {
        setToSuggestions([]);
        setShowToSuggestions(false);
        return;
      }
    } else {
      // Waypoint search
      const newWaypoints = [...waypoints];
      newWaypoints[type] = text;
      setWaypoints(newWaypoints);
      if (text.length < 3) {
        setWaypointSuggestions({ ...waypointSuggestions, [type]: [] });
        setShowWaypointSuggestions({ ...showWaypointSuggestions, [type]: false });
        return;
      }
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      const suggestions = await placesService.search(text);
      if (type === 'from') {
        setFromSuggestions(suggestions);
        setShowFromSuggestions(suggestions.length > 0);
      } else if (type === 'to') {
        setToSuggestions(suggestions);
        setShowToSuggestions(suggestions.length > 0);
      } else {
        setWaypointSuggestions({ ...waypointSuggestions, [type]: suggestions });
        setShowWaypointSuggestions({ ...showWaypointSuggestions, [type]: suggestions.length > 0 });
      }
    }, 400);
  };

  const selectSuggestion = (suggestion: SearchSuggestion, type: 'from' | 'to' | number) => {
    if (type === 'from') {
      setFrom(suggestion.description);
      setShowFromSuggestions(false);
    } else if (type === 'to') {
      setTo(suggestion.description);
      setShowToSuggestions(false);
    } else {
      const newWaypoints = [...waypoints];
      newWaypoints[type] = suggestion.description;
      setWaypoints(newWaypoints);
      setShowWaypointSuggestions({ ...showWaypointSuggestions, [type]: false });
    }
  };

  const addWaypoint = () => {
    setWaypoints([...waypoints, '']);
  };

  const removeWaypoint = (index: number) => {
    const newWaypoints = waypoints.filter((_, i) => i !== index);
    setWaypoints(newWaypoints);
    // Cleanup suggestions
    const newWPSuggestions = { ...waypointSuggestions };
    delete newWPSuggestions[index];
    setWaypointSuggestions(newWPSuggestions);
  };

  const renderMapContent = () => {
    if (!result || allRoutePolylines.length === 0) return null;
    return (
      <>
        {/* Render all routes first (dimmed) */}
        {allRoutePolylines.map((item, idx) => {
          const isSelected = idx === selectedRouteIdx;
          if (isSelected) return null; // Render selected last for z-index
          return (
            <Polyline
              key={`route-line-${idx}`}
              coordinates={item.coords}
              strokeColor="rgba(255,255,255,0.25)"
              strokeWidth={3}
              lineDashPattern={[5, 5]}
            />
          );
        })}

        {/* Render Selected Route (Bold) */}
        <Polyline
          coordinates={routePolyline}
          strokeColor="rgba(255,255,255,0.9)"
          strokeWidth={6}
        />

        {/* Start Marker */}
        <Marker
          coordinate={routePolyline[0]}
          title="Start"
          description={result.from}
        >
          <View style={[s.markerDot, { backgroundColor: C.green }]}>
            <Text style={s.markerIcon}>🚀</Text>
          </View>
        </Marker>

        {/* End Marker */}
        <Marker
          coordinate={routePolyline[routePolyline.length - 1]}
          title="Destination"
          description={result.to}
        >
          <View style={[s.markerDot, { backgroundColor: C.red }]}>
            <Text style={s.markerIcon}>📍</Text>
          </View>
        </Marker>

        {/* Toll Markers (Selected Route Only) */}
        {selectedRoute?.tolls?.map((toll, idx) => (
          <Marker
            key={`toll-${idx}`}
            coordinate={{ latitude: toll.lat, longitude: toll.lng }}
            title={toll.name}
            description={`₹${toll.tagCost} (FASTag)`}
          >
            <View style={[s.markerDot, { backgroundColor: C.accent }]}>
              <Text style={s.markerIcon}>🛣️</Text>
            </View>
            {toll.weather && (
              <View style={s.weatherAnnotation}>
                <Text style={s.weatherText}>{toll.weather.temp}°</Text>
              </View>
            )}
          </Marker>
        ))}
        {/* Amenity Markers */}
        {amenities.map((item, idx) => (
          <Marker
            key={`amenity-${idx}`}
            coordinate={{ latitude: item.latitude, longitude: item.longitude }}
            title={item.name}
            pinColor="#4ade80"
          />
        ))}
      </>
    );
  };

  const handleCalculate = useCallback(async () => {
    const trimmedFrom = from.trim();
    const trimmedTo = to.trim();
    const activeWaypoints = waypoints.filter(w => w.trim() !== '');

    if (!trimmedFrom || !trimmedTo) {
      setError('Please enter both origin and destination');
      tripPlannerAnalytics.calculationFailed({
        reason: 'missing_input',
        has_from: !!trimmedFrom,
        has_to: !!trimmedTo,
        waypoint_count: activeWaypoints.length,
      });
      return;
    }

    tripPlannerAnalytics.calculationStarted({
      waypoint_count: activeWaypoints.length,
      has_primary_vehicle: !!primaryVehicle,
    });

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await tripExpenseService.calculate({
        from: trimmedFrom,
        to: trimmedTo,
        waypoints: activeWaypoints,
      });
      setResult(data);
      setSelectedRouteIdx(0);

      const firstRoute = data.routes?.[0];
      tripPlannerAnalytics.calculationSucceeded({
        route_count: data.routes?.length || 0,
        total_cost: firstRoute?.costs?.total || 0,
        distance_km: firstRoute?.distance?.km || 0,
        has_waypoints: (data.waypoints?.length || 0) > 0,
      });

      // Close suggestions once plan is generated.
      setShowFromSuggestions(false);
      setShowToSuggestions(false);
      setShowWaypointSuggestions({});
      setFromSuggestions([]);
      setToSuggestions([]);
      setWaypointSuggestions({});
    } catch (err: any) {
      setError(err?.message || 'Failed to calculate trip expenses');
      tripPlannerAnalytics.calculationFailed({
        reason: err?.message || 'calculate_failed',
        waypoint_count: activeWaypoints.length,
      });
    } finally {
      setLoading(false);
    }
  }, [from, to, waypoints, primaryVehicle]);

  const handleRefreshTraffic = async () => {
    if (!result?.id) return;
    setRefreshing(true);
    setError(null);
    try {
      const refreshed = await tripExpenseService.refresh(result.id);
      setResult(refreshed);
      setSelectedRouteIdx(0);
      tripPlannerAnalytics.trafficRefresh({
        route_count: refreshed.routes?.length || 0,
        selected_route: 0,
      });
    } catch (err: any) {
      console.warn('Refresh failed', err);
      setError(err?.message || 'Live traffic refresh failed');
      tripPlannerAnalytics.trafficRefreshFailed({
        reason: err?.message || 'refresh_failed',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleStartNavigation = () => {
    // Prefer current input values, but always keep result fallback.
    const finalFrom = from || result?.from;
    const finalTo = to || result?.to;
    const finalWaypoints = (waypoints.length > 0 ? waypoints : result?.waypoints) || [];

    if (!finalFrom || !finalTo) return;
    
    const originStr = encodeURIComponent(finalFrom);
    const destinationStr = encodeURIComponent(finalTo);
    const activeWaypoints = finalWaypoints.filter((w: string) => w.trim() !== '');
    const waypointsStr = activeWaypoints.map((w: string) => encodeURIComponent(w)).join('|');
    
    let url = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destinationStr}`;
    if (waypointsStr) {
      url += `&waypoints=${waypointsStr}`;
    }

    tripPlannerAnalytics.navigationStarted({
      waypoint_count: activeWaypoints.length,
      selected_route: selectedRouteIdx,
      distance_km: selectedRoute?.distance?.km || 0,
    });
    
    Linking.openURL(url).catch(err => {
      console.error('An error occurred', err);
      setError('Could not open Google Maps navigation.');
    });
  };

  const searchAlongRoute = async (category: string) => {
    if (!selectedRoute || routePolyline.length === 0) return;
    setSearchingAmenities(true);
    setAmenities([]);
    tripPlannerAnalytics.amenitySearchStarted({
      category,
      route_distance_km: selectedRoute.distance?.km || 0,
    });
    try {
      // Sample 5 points along the route to search around
      const step = Math.floor(routePolyline.length / 5);
      const pointsToSearch = [
        routePolyline[Math.floor(step / 2)],
        routePolyline[Math.floor(step * 1.5)],
        routePolyline[Math.floor(step * 2.5)],
        routePolyline[Math.floor(step * 3.5)],
        routePolyline[Math.floor(step * 4.5)],
      ].filter((pt): pt is { latitude: number; longitude: number } => !!pt);
      if (pointsToSearch.length === 0) return;

      const allResults: any[] = [];
      for (const pt of pointsToSearch) {
        const typeMap: any = {
          FuelStations: 'gas_station',
          Hotel: 'lodging',
          ChargingStation: 'electric_charging_station',
          Hospital: 'hospital',
        };
        const near = await placesService.getNearby(pt.latitude, pt.longitude, typeMap[category] || 'gas_station');
        allResults.push(...near);
      }
      
      // Remove duplicates by placeId
      const unique = Array.from(new Map(allResults.map(p => [p.placeId, p])).values());
      setAmenities(unique);
      tripPlannerAnalytics.amenitySearchResults({
        category,
        result_count: unique.length,
      });
    } catch (err) {
      console.warn('Amenity search failed', err);
      tripPlannerAnalytics.amenitySearchFailed({
        category,
      });
    } finally {
      setSearchingAmenities(false);
    }
  };

  const handleSharePDF = async () => {
    if (!selectedRoute) return;
    try {
      const summaryFrom = result?.from || from;
      const summaryTo = result?.to || to;
      const html = `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h1 style="color: #FFBF00;">Trip Cost Summary</h1>
          <p><strong>From:</strong> ${summaryFrom}</p>
          <p><strong>To:</strong> ${summaryTo}</p>
          <hr/>
          <h2>Total Cost: ₹${selectedRoute.costs.total}</h2>
          <p>Distance: ${selectedRoute.distance.text} | Duration: ${selectedRoute.duration.text}</p>
          <hr/>
          <h3>Cost Breakdown</h3>
          <ul>
            <li>Fuel: ₹${selectedRoute.costs.fuel}</li>
            <li>Toll (FASTag): ₹${selectedRoute.costs.tollFastag}</li>
          </ul>
          <h3>Toll Plazas (${selectedRoute.tolls.length})</h3>
          ${selectedRoute.tolls.map(t => `<p>${t.name}: ₹${t.tagCost}</p>`).join('')}
        </div>
      `;
      const options = {
        html,
        fileName: 'TripSummary',
        directory: 'Documents',
      };
      const file = await (RNHTMLtoPDF as any).convert(options);
      if (file.filePath) {
        await Share.open({
          url: `file://${file.filePath}`,
          type: 'application/pdf',
        });
      }
    } catch (err) {
      console.warn('PDF Share failed', err);
    }
  };

  const handleOpenPlanner = useCallback((source: string, step?: number, hasExistingPlanOverride?: boolean) => {
    setRequestedPlanningStep(step);
    setIsPlanningMode(true);
    tripPlannerAnalytics.plannerOpened({
      source,
      step: step ?? 0,
      has_existing_plan: hasExistingPlanOverride ?? !!planningData,
      has_result: !!result,
    });
  }, [planningData, result]);

  const handleOpenHistory = useCallback(() => {
    setIsHistoryMode(true);
    tripPlannerAnalytics.historyOpened({
      has_result: !!result,
      has_plan: !!planningData,
    });
  }, [planningData, result]);

  const handleOpenInsights = useCallback(() => {
    tripPlannerAnalytics.insightsOpened({
      source: 'trip_expense_header',
      has_result: !!result,
      has_plan: !!planningData,
    });
    (navigation as any).navigate('TripPlannerInsights');
  }, [navigation, planningData, result]);

  const handleSelectRoute = useCallback((idx: number) => {
    setSelectedRouteIdx(idx);
    const route = result?.routes?.[idx];
    tripPlannerAnalytics.routeChanged({
      selected_route: idx,
      total_routes: result?.routes?.length || 0,
      distance_km: route?.distance?.km || 0,
    });
  }, [result]);

  const handleToggleTraffic = useCallback(() => {
    const nextValue = !showTraffic;
    setShowTraffic(nextValue);
    tripPlannerAnalytics.trafficToggle({
      enabled: nextValue,
      selected_route: selectedRouteIdx,
    });
  }, [showTraffic, selectedRouteIdx]);

  const handleOpenFullMap = useCallback(() => {
    setShowFullMap(true);
    tripPlannerAnalytics.fullMapOpened({
      selected_route: selectedRouteIdx,
      has_route: !!selectedRoute,
    });
  }, [selectedRoute, selectedRouteIdx]);

  const handleCloseFullMap = useCallback(() => {
    setShowFullMap(false);
    tripPlannerAnalytics.fullMapClosed({
      selected_route: selectedRouteIdx,
      has_route: !!selectedRoute,
    });
  }, [selectedRoute, selectedRouteIdx]);

  const handleToggleBreakdown = useCallback(() => {
    const nextValue = !showDetailedBreakdown;
    setShowDetailedBreakdown(nextValue);
    tripPlannerAnalytics.breakdownToggled({
      expanded: nextValue,
      selected_route: selectedRouteIdx,
    });
  }, [selectedRouteIdx, showDetailedBreakdown]);

  const handleSelectHistoryTrip = (entry: HistoryEntry) => {
    setFrom(entry.from);
    setTo(entry.to);
    setResult(entry.tripResult);
    setPlanningData(entry.planning);
    setIsHistoryMode(false);
    
    // Automatically open the planner at step 2 (Summary)
    handleOpenPlanner('history_selection', 2, !!entry.planning);
    tripPlannerAnalytics.historySelected({
      has_planning: !!entry.planning,
      route_count: entry.tripResult?.routes?.length || 0,
    });

    if (entry.tripResult.routes?.[0]?.polyline) {
      setSelectedRouteIdx(0);
    }
  };

  const hasItinerarySelections = !!(
    planningData &&
    (
      planningData.selectedHotelId ||
      (planningData.selectedActivities?.length || 0) > 0 ||
      !!planningData.selectedBikeId
    )
  );

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.premiumHeader}>
        <View style={s.headerLeftContainer}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={s.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            accessibilityHint="Returns to the previous screen"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { marginLeft: 8 }]}>Trip Planner</Text>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity
            onPress={handleOpenInsights}
            style={s.historyButton}
            accessibilityRole="button"
            accessibilityLabel="Open planner insights"
            accessibilityHint="Shows trip planner funnel analytics"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <BarChart3 size={20} color={C.accent} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleOpenHistory} 
            style={s.historyButton}
            accessibilityRole="button"
            accessibilityLabel="Open trip history"
            accessibilityHint="Shows your previously saved trips"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <History size={24} color={C.accent} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Journey Planning Card (Premium Manifest) */}
        <View style={s.premiumManifestCard}>
          <View style={s.manifestHeader}>
             <View style={s.manifestBadge}>
                 <Text style={s.manifestBadgeText}>NEW</Text>
             </View>
             <Text style={s.manifestTitle}>Journey Manifest</Text>
          </View>
          <Text style={s.manifestSubtitle}>
            Configure your route, vehicle vitals, and cost-optimized stops
          </Text>

          {/* Origin */}
          <View style={s.inputGroup}>
            <View style={s.inputIcon}>
              <MapPin size={18} color={C.green} fill={C.green + '20'} />
            </View>
            <TextInput
              style={s.input}
              placeholder="Origin — e.g. Mysuru, Karnataka"
              placeholderTextColor={C.textMuted}
              value={from}
              onChangeText={(t: string) => handleSearch(t, 'from')}
              onFocus={() => fromSuggestions.length > 0 && setShowFromSuggestions(true)}
              returnKeyType="next"
              accessibilityLabel="Trip origin"
              accessibilityHint="Enter your starting location"
            />
          </View>

          {showFromSuggestions && (
            <View style={s.suggestionsList}>
              {fromSuggestions.map((item) => (
                <TouchableOpacity
                  key={item.placeId}
                  style={s.suggestionItem}
                  onPress={() => selectSuggestion(item, 'from')}
                >
                  <Text style={s.suggestionMain} numberOfLines={1}>{item.mainText}</Text>
                  <Text style={s.suggestionSub} numberOfLines={1}>{item.secondaryText}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Connector line */}
          <View style={s.connector}>
            <View style={s.connectorLine} />
          </View>

          {/* Waypoints */}
          {waypoints.map((wpText, index) => (
            <React.Fragment key={`wp-${index}`}>
              <View style={s.inputGroup}>
                <View style={s.inputIcon}>
                  <View style={[s.dot, { backgroundColor: C.accent }]} />
                </View>
                <TextInput
                  style={s.input}
                  placeholder={`Stop ${index + 1}`}
                  placeholderTextColor={C.textMuted}
                  value={wpText}
                  onChangeText={(t) => handleSearch(t, index)}
                  onFocus={() => waypointSuggestions[index]?.length > 0 && setShowWaypointSuggestions({ ...showWaypointSuggestions, [index]: true })}
                  accessibilityLabel={`Stop ${index + 1}`}
                  accessibilityHint="Enter an optional stop between origin and destination"
                />
                <TouchableOpacity
                  onPress={() => removeWaypoint(index)}
                  style={s.removeWpBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove stop ${index + 1}`}
                  accessibilityHint="Removes this stop from your route"
                >
                  <Text style={s.removeWpText}>✕</Text>
                </TouchableOpacity>
              </View>

              {showWaypointSuggestions[index] && (
                <View style={s.suggestionsList}>
                  {waypointSuggestions[index].map((item) => (
                    <TouchableOpacity
                      key={item.placeId}
                      style={s.suggestionItem}
                      onPress={() => selectSuggestion(item, index)}
                    >
                      <Text style={s.suggestionMain} numberOfLines={1}>{item.mainText}</Text>
                      <Text style={s.suggestionSub} numberOfLines={1}>{item.secondaryText}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={s.connector}>
                <View style={s.connectorLine} />
              </View>
            </React.Fragment>
          ))}

          {/* Add Stop Button */}
          {waypoints.length < 5 && (
            <TouchableOpacity
              style={s.addStopBtn}
              onPress={addWaypoint}
              accessibilityRole="button"
              accessibilityLabel="Add stop"
              accessibilityHint="Adds an intermediate stop to your trip"
            >
              <Text style={s.addStopText}>+ Add Stop</Text>
            </TouchableOpacity>
          )}

          {/* Destination */}
          <View style={s.inputGroup}>
            <View style={s.inputIcon}>
              <MapPin size={18} color={C.red} fill={C.red + '20'} />
            </View>
            <TextInput
              style={s.input}
              placeholder="Destination — e.g. Kochi, Kerala"
              placeholderTextColor={C.textMuted}
              value={to}
              onChangeText={(t: string) => handleSearch(t, 'to')}
              onFocus={() => toSuggestions.length > 0 && setShowToSuggestions(true)}
              returnKeyType="done"
              onSubmitEditing={handleCalculate}
              accessibilityLabel="Trip destination"
              accessibilityHint="Enter your destination location"
            />
          </View>

          {showToSuggestions && (
            <View style={s.suggestionsList}>
              {toSuggestions.map((item) => (
                <TouchableOpacity
                  key={item.placeId}
                  style={s.suggestionItem}
                  onPress={() => selectSuggestion(item, 'to')}
                >
                  <Text style={s.suggestionMain} numberOfLines={1}>{item.mainText}</Text>
                  <Text style={s.suggestionSub} numberOfLines={1}>{item.secondaryText}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Calculate Action */}
          <TouchableOpacity
            onPress={handleCalculate}
            disabled={loading}
            activeOpacity={0.85}
            style={{ marginTop: hp(2) }}
            accessibilityRole="button"
            accessibilityLabel="Calculate trip manifest"
            accessibilityHint="Generates routes and estimated trip costs"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            <LinearGradient
              colors={[C.accent, '#FFA800']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.premiumCalcBtn}
            >
              {loading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <View style={s.calcBtnContent}>
                  <Text style={s.premiumCalcText}>Calculate Manifest</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {error && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}
        </View>

        {/* Results */}
        {result && result.routes.length > 0 && (
          <>
            {/* Route Overview (Current Route) */}
            <View style={s.premiumRouteCard}>
              <View style={s.premiumRouteHeader}>
                <Navigation size={18} color={C.accent} />
                <Text style={s.premiumRouteTitle}>Plan Verified</Text>
              </View>

              <View style={s.routeTimeline}>
                <View style={s.timelineItem}>
                  <View style={s.timelineLeft}>
                    <MapPin size={18} color={C.green} />
                    <View style={s.timelineLine} />
                  </View>
                  <View style={s.timelineRight}>
                    <Text style={s.timelineLabel}>Origin</Text>
                    <Text style={s.timelineValue}>{result.from}</Text>
                  </View>
                </View>

                {result.waypoints?.map((wp: string, i: number) => (
                  <View key={`ov-wp-${i}`} style={s.timelineItem}>
                    <View style={s.timelineLeft}>
                      <View style={s.timelineDot} />
                      <View style={s.timelineLine} />
                    </View>
                    <View style={s.timelineRight}>
                      <Text style={s.timelineLabel}>Stop {i + 1}</Text>
                      <Text style={s.timelineValue}>{wp}</Text>
                    </View>
                  </View>
                ))}

                <View style={s.timelineItem}>
                  <View style={s.timelineLeft}>
                    <MapPin size={18} color={C.red} fill={C.red + '20'} />
                  </View>
                  <View style={s.timelineRight}>
                    <Text style={s.timelineLabel}>Destination</Text>
                    <Text style={s.timelineValue}>{result.to}</Text>
                  </View>
                </View>
              </View>
            </View>
 
            {/* Vehicle Health Check (Premium Match) - Relocated below Current Route */}
            {primaryVehicle && (
              (() => {
                const healthStatus = getHealthAssessment(primaryVehicle.healthScore?.overallScore, selectedRoute?.distance?.km);
                const healthPcnt = primaryVehicle.healthScore?.overallScore || 100;
                const shortMake = getFirstWord(primaryVehicle.make);
                const shortModel = getModelFirstWord(primaryVehicle.model, shortMake);
                const shortVehicleName = `${shortMake} ${shortModel}`.trim() || shortMake || shortModel || 'Vehicle';
                return (
                  <View style={[s.premiumHealthCard, { borderColor: healthStatus.color + '33' }]}>
                    <View style={s.healthHeaderRow}>
                      <View style={s.healthTitleGroup}>
                        <HeartPulse size={20} color={healthStatus.color} />
                        <Text style={s.healthTitleText}>
                          {healthPcnt}% <Text style={s.healthTypeSub}>Vitals</Text>
                        </Text>
                      </View>
                      <View style={s.healthCarBadge}>
                         <Text style={s.healthCarNameText}>{shortVehicleName}</Text>
                      </View>
                    </View>
                    
                    <View style={s.healthBarContainer}>
                      <LinearGradient
                        colors={[healthStatus.color, healthStatus.color + '99']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[s.healthBarFillGradient, { width: `${healthPcnt}%` }]}
                      />
                    </View>
                    
                    <View style={s.healthStatusFooter}>
                       {healthStatus.icon === '✅' ? (
                         <CheckCircle2 size={14} color={C.green} />
                       ) : healthStatus.icon === '⚠️' ? (
                         <AlertTriangle size={14} color={C.orange} />
                       ) : (
                         <Info size={14} color={C.textSecondary} />
                       )}
                       <Text style={[s.healthStatusMsg, { color: healthStatus.color }]}>
                         {healthStatus.message}
                       </Text>
                    </View>

                    {primaryVehicle.healthScore?.explanations && healthPcnt < 80 && (
                      <View style={s.healthExpBox}>
                        {primaryVehicle.healthScore.explanations.slice(0, 2).map((exp: string, idx: number) => (
                          <View key={idx} style={s.expRow}>
                            <View style={[s.dotSmall, { backgroundColor: C.textMuted, marginTop: 6 }]} />
                            <Text style={s.healthExpText}>{exp}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })()
            )}

            {/* Route Tabs */}
            {result.routes.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.routeTabs}
                contentContainerStyle={s.routeTabsContent}
              >
                {result.routes.map((route, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      s.routeTab,
                      idx === selectedRouteIdx && s.routeTabActive,
                    ]}
                    onPress={() => handleSelectRoute(idx)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${route.routeName || `Route ${idx + 1}`}`}
                    accessibilityState={{ selected: idx === selectedRouteIdx }}
                  >
                    <Text
                      style={[
                        s.routeTabText,
                        idx === selectedRouteIdx && s.routeTabTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {route.routeName || `Route ${idx + 1}`}
                    </Text>
                    {idx === cheapestRouteIdx && (
                      <View style={s.badge}>
                        <Text style={s.badgeText}>Cheapest</Text>
                      </View>
                    )}
                    {idx === fastestRouteIdx &&
                      idx !== cheapestRouteIdx && (
                        <View style={[s.badge, { backgroundColor: C.orangeBg }]}>
                          <Text style={[s.badgeText, { color: C.orange }]}>
                            Fastest
                          </Text>
                        </View>
                      )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {selectedRoute && (
              <>
                {/* EV Planning Assistant (Phase 3) */}
                {result.fuelType === 'ELECTRIC' && selectedRoute.distance.km > 150 && (
                  <View style={[s.optimalCard, { borderLeftColor: C.green }]}>
                    <Text style={[s.optimalTitle, { color: C.green }]}>⚡ EV Charging Support</Text>
                    <Text style={s.optimalSub}>This is a long journey. Tap "⚡ EV" below to find chargers along your route.</Text>
                  </View>
                )}

                 {/* Total Cost Hero (Premium) */}
                <LinearGradient
                   colors={[C.accent, '#FFB800']}
                   start={{ x: 0, y: 0 }}
                   end={{ x: 1, y: 1 }}
                   style={s.premiumHeroCard}
                >
                  <View style={s.heroTopRow}>
                    <View style={s.heroLabelGroup}>
                       <Receipt size={16} color="rgba(0,0,0,0.6)" />
                       <Text style={s.premiumHeroLabel}>Estimated Total</Text>
                    </View>
                  </View>

                  <Text style={s.premiumHeroAmount}>
                    ₹{selectedRoute.costs.total.toLocaleString('en-IN')}
                  </Text>

                  <View style={s.heroSummaryPanel}>
                    <View style={s.heroStatItem}>
                      <Route size={14} color="rgba(0,0,0,0.5)" />
                      <Text style={s.heroStatText}>{selectedRoute.distance.text}</Text>
                    </View>
                    <View style={s.heroStatDivider} />
                    <View style={s.heroStatItem}>
                      <Timer size={14} color="rgba(0,0,0,0.5)" />
                      <Text style={s.heroStatText}>{selectedRoute.duration.text}</Text>
                    </View>
                  </View>

                  <View style={s.heroCostBreakdownRow}>
                    <View style={s.heroCostPill}>
                      <Text style={s.heroPillLabel}>Fuel</Text>
                      <Text style={s.heroPillValue}>₹{selectedRoute.costs.fuel}</Text>
                    </View>
                    <View style={s.heroCostPill}>
                      <Text style={s.heroPillLabel}>Tolls</Text>
                      <Text style={s.heroPillValue}>₹{selectedRoute.costs.tollFastag}</Text>
                    </View>
                  </View>

                  <View style={s.heroDivider} />

                  <View style={s.heroActionGrid}>
                    <TouchableOpacity
                      style={s.premiumNavBtn}
                      onPress={handleStartNavigation}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Start navigation"
                      accessibilityHint="Opens Google Maps navigation for this route"
                    >
                      <Route size={18} color={C.accent} />
                      <Text style={s.premiumNavBtnText}>Start Navigation</Text>
                    </TouchableOpacity>

                    <View style={s.heroUtilityGroup}>
                      <TouchableOpacity
                        onPress={handleToggleTraffic}
                        style={[s.utilityPill, showTraffic && s.utilityPillActive]}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={showTraffic ? 'Hide traffic layer' : 'Show traffic layer'}
                        accessibilityHint="Toggles live traffic overlay on map"
                        accessibilityState={{ selected: showTraffic }}
                      >
                         <Text style={{ fontSize: 16 }}>{showTraffic ? '🚥' : '⚪'}</Text>
                      </TouchableOpacity>

                      {result?.id && (
                        <TouchableOpacity
                          onPress={handleRefreshTraffic}
                          style={[s.utilityPill, refreshing && s.utilityPillDisabled]}
                          disabled={refreshing}
                          accessibilityRole="button"
                          accessibilityLabel="Refresh traffic"
                          accessibilityHint="Fetches updated route traffic and timings"
                          accessibilityState={{ disabled: refreshing, busy: refreshing }}
                        >
                          {refreshing ? (
                            <ActivityIndicator size="small" color="#000" />
                          ) : (
                            <Text style={{ fontSize: 16 }}>🔄</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </LinearGradient>

                {/* Map View relocated below Hero Card */}
                <View style={s.mapContainer}>
                  <MapView
                    ref={mapRef}
                    style={s.map}
                    initialRegion={{
                      latitude: 20.5937,
                      longitude: 78.9629,
                      latitudeDelta: 25,
                      longitudeDelta: 25,
                    }}
                    customMapStyle={darkMapStyle}
                    showsTraffic={showTraffic}
                  >
                    {renderMapContent()}
                  </MapView>
                  <TouchableOpacity
                    style={s.maximizeBtn}
                    onPress={handleOpenFullMap}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Open full screen map"
                    accessibilityHint="Expands map to full screen view"
                  >
                    <Maximize2 size={18} color="#FFF" />
                  </TouchableOpacity>
                </View>

                {/* Full Screen Map Modal */}
                <Modal visible={showFullMap} animationType="slide" transparent={false}>
                   <View style={s.fullMapContainer}>
                     <MapView
                       style={s.map}
                       initialRegion={{
                         latitude: 20.5937,
                         longitude: 78.9629,
                         latitudeDelta: 25,
                         longitudeDelta: 25,
                       }}
                       customMapStyle={darkMapStyle}
                       showsTraffic={showTraffic}
                     >
                        {renderMapContent()}
                     </MapView>
                     
                     <TouchableOpacity 
                       style={s.closeMapBtn}
                       onPress={handleCloseFullMap}
                       accessibilityRole="button"
                       accessibilityLabel="Close full screen map"
                       accessibilityHint="Returns to the trip details view"
                     >
                        <X size={24} color="#FFF" />
                     </TouchableOpacity>

                     <View style={s.mapFloatingInfo}>
                       <Text style={s.mapFloatingTitle}>{selectedRoute.distance.text} • {selectedRoute.duration.text}</Text>
                       <Text style={s.mapFloatingSub}>{result.from} → {result.to}</Text>
                     </View>
                   </View>
                </Modal>

                {/* Amenities Bar - Relocated below Map */}
                <View style={s.amenitiesBar}>
                  <Text style={s.amenityTitle}>Find along route:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.amenityCapsules}>
                    {['FuelStations', 'Hotel', 'ChargingStation', 'Hospital', 'PitStop'].map((cat) => (
                      <TouchableOpacity 
                        key={cat} 
                        style={s.amenityCapsule}
                        onPress={() => searchAlongRoute(cat === 'PitStop' ? 'Hotel' : cat)} // PitStop uses Hotel/POI for now
                        accessibilityRole="button"
                        accessibilityLabel={`Search ${cat} along route`}
                        accessibilityHint="Finds nearby places along the selected route"
                      >
                        <Text style={s.amenityCapsuleText}>
                          {cat === 'FuelStations' ? '⛽ Fuel' : 
                           cat === 'Hotel' ? '🏨 Hotels' :
                           cat === 'ChargingStation' ? '⚡ EV' : 
                           cat === 'PitStop' ? '📸 Pits' : '🏥 Hospital'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {searchingAmenities && <ActivityIndicator size="small" color={C.accent} style={{ marginTop: 10 }} />}
                </View>

                {/* Expandable Breakdown Section - Premium Accordion */}
                <View style={[s.premiumBreakdownCard, { paddingBottom: showDetailedBreakdown ? hp(1.2) : 0 }]}>
                  <TouchableOpacity 
                    style={s.breakdownHeader}
                    onPress={handleToggleBreakdown}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={showDetailedBreakdown ? 'Collapse detailed manifest' : 'Expand detailed manifest'}
                    accessibilityHint="Shows or hides detailed trip cost and toll information"
                    accessibilityState={{ expanded: showDetailedBreakdown }}
                  >
                    <View style={s.breakdownTitleGroup}>
                       <View style={s.breakdownIconBox}>
                          <List size={18} color={C.accent} />
                       </View>
                       <View>
                          <Text style={s.breakdownTitle}>Detailed Manifest</Text>
                          <Text style={s.breakdownSub}>Fuel, Routes & Toll Plazas</Text>
                       </View>
                    </View>
                    {showDetailedBreakdown ? (
                       <ChevronUp size={22} color={C.textMuted} />
                    ) : (
                       <ChevronDown size={22} color={C.textMuted} />
                    )}
                  </TouchableOpacity>


                  {showDetailedBreakdown && (
                    <View style={{ marginTop: hp(1.2), paddingHorizontal: wp(4.5), paddingBottom: hp(0.8) }}>
                      <View style={s.divider} />
                      
                      {/* Cost Breakdown Sub-Section */}
                      <Text style={[s.sectionTitle, { fontSize: wp(3.8), marginTop: hp(0.6), marginBottom: hp(1.2) }]}>Cost Breakdown</Text>
                      <CostRow
                        icon="⛽"
                        label="Fuel Cost"
                        amount={selectedRoute.costs.fuel}
                        sub={`${selectedRoute.fuelUsed.liters}L @ ₹${selectedRoute.fuelPriceUsed.price}/L (${selectedRoute.fuelPriceUsed.type})`}
                        color={C.orange}
                        bgColor={C.orangeBg}
                      />
                      <View style={s.divider} />
                      <CostRow
                        icon="🛣️"
                        label="Toll (FASTag)"
                        amount={selectedRoute.costs.tollFastag}
                        sub={`${selectedRoute.tolls.length} toll plaza${selectedRoute.tolls.length !== 1 ? 's' : ''}`}
                        color={C.accent}
                        bgColor={C.accentBg}
                      />
                      {selectedRoute.costs.tollCash > 0 && (
                        <>
                          <View style={s.divider} />
                          <CostRow
                            icon="💵"
                            label="Toll (Cash)"
                            amount={selectedRoute.costs.tollCash}
                            sub="Without FASTag"
                            color={C.textSecondary}
                            bgColor="rgba(136,136,136,0.1)"
                          />
                        </>
                      )}

                      <View style={s.divider} />

                      {/* Trip Details Sub-Section */}
                      <Text style={[s.sectionTitle, { fontSize: wp(3.8), marginBottom: hp(1.2) }]}>Trip Details</Text>
                      <View style={s.detailsGrid}>
                        <DetailItem label="Distance" value={selectedRoute.distance.text} />
                        <DetailItem label="Duration" value={selectedRoute.duration.text} />
                        <DetailItem
                          label="Fuel Efficiency"
                          value={`${selectedRoute.fuelEfficiency.city}/${selectedRoute.fuelEfficiency.hwy} ${selectedRoute.fuelEfficiency.unit}`}
                        />
                        <DetailItem
                          label="Vehicle Type"
                          value={result.vehicleType}
                        />
                      </View>

                      {/* Toll Plazas Sub-Section */}
                      {selectedRoute.tolls.length > 0 && (
                        <>
                          <View style={s.divider} />
                          <Text style={[s.sectionTitle, { fontSize: wp(3.8), marginBottom: hp(1) }]}>
                            Toll Plazas ({selectedRoute.tolls.length})
                          </Text>
                          {selectedRoute.tolls.map((toll, idx) => (
                            <View key={idx}>
                              {idx > 0 && <View style={s.divider} />}
                              <View style={s.tollRow}>
                                <View style={s.tollInfo}>
                                  <Text style={s.tollName} numberOfLines={1}>
                                    {toll.name}
                                  </Text>
                                  <Text style={s.tollRoad}>
                                    {toll.road}
                                    {toll.state ? ` • ${toll.state}` : ''}
                                  </Text>
                                </View>
                                <View style={s.tollCosts}>
                                  <Text style={s.tollFastag}>
                                    ₹{toll.tagCost}
                                  </Text>
                                  {toll.cashCost > 0 && toll.cashCost !== toll.tagCost && (
                                    <Text style={s.tollCash}>
                                      Cash: ₹{toll.cashCost}
                                    </Text>
                                  )}
                                </View>
                              </View>
                            </View>
                          ))}
                        </>
                      )}
                    </View>
                  )}
                </View>
              </>
            )}

            {result && !error && (
              <TouchableOpacity 
                style={s.planningCtaCard}
                onPress={() => handleOpenPlanner('trip_cta')}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="Open trip itinerary planner"
                accessibilityHint="Plan hotels, activities, and transport for this trip"
              >
                <LinearGradient
                  colors={hasItinerarySelections
                    ? ['rgba(50, 215, 75, 0.15)', 'rgba(50, 215, 75, 0.05)']
                    : ['rgba(255, 215, 0, 0.15)', 'rgba(255, 159, 10, 0.05)']}
                  style={s.planningCtaInner}
                >
                  <View style={[s.iconCircle, hasItinerarySelections && { backgroundColor: 'rgba(50, 215, 75, 0.1)' }]}>
                    {hasItinerarySelections ? (
                      <CheckCircle2 size={20} color={C.green} />
                    ) : (
                      <Sparkles size={20} color={C.accent} />
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.planningCtaTitle}>
                      {hasItinerarySelections
                        ? 'Itinerary Ready. Tap to Open'
                        : 'Tap to Plan Your Itinerary'}
                    </Text>
                    <Text style={s.planningCtaSub}>
                      {hasItinerarySelections
                        ? `Tap to view/edit: ${planningData?.selectedHotelId ? '1 Hotel, ' : ''}${planningData?.selectedActivities?.length || 0} Activities${planningData?.selectedBikeId ? ', 1 Transport' : ''}`
                        : 'Tap here to add hotels, activities, and transport for this trip.'}
                    </Text>
                  </View>
                  <View style={[s.planningCtaBadge, hasItinerarySelections && { backgroundColor: C.green }]}>
                    <Text style={s.planningCtaBadgeText}>OPEN</Text>
                    <ChevronRight size={14} color="#000" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Trip Planning Flow Overlay */}
      {isPlanningMode && (
        <Modal
          animationType="slide"
          transparent={false}
          visible={isPlanningMode}
          onRequestClose={() => {
            setIsPlanningMode(false);
            setRequestedPlanningStep(undefined);
            tripPlannerAnalytics.plannerExited({
              source: 'modal_request_close',
            });
          }}
        >
          <TripPlannerFlow 
            tripId={tripId}
            tripResult={result}
            from={result?.from || ''}
            to={result?.to || ''}
            initialStep={requestedPlanningStep}
            initialPlanning={planningData}
            onClose={async () => {
              setIsPlanningMode(false);
              setRequestedPlanningStep(undefined);
              const data = await loadPlanningState(tripId);
              setPlanningData(data);
            }} 
          />
        </Modal>
      )}

      {/* Trip History Modal */}
      <TripHistoryModal 
        isVisible={isHistoryMode} 
        onClose={() => setIsHistoryMode(false)}
        onSelectTrip={handleSelectHistoryTrip}
      />
    </View>
  );
}

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
  { "featureType": "administrative.country", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "administrative.land_parcel", "stylers": [{ "visibility": "off" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#181818" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "featureType": "poi.park", "elementType": "labels.text.stroke", "stylers": [{ "color": "#1b1b1b" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] },
  { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#373737" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3c3c3c" }] },
  { "featureType": "road.highway.controlled_access", "elementType": "geometry", "stylers": [{ "color": "#4e4e4e" }] },
  { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "featureType": "transit", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#3d3d3d" }] }
];

// ─── Sub Components ──────────────────────────────────────────────────────────

function CostRow({
  icon,
  label,
  amount,
  sub,
  color,
  bgColor,
}: {
  icon: string;
  label: string;
  amount: number;
  sub: string;
  color: string;
  bgColor: string;
}) {
  return (
    <View style={s.costRow}>
      <View style={[s.costIcon, { backgroundColor: bgColor }]}>
        <Text style={{ fontSize: wp(4.5) }}>{icon}</Text>
      </View>
      <View style={s.costInfo}>
        <Text style={s.costLabel}>{label}</Text>
        <Text style={s.costSub}>{sub}</Text>
      </View>
      <Text style={[s.costAmount, { color }]}>
        ₹{amount.toLocaleString('en-IN')}
      </Text>
    </View>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detailItem}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Header
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: hp(6),
    paddingBottom: 15,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontFamily: 'Outfit-Bold', color: '#FFF' },
  backBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: -10,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: wp(5), paddingTop: hp(1) },

  // Card
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: wp(5),
    marginBottom: hp(2),
  },
  cardTitle: { fontSize: wp(5), fontFamily: 'Outfit-Bold', color: C.text, marginBottom: hp(0.5) },
  cardSubtitle: { fontSize: wp(3.5), fontFamily: 'Outfit-Medium', color: C.textSecondary, marginBottom: hp(2.5) },
  
  // Premium Route Card
  premiumRouteCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: wp(4.5),
    marginBottom: hp(2),
  },
  premiumRouteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: hp(2.5),
    paddingBottom: hp(1),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  premiumRouteTitle: {
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
    color: C.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  routeTimeline: {
    paddingLeft: wp(1),
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: hp(5),
  },
  timelineLeft: {
    alignItems: 'center',
    width: wp(8),
  },
  timelineRight: {
    flex: 1,
    paddingLeft: wp(2),
    paddingBottom: hp(1.5),
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 4,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.accent,
    marginTop: 6,
  },
  timelineLabel: {
    fontSize: wp(2.8),
    fontFamily: 'Outfit-Medium',
    color: C.textMuted,
    textTransform: 'uppercase',
  },
  timelineValue: {
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Bold',
    color: C.text,
    marginTop: 2,
  },

  // Input
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.inputBorder,
    paddingHorizontal: wp(3.5),
    height: 54,
  },
  inputIcon: { width: wp(6), alignItems: 'center' },
  dot: { width: wp(2.5), height: wp(2.5), borderRadius: wp(1.25) },
  input: {
    flex: 1,
    fontSize: wp(3.8),
    fontFamily: 'Outfit-Medium',
    color: C.text,
    marginLeft: wp(2.5),
    height: '100%',
    padding: 0,
  },

  // Connector
  connector: { alignItems: 'flex-start', paddingLeft: wp(6.2), height: hp(1.5) },
  connectorLine: {
    width: 2,
    height: '100%',
    backgroundColor: C.divider,
  },

  // Manifest Styles
  premiumManifestCard: {
    backgroundColor: C.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: wp(5.5),
    marginBottom: hp(2.5),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  manifestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  manifestBadge: {
    backgroundColor: C.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  manifestBadgeText: {
    fontSize: wp(2.5),
    fontFamily: 'Outfit-Bold',
    color: C.accent,
  },
  manifestTitle: {
    fontSize: wp(4.8),
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
  },
  manifestSubtitle: {
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Medium',
    color: C.textSecondary,
    marginBottom: hp(2.5),
    lineHeight: 18,
  },
  premiumCalcBtn: {
    height: 54,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  // Planning CTA
  planningCtaCard: {
    marginTop: hp(2),
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  planningCtaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp(4.5),
  },
  planningCtaTitle: {
    color: '#FFF',
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
  },
  planningCtaSub: {
    color: C.textSecondary,
    fontSize: wp(2.8),
    fontFamily: 'Outfit-Medium',
    marginTop: 2,
  },
  planningCtaBadge: {
    backgroundColor: C.accent,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  planningCtaBadgeText: {
    fontSize: wp(2.3),
    fontFamily: 'Outfit-Black',
    color: '#000',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calcBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  premiumCalcText: {
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
    color: '#000',
    letterSpacing: 0.5,
  },

  // Error
  errorBox: {
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderRadius: 10,
    padding: wp(3),
    marginTop: hp(1.5),
  },
  errorText: { fontSize: wp(3.2), fontFamily: 'Outfit-Medium', color: C.red, textAlign: 'center' },

  // Route Tabs
  routeTabs: { marginBottom: hp(2) },
  routeTabsContent: { gap: wp(2) },
  routeTab: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
    minWidth: wp(30),
  },
  routeTabActive: { borderColor: C.accent, backgroundColor: C.accentBg },
  routeTabText: { fontSize: wp(3.2), fontFamily: 'Outfit-SemiBold', color: C.textSecondary },
  routeTabTextActive: { color: C.accent },
  badge: {
    backgroundColor: C.greenBg,
    borderRadius: 6,
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.3),
    marginTop: hp(0.5),
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: wp(2.5), fontFamily: 'Outfit-Bold', color: C.green },

  // Premium Hero
  premiumHeroCard: {
    borderRadius: 24,
    padding: wp(5),
    paddingVertical: hp(2),
    marginBottom: hp(2),
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp(1),
  },
  heroLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  premiumHeroLabel: {
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Bold',
    color: 'rgba(0,0,0,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  premiumHeroActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumHeroAmount: {
    fontSize: wp(9),
    fontFamily: 'Outfit-Bold',
    color: '#000000',
    textAlign: 'center',
  },
  heroSummaryPanel: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'center',
    marginTop: hp(1),
    alignItems: 'center',
    gap: 12,
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroStatText: {
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
    color: 'rgba(0,0,0,0.7)',
  },
  heroStatDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  heroCostBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: wp(3),
    marginTop: hp(1.5),
  },
  heroCostPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  heroPillLabel: {
    fontSize: wp(2.8),
    fontFamily: 'Outfit-Medium',
    color: 'rgba(0,0,0,0.5)',
    marginBottom: 2,
  },
  heroPillValue: {
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Bold',
    color: '#000',
  },
  heroActionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
    marginBottom: hp(2),
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: hp(1.5),
    width: '100%',
  },
  heroActionGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  premiumNavBtn: {
    flex: 1,
    backgroundColor: '#000',
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  premiumNavBtnText: {
    color: '#FFF',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Bold',
  },
  heroUtilityGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  utilityPill: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  utilityPillActive: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderColor: 'rgba(255,255,255,0.8)',
  },
  utilityPillDisabled: {
    opacity: 0.5,
  },

  // Section
  sectionTitle: {
    fontSize: wp(4.2),
    fontFamily: 'Outfit-Bold',
    color: C.text,
    marginBottom: hp(2),
  },

  // Cost Row
  costRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: hp(0.9), paddingHorizontal: wp(1) },
  costIcon: {
    width: wp(10),
    height: wp(10),
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  costInfo: { flex: 1, marginLeft: wp(3) },
  costLabel: { fontSize: wp(3.8), fontFamily: 'Outfit-SemiBold', color: C.text },
  costSub: { fontSize: wp(3.2), fontFamily: 'Outfit-Medium', color: C.textSecondary, marginTop: hp(0.3) },
  costAmount: { fontSize: wp(4.2), fontFamily: 'Outfit-Bold' },

  // Divider
  divider: { height: 1, backgroundColor: C.divider, marginVertical: hp(1.5) },

  // Map
  mapContainer: {
    height: hp(30),
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  map: { flex: 1 },
  maximizeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  fullMapContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeMapBtn: {
    position: 'absolute',
    top: hp(6),
    right: wp(5),
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mapFloatingInfo: {
    position: 'absolute',
    bottom: hp(5),
    left: wp(5),
    right: wp(5),
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: wp(4),
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mapFloatingTitle: {
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
    marginBottom: 4,
  },
  mapFloatingSub: {
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Medium',
    color: C.textSecondary,
  },
  markerDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  markerIcon: { fontSize: 12 },

  // Amenities
  amenitiesBar: {
    marginBottom: hp(2),
  },
  amenityTitle: {
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Medium',
    color: C.textSecondary,
    marginBottom: hp(1),
  },
  amenityCapsules: {
    gap: wp(2),
  },
  amenityCapsule: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.8),
  },
  amenityCapsuleText: {
    fontSize: wp(3),
    fontFamily: 'Outfit-Bold',
    color: C.text,
  },

  // Hero Additions
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(4),
  },
  heroActionBtn: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    marginLeft: 8,
  },
  heroActionBtnDisabled: {
    opacity: 0.5,
  },
  heroActionIcon: {
    fontSize: wp(4.5),
  },
  shareIcon: {
    fontSize: wp(5),
    color: '#000000',
    opacity: 0.6,
  },

  // Details Grid
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: wp(2.6) },
  detailItem: {
    width: wp(42.5),
    backgroundColor: C.inputBg,
    borderRadius: 10,
    paddingVertical: hp(1.1),
    paddingHorizontal: wp(3.2),
  },
  detailLabel: { fontSize: wp(2.8), fontFamily: 'Outfit-Bold', color: C.textSecondary, textTransform: 'uppercase' },
  detailValue: { fontSize: wp(3.8), fontFamily: 'Outfit-Bold', color: C.text, marginTop: hp(0.5) },

  // Toll Row
  tollRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: hp(0.9), paddingHorizontal: wp(0.8) },
  tollInfo: { flex: 1 },
  tollName: { fontSize: wp(3.5), fontFamily: 'Outfit-SemiBold', color: C.text },
  tollRoad: { fontSize: wp(2.8), fontFamily: 'Outfit-Medium', color: C.textSecondary, marginTop: hp(0.3) },
  tollCosts: { alignItems: 'flex-end', marginLeft: wp(3) },
  tollFastag: { fontSize: wp(3.8), fontFamily: 'Outfit-Bold', color: C.accent },
  tollCash: { fontSize: wp(2.8), fontFamily: 'Outfit-Medium', color: C.textSecondary, marginTop: hp(0.3) },

  // Suggestions
  suggestionsList: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    overflow: 'hidden',
    zIndex: 100,
  },
  suggestionItem: {
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(4),
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  suggestionMain: {
    fontSize: wp(3.5),
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
    marginBottom: hp(0.2),
  },
  suggestionSub: {
    fontSize: wp(3),
    fontFamily: 'Outfit-Medium',
    color: '#8E8E93',
  },

  // Add Stop
  addStopBtn: {
    alignSelf: 'flex-start',
    paddingVertical: hp(1),
    paddingHorizontal: wp(2),
    marginLeft: wp(8),
    marginBottom: hp(1),
  },
  addStopText: {
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Bold',
    color: C.accent,
  },
  removeWpBtn: {
    padding: wp(2),
  },
  removeWpText: {
    fontSize: wp(3.5),
    color: C.textSecondary,
  },
  // Breakdown Styles
  premiumBreakdownCard: {
    backgroundColor: C.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: hp(3),
    overflow: 'hidden',
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp(4.5),
    paddingVertical: hp(1.8),
  },
  breakdownTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breakdownIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownTitle: {
    fontSize: wp(4.2),
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
  },
  breakdownSub: {
    fontSize: wp(2.8),
    fontFamily: 'Outfit-Medium',
    color: C.textSecondary,
    marginTop: 2,
  },
  breakdownBody: {
    marginTop: hp(1.2),
    paddingHorizontal: wp(4.5),
    gap: hp(1),
  },
  manifestQuickStats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: C.inputBg,
    paddingVertical: hp(0.9),
    paddingHorizontal: wp(2.8),
  },
  manifestStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: hp(0.4),
  },
  manifestStatLabel: {
    fontSize: wp(2.5),
    fontFamily: 'Outfit-Bold',
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  manifestStatValue: {
    fontSize: wp(3.3),
    fontFamily: 'Outfit-Bold',
    color: C.text,
    marginTop: hp(0.2),
  },
  manifestStatDivider: {
    width: 1,
    height: '85%',
    backgroundColor: C.divider,
  },
  manifestSectionCard: {
    backgroundColor: C.inputBg,
    borderRadius: 14,
    paddingHorizontal: wp(3.8),
    paddingVertical: hp(1.3),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp(1),
  },
  sectionTitleTight: {
    fontSize: wp(3.7),
    fontFamily: 'Outfit-Bold',
    color: C.text,
  },
  sectionMetaPill: {
    fontSize: wp(2.6),
    fontFamily: 'Outfit-Bold',
    color: C.accent,
    backgroundColor: C.accentBg,
    paddingHorizontal: wp(2.3),
    paddingVertical: hp(0.35),
    borderRadius: 999,
  },
  tollCard: {
    backgroundColor: C.inputBg,
    borderRadius: 12,
    paddingHorizontal: wp(3.2),
    paddingVertical: hp(1),
    marginBottom: hp(0.8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  tollTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tollIndexBadge: {
    minWidth: wp(7),
    borderRadius: 999,
    backgroundColor: C.accentBg,
    paddingHorizontal: wp(1.8),
    paddingVertical: hp(0.35),
    alignItems: 'center',
    marginRight: wp(2),
  },
  tollIndexText: {
    fontSize: wp(2.5),
    fontFamily: 'Outfit-Bold',
    color: C.accent,
  },
  tollCostRow: {
    flexDirection: 'row',
    gap: wp(2),
    marginTop: hp(0.9),
  },
  tollCostPill: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    paddingHorizontal: wp(2.2),
    paddingVertical: hp(0.7),
  },
  tollCostPillMuted: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tollCostLabel: {
    fontSize: wp(2.3),
    fontFamily: 'Outfit-Bold',
    color: C.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  tollCostLabelMuted: {
    fontSize: wp(2.3),
    fontFamily: 'Outfit-Bold',
    color: C.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },

  // Phase 3 Additions
  weatherAnnotation: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  weatherText: {
    fontSize: 10,
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
  },
  optimalCard: {
    backgroundColor: C.card,
    marginBottom: hp(1.5),
    padding: wp(4),
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: C.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  optimalTitle: {
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Bold',
    color: C.accent,
    marginBottom: 4,
  },
  optimalSub: {
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Medium',
    color: C.textSecondary,
  },
  
  // Premium Layout Additions
  premiumOptimalCard: {
    marginBottom: hp(1.8),
    padding: wp(4.5),
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(4),
  },
  optimalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optimalMain: {
    flex: 1,
  },
  optimalTitleSmall: {
    fontSize: wp(2.8),
    fontFamily: 'Outfit-Bold',
    color: C.accent,
    letterSpacing: 1,
    marginBottom: 2,
  },
  optimalTimeDisplay: {
    fontSize: wp(4.2),
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
    marginBottom: 6,
  },
  savingsBadge: {
    backgroundColor: C.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  savingsText: {
    fontSize: wp(2.8),
    fontFamily: 'Outfit-Bold',
    color: '#000',
  },

  premiumHealthCard: {
    backgroundColor: C.card,
    marginBottom: hp(1.8),
    padding: wp(5),
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  healthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(1),
  },
  healthTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  healthTitleText: {
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
    fontSize: wp(5),
  },
  healthTypeSub: {
    fontSize: wp(3.5),
    color: C.textSecondary,
    fontWeight: '500',
  },
  healthCarBadge: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  healthCarNameText: {
    fontSize: wp(2.8),
    fontFamily: 'Outfit-Bold',
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  healthBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    marginVertical: hp(2),
    overflow: 'hidden',
  },
  healthBarFillGradient: {
    height: '100%',
    borderRadius: 4,
  },
  healthStatusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  healthStatusMsg: {
    flex: 1,
    fontFamily: 'Outfit-SemiBold',
    fontSize: wp(3.2),
    lineHeight: 18,
  },
  healthExpBox: {
    marginTop: hp(1.5),
    paddingTop: hp(1.5),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  expRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  healthExpText: {
    flex: 1,
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3),
    color: C.textSecondary,
  },

  mikeBtn: {
    backgroundColor: C.card,
    marginVertical: 12,
    marginHorizontal: wp(5),
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,191,0,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mikeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mikeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  mikeTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: C.text,
  },
  mikeSub: {
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 2,
  },
  mikeArrow: {
    fontSize: 18,
    color: C.accent,
    fontWeight: 'bold',
  },
  routeOverview: {
    paddingVertical: 8,
  },
  routeOverviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  routeOverviewText: {
    fontSize: 14,
    color: C.text,
    marginLeft: 12,
    fontFamily: 'Outfit-Medium',
  },
  routeOverviewDivider: {
    width: 2,
    height: 12,
    backgroundColor: C.divider,
    marginLeft: 3,
    marginVertical: 2,
  },
  dotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  navBtn: {
    backgroundColor: '#1A1A1A',
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
  },
  navBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
  },
  historyButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
