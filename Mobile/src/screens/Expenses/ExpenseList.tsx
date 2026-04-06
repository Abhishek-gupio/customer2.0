import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  Pressable,
  AppState,
  AppStateStatus,
} from 'react-native';
import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, Bill } from '../../navigation/types';
import BackButton from '../../components/BackButton';
import LinearGradient from 'react-native-linear-gradient';
import { api } from '../../services/api';
import { getAbsoluteUrl } from '../../config';
import { getExpenseIcon, getExpenseColor, formatDate } from './expenseUtils';
import { getAndClearExpenseListRefresh } from '../../utils/refreshManager';
import NotificationPermission from '../../components/NotificationPermission';
import Bills from './Bills';
import { colors } from '../../theme/colors';
import { fontSizes as FS, fontWeights as FW } from '../../theme/Fontsize';
import Ionicons from "react-native-vector-icons/Ionicons";
import { vehicleService, Vehicle } from '../../services/vehicleService';
import { setPrimaryVehicleId, getPrimaryVehicleId } from '../../services/storage';
import { FlashList } from "@shopify/flash-list";
import { clearCachedValue, getCachedValue, getStaleCachedValue, setCachedValue } from '../../services/cache';
const FlashListAny = FlashList as any;
const EXPENSES_CACHE_KEY = 'cache:expenses:list';
const EXPENSES_CACHE_TTL_MS = 3 * 60 * 1000;

type DocListNavProp = NativeStackNavigationProp<RootStackParamList>;

type ProgressRowProps = {
  label: string;
  value: string;
  percent: number;
  color: string;
};


const ProgressRow = ({ label, value, percent, color }: ProgressRowProps) => {
  return (
    <View style={{ marginTop: hp(2) }}>
      <View style={styles.rowBetween}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>{value}</Text>
      </View>

      <View style={styles.progressBg}>
        <View
          style={[
            styles.progressFill,
            { width: `${percent}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
};

const toAbsoluteUrl = (url?: string | null) => getAbsoluteUrl(url);

const toNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatServiceType = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value
    .trim()
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char: string) => char.toUpperCase());
};

const formatPartLabel = (part: any) => {
  const rawValue =
    (typeof part?.partName === 'string' && part.partName.trim() && part.partName) ||
    (typeof part?.partType === 'string' && part.partType.trim() && part.partType) ||
    '';

  if (!rawValue) return null;

  return rawValue
    .trim()
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char: string) => char.toUpperCase());
};

const hasServiceDetails = (item: any) =>
  Boolean(item?.serviceType) ||
  Boolean(item?.servicedPart) ||
  Boolean(item?.location) ||
  ['SERVICE', 'REPAIR'].includes(String(item?.category || '').toUpperCase());

const toDate = (value: unknown) => {
  if (!value) return null;
  const d = new Date(value as any);
  if (!Number.isNaN(d.getTime())) return d;

  if (typeof value === 'string') {
    const parts = value.split('-');
    if (parts.length === 3 && parts[0].length === 2) {
      const day = Number(parts[0]);
      const month = Number(parts[1]);
      const year = Number(parts[2]);
      const parsed = new Date(year, month - 1, day);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  return null;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const ExpenseFeed = () => {
  const navigation = useNavigation<DocListNavProp>();
  const route = useRoute();


  const serviceTypes = ['All', 'Fuel', 'Service', 'Toll', 'Insurance', 'Parking', 'Other'];


  const [selectedType, setSelectedType] = React.useState('All');
  const [timelineFilter, setTimelineFilter] = React.useState('Monthly');
  const [expensesList, setExpensesList] = React.useState<any[]>([]);
  const [rawExpenses, setRawExpenses] = React.useState<any[]>([]); // Raw data with Date objects
  const [loading, setLoading] = React.useState(false);
  const [bills, setBills] = React.useState<Bill[]>([]);
  const [showAllExpenses, setShowAllExpenses] = React.useState(false);
  const [primaryVehicle, setPrimaryVehicle] = React.useState<Vehicle | null>(null);
  const [vehicleId, setVehicleId] = React.useState<string | null>(null);
  const isRefreshingRef = React.useRef(false);
  const pendingRefreshRef = React.useRef(false);
  const vehicleIdRef = React.useRef<string | null>(null);
  const [isCalendarVisible, setIsCalendarVisible] = React.useState(false);
  const [calendarMonth, setCalendarMonth] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedFromDate, setSelectedFromDate] = React.useState<Date | null>(null);
  const [selectedToDate, setSelectedToDate] = React.useState<Date | null>(null);
  const [calendarSelectionTarget, setCalendarSelectionTarget] = React.useState<'from' | 'to'>('from');
  const [selectedExpense, setSelectedExpense] = React.useState<any | null>(null);

  // ── Computed stats ──
  const [totalThisMonth, setTotalThisMonth] = React.useState(0);
  const [totalFiltered, setTotalFiltered] = React.useState(0);
  const [growthPercent, setGrowthPercent] = React.useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = React.useState<
    { key: string; label: string; color: string; amount: number; percent: number }[]
  >([]);

  const CATEGORY_COLORS: Record<string, string> = {
    FUEL: '#2196f3',
    SERVICE: '#ff6d00',
    TOLL: '#9c27b0',
    TOLLS: '#9c27b0',
    INSURANCE: '#00bcd4',
    PARKING: '#C0C0C0',
    CHALLAN: '#f44336',
    EMI: '#4caf50',
    OTHER: '#00c853',
  };

  const extractExpenseItems = React.useCallback((response: any) => {
    const items =
      response?.data?.expenses ??
      response?.data?.data?.expenses ??
      response?.data?.data ??
      response?.expenses ??
      response?.data ??
      [];
    return Array.isArray(items) ? items : [];
  }, []);

  const loadPrimaryVehicle = React.useCallback(async (): Promise<Vehicle | null> => {
    const cachedPrimaryId = getPrimaryVehicleId();
    if (cachedPrimaryId) {
      vehicleIdRef.current = cachedPrimaryId;
      setVehicleId((prev) => prev ?? cachedPrimaryId);
    }

    try {
      const res = await vehicleService.getVehicles();
      const list = Array.isArray(res)
        ? res
        : Array.isArray((res as any)?.data)
          ? (res as any).data
          : [];
      const primary: Vehicle | null =
        list.find((v: any) => v?.isPrimary) ||
        list.find((v: any) => v?.id === cachedPrimaryId) ||
        list[0] ||
        null;

      const nextVehicleId = primary?.id ?? null;
      setPrimaryVehicleId(nextVehicleId);
      setPrimaryVehicle(primary);
      vehicleIdRef.current = nextVehicleId;
      setVehicleId(nextVehicleId);
      return primary;
    } catch {
      if (!cachedPrimaryId) {
        setPrimaryVehicle(null);
        vehicleIdRef.current = null;
        setVehicleId(null);
      }
      return null;
    }
  }, []);

  const fetchExpenses = React.useCallback(async (targetVehicleId?: string | null) => {
    if (isRefreshingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    isRefreshingRef.current = true;
    setLoading(true);
    try {
      const resolvedVehicleId = targetVehicleId ?? primaryVehicle?.id ?? vehicleIdRef.current ?? null;
      const cachedExpenses = getStaleCachedValue<any[]>(resolvedVehicleId ? `${EXPENSES_CACHE_KEY}:${resolvedVehicleId}` : EXPENSES_CACHE_KEY);
      if (cachedExpenses && expensesList.length === 0) {
        setRawExpenses(cachedExpenses);
      }
      const response = await api.get<any>(
        resolvedVehicleId ? `/v1/expenses?vehicleId=${resolvedVehicleId}` : '/v1/expenses'
      );
      console.log("response", response);
      let list = extractExpenseItems(response);

      if (resolvedVehicleId && list.length === 0) {
        const fallbackResponse = await api.get<any>('/v1/expenses');
        const fallbackItems = extractExpenseItems(fallbackResponse);
        list = fallbackItems.filter((item: any) => {
          const itemVehicleId = typeof item?.vehicleId === 'string' ? item.vehicleId : null;
          return !itemVehicleId || itemVehicleId === resolvedVehicleId;
        });
      }

      setRawExpenses(list);

      const mappedExpenses = list.map((item: any) => {
        const category = String(item.category || 'OTHER').toUpperCase();
        const linkedServiceRecord =
          item.serviceRecord ||
          (Array.isArray(item.serviceRecords) ? item.serviceRecords[0] : null);
        const location =
          item.location ||
          item.address ||
          item.merchantAddress ||
          item.storeAddress ||
          item.vendorAddress ||
          item.place ||
          item.placeName ||
          item.placeAddress ||
          item.metadata?.location ||
          linkedServiceRecord?.garageName ||
          linkedServiceRecord?.location ||
          item.merchantName ||
          null;
        const serviceType = formatServiceType(
          item.serviceType ||
          linkedServiceRecord?.serviceType ||
          item.metadata?.serviceType,
        );
        const servicedPart =
          (Array.isArray(linkedServiceRecord?.parts)
            ? linkedServiceRecord.parts.map(formatPartLabel).filter(Boolean).join(', ')
            : null) || null;
        return {
          id: item.id,
          title: category,
          type: category.charAt(0) + category.slice(1).toLowerCase(),
          amount: toNumber(item.amount),
          date: formatDate(item.date),
          rawDate: toDate(item.date),
          source: item.source,
          icon: getExpenseIcon(category),
          color: getExpenseColor(category),
          category,
          location,
          serviceType,
          servicedPart,
        };
      });
      setExpensesList(mappedExpenses);

      const recentBills = list
        .filter((item: any) => !!item.receiptUrl)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5)
        .map((item: any): Bill => {
          const category = String(item.category || 'OTHER').toUpperCase();
          return {
            id: item.id,
            title: category.charAt(0).toUpperCase() + category.slice(1).toLowerCase(),
            amount: toNumber(item.amount),
            uploadedAt: formatDate(item.date, 'dd MMM'),
            status: String(item.status || '').toLowerCase() === 'pending' ? 'pending' : 'verified',
            image: toAbsoluteUrl(item.receiptUrl),
            warrantyMonths: item.warrantyMonths,
          };
        });

      setBills(recentBills);
      setCachedValue(
        resolvedVehicleId ? `${EXPENSES_CACHE_KEY}:${resolvedVehicleId}` : EXPENSES_CACHE_KEY,
        list,
        EXPENSES_CACHE_TTL_MS,
      );
    } catch (error) {
      console.error("Fetch Expenses Error:", error);
      const resolvedVehicleId = targetVehicleId ?? primaryVehicle?.id ?? vehicleIdRef.current ?? null;
      const cachedExpenses = getCachedValue<any[]>(resolvedVehicleId ? `${EXPENSES_CACHE_KEY}:${resolvedVehicleId}` : EXPENSES_CACHE_KEY) || getStaleCachedValue<any[]>(resolvedVehicleId ? `${EXPENSES_CACHE_KEY}:${resolvedVehicleId}` : EXPENSES_CACHE_KEY);
      if (cachedExpenses) {
        setRawExpenses(cachedExpenses);
      }
    } finally {
      setLoading(false);
      isRefreshingRef.current = false;
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        fetchExpenses(targetVehicleId);
      }
    }
  }, [extractExpenseItems, primaryVehicle?.id]);

  React.useEffect(() => {
    loadPrimaryVehicle();
  }, [loadPrimaryVehicle]);

  React.useEffect(() => {
    vehicleIdRef.current = vehicleId;
  }, [vehicleId]);

  React.useEffect(() => {
    if (!primaryVehicle?.id) return;
    fetchExpenses(primaryVehicle.id);
  }, [primaryVehicle?.id, fetchExpenses]);

  React.useEffect(() => {
    const params = route.params as { expense?: any } | undefined;
    
    // Only process if we have an expense object, a primary vehicleId, and it hasn't been processed yet.
    if (params?.expense && primaryVehicle?.id && !params.expense._processed) {

      const saveAndRefresh = async (expenseData: any) => {
        try {
          // 1. Add primary vehicle ID if missing
          const payload = {
            ...expenseData,
            vehicleId: expenseData.vehicleId || primaryVehicle.id,
            source: expenseData.source || 'NOTIFICATION', // Good to have a source
          };

          // 2. Save the new expense
          await api.post('/v1/expenses', payload);
          clearCachedValue(EXPENSES_CACHE_KEY);

          // 3. Mark params as processed to avoid re-saving on re-renders
          // By creating a new object for the params, we ensure a re-render
          // that the useEffect will catch, but the `_processed` flag will stop it.
          navigation.setParams({ 
            expense: { ...expenseData, _processed: true } 
          });

          // 4. Refresh the expense list to show the new item
          fetchExpenses(primaryVehicle.id);

        } catch (error) {
          console.error('Failed to auto-save expense from params:', error);
          // Optionally, alert the user
        }
      };

      saveAndRefresh(params.expense);
    }
  }, [route.params, primaryVehicle?.id, navigation, fetchExpenses]);

  useFocusEffect(
    React.useCallback(() => {
      // Check if refresh was requested and apply appropriate delay
      const needsRefresh = getAndClearExpenseListRefresh();
      const timers: ReturnType<typeof setTimeout>[] = [];

      let cancelled = false;

      const refreshCurrentVehicleExpenses = async () => {
        const resolvedPrimaryVehicle = await loadPrimaryVehicle();
        if (cancelled) return;
        fetchExpenses(resolvedPrimaryVehicle?.id ?? null);
        if (needsRefresh) {
          // Follow-up fetch helps when backend write/indexing is slightly delayed.
          timers.push(setTimeout(() => {
            fetchExpenses(resolvedPrimaryVehicle?.id ?? null);
          }, 1000));
        }
      };

      refreshCurrentVehicleExpenses();

      return () => {
        cancelled = true;
        timers.forEach(clearTimeout);
      };
    }, [fetchExpenses, loadPrimaryVehicle])
  );

  React.useEffect(() => {
    let currentAppState: AppStateStatus = AppState.currentState;

    const subscription = AppState.addEventListener('change', nextAppState => {
      const wasBackgrounded =
        currentAppState === 'background' || currentAppState === 'inactive';

      currentAppState = nextAppState;

      if (nextAppState !== 'active' || !wasBackgrounded) {
        return;
      }

      loadPrimaryVehicle()
        .then((resolvedPrimaryVehicle) => {
          fetchExpenses(resolvedPrimaryVehicle?.id ?? vehicleIdRef.current ?? null);
        })
        .catch((error) => {
          console.error('Failed to refresh expenses on app resume:', error);
        });
    });

    return () => {
      subscription.remove();
    };
  }, [fetchExpenses, loadPrimaryVehicle]);

  // ── Compute "Total This Month" ──
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (!getAndClearExpenseListRefresh()) {
        return;
      }

      loadPrimaryVehicle().then((resolvedPrimaryVehicle) => {
        fetchExpenses(resolvedPrimaryVehicle?.id ?? null);
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchExpenses, loadPrimaryVehicle]);

  React.useEffect(() => {
    if (rawExpenses.length === 0) {
      setTotalThisMonth(0);
      return;
    }
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const thisMonthExpenses = rawExpenses.filter((e: any) => {
      const d = toDate(e.date);
      if (!d) return false;
      return d >= monthStart && d <= monthEnd;
    });
    const total = thisMonthExpenses.reduce((sum: number, e: any) => sum + toNumber(e.amount), 0);
    setTotalThisMonth(total);

    // Growth: compare with last month
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const lastMonthExpenses = rawExpenses.filter((e: any) => {
      const d = toDate(e.date);
      if (!d) return false;
      return d >= lastMonthStart && d <= lastMonthEnd;
    });
    const lastTotal = lastMonthExpenses.reduce((sum: number, e: any) => sum + toNumber(e.amount), 0);
    if (lastTotal > 0) {
      setGrowthPercent(Math.round(((total - lastTotal) / lastTotal) * 100));
    } else {
      setGrowthPercent(0);
    }
  }, [rawExpenses]);

  // ── Compute "Total Spent" by timeline + category breakdown ──
  React.useEffect(() => {
    if (rawExpenses.length === 0) {
      setTotalFiltered(0);
      setCategoryBreakdown([]);
      return;
    }

    const now = new Date();
    let filterStart: Date;

    switch (timelineFilter) {
      case 'Daily':
        filterStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'Weekly': {
        const dayOfWeek = now.getDay();
        filterStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        break;
      }
      case 'Yearly':
        filterStart = new Date(now.getFullYear(), 0, 1);
        break;
      case 'Monthly':
      default:
        filterStart = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const filtered = rawExpenses.filter((e: any) => {
      const d = toDate(e.date);
      if (!d) return false;
      if (selectedFromDate && selectedToDate) {
        return d >= startOfDay(selectedFromDate) && d <= endOfDay(selectedToDate);
      }
      if (selectedFromDate) return sameDay(d, selectedFromDate);
      return d >= filterStart;
    });

    // Keep totals in sync with the same category filter used for the list chips.
    const filteredByType =
      selectedType === 'All'
        ? filtered
        : filtered.filter((e: any) => {
            const category = String(e.category || 'OTHER').toUpperCase();
            const typeLabel = category.charAt(0) + category.slice(1).toLowerCase();
            return typeLabel.toUpperCase() === selectedType.toUpperCase();
          });

    const total = filteredByType.reduce((sum: number, e: any) => sum + toNumber(e.amount), 0);
    console.log(
      "Calculated totalFiltered:",
      total,
      "for timelineFilter:",
      timelineFilter,
      "selectedType:",
      selectedType,
      "selectedFromDate:",
      selectedFromDate,
      "selectedToDate:",
      selectedToDate
    );
    setTotalFiltered(total);

    // Category breakdown
    const catMap: Record<string, number> = {};
    filteredByType.forEach((e: any) => {
      const cat = e.category || 'OTHER';
      catMap[cat] = (catMap[cat] || 0) + toNumber(e.amount);
    });

    const breakdown = Object.entries(catMap)
      .map(([cat, amount]) => ({
        key: cat,
        label: cat.charAt(0) + cat.slice(1).toLowerCase(),
        color: CATEGORY_COLORS[cat] || '#00c853',
        amount,
        percent: total > 0 ? Math.round((amount / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    setCategoryBreakdown(breakdown);
  }, [rawExpenses, timelineFilter, selectedFromDate, selectedToDate, selectedType]);

  const dateFilteredExpenses = React.useMemo(() => {
    if (!selectedFromDate && !selectedToDate) return expensesList;
    return expensesList.filter(item => {
      if (!item.rawDate) return false;
      if (selectedFromDate && selectedToDate) {
        return item.rawDate >= startOfDay(selectedFromDate) && item.rawDate <= endOfDay(selectedToDate);
      }
      if (selectedFromDate) return sameDay(item.rawDate, selectedFromDate);
      return true;
    });
  }, [expensesList, selectedFromDate, selectedToDate]);

  const filteredExpenses =
    selectedType === 'All'
      ? dateFilteredExpenses
      : dateFilteredExpenses.filter(item => item.type.toUpperCase() === selectedType.toUpperCase());

  const displayedExpenses = showAllExpenses ? filteredExpenses : filteredExpenses.slice(0, 3);

  const calendarTitle = calendarMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const formatRangeDate = (date: Date) =>
    date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const selectedDateLabel =
    selectedFromDate && selectedToDate
      ? `${formatRangeDate(selectedFromDate)} - ${formatRangeDate(selectedToDate)}`
      : selectedFromDate
        ? `${formatRangeDate(selectedFromDate)} - Select end date`
        : 'All Dates';

  const onSelectCalendarDay = (day: Date) => {
    if (calendarSelectionTarget === 'from' || !selectedFromDate) {
      setSelectedFromDate(day);
      if (selectedToDate && day > selectedToDate) {
        setSelectedToDate(null);
      }
      setCalendarSelectionTarget('to');
      return;
    }

    if (day < selectedFromDate) {
      setSelectedToDate(selectedFromDate);
      setSelectedFromDate(day);
    } else {
      setSelectedToDate(day);
    }
    setIsCalendarVisible(false);
  };

  const buildCalendarDays = React.useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];

    for (let i = 0; i < firstDay; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);

    return cells;
  }, [calendarMonth]);

  const formatCurrency = (val: number) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${val.toLocaleString('en-IN')}`;
    return `₹${val}`;
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      key={item.id}
      style={styles.listCard}
      activeOpacity={0.9}
      onPress={() => setSelectedExpense(item)}
    >
      <View
        style={[
          styles.iconCircle,
          {
            borderColor: `${item.color}55`,
            backgroundColor: `${item.color}16`,
          },
        ]}
      >
        <Icon name={item.icon} size={wp(5)} color={item.color} />
      </View>

      <View style={styles.itemContent}>
        <View style={styles.itemHeaderRow}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.itemAmount} numberOfLines={1}>
            ₹{item.amount}
          </Text>
        </View>

        <Text style={styles.itemMeta}>
          {item.date} {'\u2022'} {item.source}
        </Text>

        {item.location ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Location</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {item.location}
            </Text>
          </View>
        ) : null}
        {hasServiceDetails(item) && item.serviceType ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {item.serviceType}
            </Text>
          </View>
        ) : null}
        {hasServiceDetails(item) && item.servicedPart ? (
          <View style={[styles.detailRow, styles.detailRowTop]}>
            <Text style={styles.detailLabel}>Part</Text>
            <Text style={styles.detailValue} numberOfLines={2}>
              {item.servicedPart}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlashListAny
        data={displayedExpenses}
        estimatedItemSize={80}
        onRefresh={fetchExpenses}
        refreshing={loading}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: hp(5) }}
        ListHeaderComponent={
          <>
            <View style={styles.shader}>
              <View style={styles.header}>
                <BackButton onPress={() => navigation.goBack()} />
                <Text style={styles.headerTitle}>Expenses</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('addExpense')}
                >
                  <Icon name="plus" size={wp(5)} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={{ paddingHorizontal: wp(4), marginTop: hp(1) }}>
                <NotificationPermission />
              </View>

              <View style={styles.card}>
                <Text style={styles.cardLabel}>Total This Month</Text>
                <Text style={styles.amount}>
                  {formatCurrency(totalThisMonth)}
                </Text>

                <View style={styles.row}>
                  <Icon
                    name={growthPercent >= 0 ? 'arrow-up' : 'arrow-down'}
                    size={wp(3)}
                    color={growthPercent >= 0 ? '#ff5252' : '#00c853'}
                  />
                  <Text
                    style={[
                      styles.growthText,
                      { color: growthPercent >= 0 ? '#ff5252' : '#00c853' },
                    ]}
                  >
                    {' '}
                    {growthPercent >= 0 ? '+' : ''}
                    {growthPercent}% from last month
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.card,
                { marginTop: hp(-4), backgroundColor: 'rgb(18, 18, 23)' },
              ]}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.cardLabel}>Total Spent</Text>
                <View style={styles.percentBadge}>
                  <TouchableOpacity
                    onPress={() => {
                      setCalendarSelectionTarget(
                        selectedFromDate ? 'to' : 'from',
                      );
                      setIsCalendarVisible(true);
                    }}
                    style={styles.calendarButton}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={22}
                      color="#FFFFFF"
                    />
                    <Text style={styles.selectedDateText}>
                      {selectedDateLabel}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.amount}>{formatCurrency(totalFiltered)}</Text>

              <View style={styles.timelineContainer}>
                <View style={styles.timelineSubContainer}>
                  {['Daily', 'Weekly', 'Monthly', 'Yearly'].map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.timelineItem,
                        timelineFilter === item && styles.activeTimelineItem,
                      ]}
                      onPress={() => {
                        setTimelineFilter(item);
                        setSelectedFromDate(null);
                        setSelectedToDate(null);
                        setCalendarSelectionTarget('from');
                        setIsCalendarVisible(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.timelineText,
                          timelineFilter === item && styles.activeTimelineText,
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {categoryBreakdown.length > 0 ? (
                categoryBreakdown.map((item) => (
                  <ProgressRow
                    key={item.key}
                    label={item.label}
                    percent={item.percent}
                    color={item.color}
                    value={`₹${item.amount.toLocaleString('en-IN')} (${
                      item.percent
                    }%)`}
                  />
                ))
              ) : (
                <View style={{ paddingVertical: hp(2), alignItems: 'center' }}>
                  <Text style={{ color: '#666', fontSize: wp(3.5) }}>
                    No data for this period
                  </Text>
                </View>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterRow}>
                {serviceTypes.map((item) => {
                  const isActive = selectedType === item;

                  return (
                    <TouchableOpacity
                      key={item}
                      style={[styles.filterChip, isActive && styles.activeChip]}
                      onPress={() => setSelectedType(item)}
                    >
                      <Text
                        style={[
                          styles.filterText,
                          isActive && styles.activeText,
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {filteredExpenses.length === 0 && !loading && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No expenses found</Text>
              </View>
            )}
          </>
        }
        renderItem={renderItem}
        ListFooterComponent={
          <>
            {filteredExpenses.length > 3 && (
              <TouchableOpacity
                style={styles.viewMoreBtn}
                onPress={() => setShowAllExpenses(!showAllExpenses)}
              >
                <Text style={styles.viewMoreText}>
                  {showAllExpenses ? 'View Less' : 'View More'}
                </Text>
                <Icon
                  name={showAllExpenses ? 'chevron-up' : 'chevron-down'}
                  size={wp(3)}
                  color="#4CAF50"
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>
            )}

            <Bills bills={bills} />

            <TouchableOpacity
              style={styles.sectionTitleCentered}
              onPress={() => navigation.navigate('BudgetSettings')}
            >
              <Icon name="wallet" size={wp(5)} color="#fff" />
              <Text style={{ color: '#fff', marginLeft: wp(2) }}>
                Set Budget
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sectionTitleCenteredAnalytics}
              onPress={() => navigation.navigate('ExpenseAnalytics')}
            >
              <Icon name="chart-bar" size={wp(5)} color="#fff" />
              <Text style={{ color: '#fff', marginLeft: wp(2) }}>
                View Detailed Analytics
              </Text>
            </TouchableOpacity>
          </>
        }
      />
      <Modal
        visible={isCalendarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCalendarVisible(false)}
      >
        <Pressable
          style={styles.calendarModalBackdrop}
          onPress={() => setIsCalendarVisible(false)}
        >
          <View style={styles.calendarModalCard}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                onPress={() =>
                  setCalendarMonth(
                    (prev) =>
                      new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                  )
                }
              >
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>{calendarTitle}</Text>
              <TouchableOpacity
                onPress={() =>
                  setCalendarMonth(
                    (prev) =>
                      new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                  )
                }
              >
                <Ionicons name="chevron-forward" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.weekHeader}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <Text key={`${day}-${idx}`} style={styles.weekHeaderText}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.rangePickerRow}>
              <TouchableOpacity
                style={[
                  styles.rangeChip,
                  calendarSelectionTarget === 'from' && styles.rangeChipActive,
                ]}
                onPress={() => setCalendarSelectionTarget('from')}
              >
                <Text style={styles.rangeChipLabel}>From</Text>
                <Text style={styles.rangeChipValue}>
                  {selectedFromDate
                    ? formatRangeDate(selectedFromDate)
                    : 'Select date'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.rangeChip,
                  calendarSelectionTarget === 'to' && styles.rangeChipActive,
                ]}
                onPress={() => setCalendarSelectionTarget('to')}
              >
                <Text style={styles.rangeChipLabel}>To</Text>
                <Text style={styles.rangeChipValue}>
                  {selectedToDate
                    ? formatRangeDate(selectedToDate)
                    : 'Select date'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.calendarGrid}>
              {buildCalendarDays.map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }
                const isFrom = selectedFromDate
                  ? sameDay(day, selectedFromDate)
                  : false;
                const isTo = selectedToDate
                  ? sameDay(day, selectedToDate)
                  : false;
                const isInRange =
                  selectedFromDate && selectedToDate
                    ? day >= startOfDay(selectedFromDate) &&
                      day <= endOfDay(selectedToDate)
                    : false;
                const isSelected = isFrom || isTo;
                return (
                  <TouchableOpacity
                    key={day.toISOString()}
                    style={[
                      styles.dayCell,
                      isInRange && styles.dayCellInRange,
                      isSelected && styles.dayCellSelected,
                    ]}
                    onPress={() => onSelectCalendarDay(day)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isSelected && styles.dayTextSelected,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.calendarActionRow}>
              <TouchableOpacity
                style={styles.calendarActionBtn}
                onPress={() => {
                  setSelectedFromDate(null);
                  setSelectedToDate(null);
                  setCalendarSelectionTarget('from');
                  setIsCalendarVisible(false);
                }}
              >
                <Text style={styles.calendarActionText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.calendarActionBtn}
                onPress={() => setIsCalendarVisible(false)}
              >
                <Text style={styles.calendarActionText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(selectedExpense)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedExpense(null)}
      >
        <Pressable
          style={styles.expenseModalBackdrop}
          onPress={() => setSelectedExpense(null)}
        >
          <Pressable style={styles.expenseModalCard} onPress={() => {}}>
            {selectedExpense ? (
              <>
                <View style={styles.expenseModalHeader}>
                  <View style={styles.expenseModalTitleRow}>
                    <View
                      style={[
                        styles.expenseModalIconWrap,
                        {
                          borderColor: `${selectedExpense.color}55`,
                          backgroundColor: `${selectedExpense.color}16`,
                        },
                      ]}
                    >
                      <Icon
                        name={selectedExpense.icon}
                        size={wp(5)}
                        color={selectedExpense.color}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.expenseModalTitle}>
                        {selectedExpense.title}
                      </Text>
                      <Text style={styles.expenseModalMeta}>
                        {selectedExpense.date} {'\u2022'} {selectedExpense.source}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => setSelectedExpense(null)}
                    style={styles.expenseModalClose}
                  >
                    <Ionicons name="close" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.expenseAmountPanel}>
                  <Text style={styles.expenseAmountLabel}>Amount</Text>
                  <Text style={styles.expenseAmountValue}>
                    ₹{selectedExpense.amount}
                  </Text>
                </View>

                <View style={styles.expenseDetailList}>
                  <View style={styles.expenseDetailRow}>
                    <Text style={styles.expenseDetailLabel}>Category</Text>
                    <Text style={styles.expenseDetailValue}>
                      {selectedExpense.type}
                    </Text>
                  </View>

                  <View style={styles.expenseDetailRow}>
                    <Text style={styles.expenseDetailLabel}>Date</Text>
                    <Text style={styles.expenseDetailValue}>
                      {selectedExpense.date}
                    </Text>
                  </View>

                  <View style={styles.expenseDetailRow}>
                    <Text style={styles.expenseDetailLabel}>Source</Text>
                    <Text style={styles.expenseDetailValue}>
                      {selectedExpense.source || '-'}
                    </Text>
                  </View>

                  {selectedExpense.location ? (
                    <View style={[styles.expenseDetailRow, styles.expenseDetailRowTop]}>
                      <Text style={styles.expenseDetailLabel}>Location</Text>
                      <Text style={styles.expenseDetailValue}>
                        {selectedExpense.location}
                      </Text>
                    </View>
                  ) : null}

                  {selectedExpense.serviceType ? (
                    <View style={styles.expenseDetailRow}>
                      <Text style={styles.expenseDetailLabel}>Type</Text>
                      <Text style={styles.expenseDetailValue}>
                        {selectedExpense.serviceType}
                      </Text>
                    </View>
                  ) : null}

                  {selectedExpense.servicedPart ? (
                    <View style={[styles.expenseDetailRow, styles.expenseDetailRowTop]}>
                      <Text style={styles.expenseDetailLabel}>Part</Text>
                      <Text style={styles.expenseDetailValue}>
                        {selectedExpense.servicedPart}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

export default ExpenseFeed;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: { flex: 1, color: colors.Primary, fontSize: wp(5.5), fontWeight: "700", marginLeft: wp(3) },
  subHeder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(5),
  },
  card: {
    backgroundColor: 'rgb(18, 18, 23)',
    marginHorizontal: wp(4),
    marginTop: hp(2),
    borderRadius: wp(8),
    padding: wp(5),
    borderWidth: wp(0.2),
    borderColor: '#f3efef70',
  },
  cardLabel: { color: '#aaa', fontSize: wp(3.8) },
  shader: {
    borderBottomLeftRadius: wp(12),
    borderBottomRightRadius: wp(12),
    paddingBottom: hp(6),
    marginBottom: hp(0),
  },
  amount: {
    color: '#fff',
    fontSize: wp(9),
    fontWeight: '700',
    marginTop: hp(1),
  },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: hp(1) },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarButton: {
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.5),
    flexDirection:"row",
    alignItems: 'center',
    gap:wp(1.5)
  },
  selectedDateText: {
    color: '#aaa',
    fontSize: wp(3.2),
  },
  growthText: { color: '#00c853', fontSize: wp(3.5) },
  percentBadge: {
    flexDirection: 'row',
    backgroundColor: '#9999',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.7),
    borderRadius: wp(8),
  },
  percentText: { color: '#ff5252', fontSize: wp(3.5) },
  progressLabel: { color: '#fff', fontSize: wp(4) },
  progressValue: { color: '#aaa', fontSize: wp(3.5) },
  progressBg: {
    height: hp(1.2),
    backgroundColor: '#333',
    borderRadius: wp(5),
    marginTop: hp(1),
  },
  progressFill: { height: '100%', borderRadius: wp(5) },
  filterRow: { flexDirection: 'row', paddingHorizontal: wp(4), marginTop: hp(2) },
  filterChip: {
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: wp(6),
    paddingHorizontal: wp(5),
    paddingVertical: hp(1),
    marginRight: wp(3),
  },
  activeChip: { backgroundColor: colors.Yellow },  
  filterText: { color: '#fff', fontSize: wp(3.8) },
  activeText: { color: '#000', fontWeight: '600' },
  listCard: {
    flexDirection: 'row',
    backgroundColor: '#15181d',
    marginHorizontal: wp(4),
    marginVertical: hp(1),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.8),
    borderRadius: wp(5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: wp(11),
    height: wp(11),
    borderRadius: wp(3.8),
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(3.5),
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: wp(3),
    minWidth: 0,
  },
  itemTitle: {
    color: '#fff',
    fontSize: wp(4.3),
    fontWeight: '700',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  itemMeta: {
    color: '#8f98aa',
    fontSize: wp(3),
    marginTop: hp(0.35),
    marginBottom: hp(0.8),
  },
  itemSub: { color: '#888', fontSize: wp(3.2) },
  itemAmount: {
    color: '#fff',
    fontSize: wp(4.6),
    fontWeight: '700',
    marginLeft: wp(2),
    flexShrink: 0,
    maxWidth: '38%',
    textAlign: 'right',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(0.35),
    minWidth: 0,
  },
  detailRowTop: {
    alignItems: 'flex-start',
  },
  detailLabel: {
    width: wp(14),
    color: '#6f7788',
    fontSize: wp(3),
    fontWeight: '600',
    marginRight: wp(2),
    flexShrink: 0,
  },
  detailValue: {
    flex: 1,
    color: '#dce2ec',
    fontSize: wp(3.15),
    fontWeight: '500',
    minWidth: 0,
    flexShrink: 1,
  },
  sectionTitleCentered: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(4),
    backgroundColor: '#4CAF50',
    borderRadius: wp(6),
    marginHorizontal: wp(4),
    marginTop: wp(4),
  },
  sectionTitleCenteredAnalytics: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(4),
    backgroundColor: '#1a1a1a',
    borderRadius: wp(6),
    borderWidth: 1,
    borderColor: '#b4bd79',
    margin: wp(4),
  },
  timelineContainer: {
    marginTop: hp(2),
    backgroundColor: 'rgb(31, 31, 36)',
    borderRadius: wp(6),
    padding: wp(1.5),
  },
  timelineSubContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineItem: {
    paddingVertical: hp(0.8),
    paddingHorizontal: wp(3),
    borderRadius: wp(5),
  },
  activeTimelineItem: { backgroundColor: colors.Yellow },
  timelineText: {
    color: 'rgb(164, 164, 166)',
    fontWeight: '600'
  },
  activeTimelineText: { color: '#000' },
  emptyContainer: {
    padding: wp(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: wp(4),
  },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(1.5),
    marginHorizontal: wp(4),
    marginBottom: hp(1),
  },
  viewMoreText: {
    color: '#4CAF50',
    fontSize: wp(3.8),
    fontWeight: '600',
  },
  calendarModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: wp(6),
  },
  calendarModalCard: {
    backgroundColor: '#161616',
    borderRadius: wp(5),
    padding: wp(4),
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp(1.5),
  },
  calendarTitle: {
    color: '#fff',
    fontSize: wp(4.3),
    fontWeight: '600',
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: hp(1),
  },
  weekHeaderText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: '#8e8e8e',
    fontWeight: '600',
  },
  rangePickerRow: {
    flexDirection: 'row',
    gap: wp(2),
    marginBottom: hp(1.2),
  },
  rangeChip: {
    flex: 1,
    backgroundColor: '#1f1f1f',
    borderRadius: wp(3),
    borderWidth: 1,
    borderColor: '#2f2f2f',
    paddingVertical: hp(0.8),
    paddingHorizontal: wp(2.5),
  },
  rangeChipActive: {
    borderColor: colors.Yellow,
  },
  rangeChipLabel: {
    color: '#9ca3af',
    fontSize: wp(3),
    marginBottom: hp(0.3),
  },
  rangeChipValue: {
    color: '#fff',
    fontSize: wp(3.4),
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(1.2),
    borderRadius: wp(3),
  },
  dayCellSelected: {
    backgroundColor: colors.Yellow,
  },
  dayCellInRange: {
    backgroundColor: '#3a341a',
  },
  dayText: {
    color: '#fff',
    fontSize: wp(3.8),
  },
  dayTextSelected: {
    color: '#000',
    fontWeight: '700',
  },
  calendarActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: hp(1.5),
    gap: wp(2),
  },
  calendarActionBtn: {
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(0.8),
    borderRadius: wp(4),
    backgroundColor: '#222',
  },
  calendarActionText: {
    color: '#fff',
    fontWeight: '600',
  },
  expenseModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: wp(5),
  },
  expenseModalCard: {
    backgroundColor: '#161a20',
    borderRadius: wp(5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: wp(4.5),
  },
  expenseModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: hp(1.6),
    gap: wp(3),
  },
  expenseModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: wp(3),
  },
  expenseModalIconWrap: {
    width: wp(11),
    height: wp(11),
    borderRadius: wp(3.8),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseModalTitle: {
    color: '#fff',
    fontSize: wp(4.6),
    fontWeight: '700',
  },
  expenseModalMeta: {
    color: '#8f98aa',
    fontSize: wp(3.1),
    marginTop: hp(0.3),
  },
  expenseModalClose: {
    width: wp(9),
    height: wp(9),
    borderRadius: wp(4.5),
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseAmountPanel: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: wp(4),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  expenseAmountLabel: {
    color: '#8f98aa',
    fontSize: wp(3),
    marginBottom: hp(0.4),
  },
  expenseAmountValue: {
    color: '#fff',
    fontSize: wp(7),
    fontWeight: '700',
  },
  expenseDetailList: {
    gap: hp(0.8),
  },
  expenseDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    paddingVertical: hp(0.4),
  },
  expenseDetailRowTop: {
    alignItems: 'flex-start',
  },
  expenseDetailLabel: {
    width: wp(18),
    color: '#6f7788',
    fontSize: wp(3.1),
    fontWeight: '600',
    marginRight: wp(2.5),
    flexShrink: 0,
  },
  expenseDetailValue: {
    flex: 1,
    minWidth: 0,
    color: '#e4e9f1',
    fontSize: wp(3.35),
    fontWeight: '500',
  },
  Dropcontainer:{
    padding:wp(3)
  }
});