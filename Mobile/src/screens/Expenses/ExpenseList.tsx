import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  Pressable,
} from 'react-native';
import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
import { colors }from '../../theme/colors';
import { fontSizes as FS, fontWeights as FW} from '../../theme/Fontsize';
import Ionicons from "react-native-vector-icons/Ionicons";
import { vehicleService } from '../../services/vehicleService';

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


  const serviceTypes = ['All', 'Fuel', 'Service', 'Toll', 'Insurance', 'Parking', 'Other'];

  const [selectedType, setSelectedType] = React.useState('All');
  const [timelineFilter, setTimelineFilter] = React.useState('Monthly');
  const [expensesList, setExpensesList] = React.useState<any[]>([]);
  const [rawExpenses, setRawExpenses] = React.useState<any[]>([]); // Raw data with Date objects
  const [loading, setLoading] = React.useState(false);
  const [bills, setBills] = React.useState<Bill[]>([]);
  const [showAllExpenses, setShowAllExpenses] = React.useState(false);
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
    PARKING: '#ffeb3b',
    CHALLAN: '#f44336',
    EMI: '#4caf50',
    OTHER: '#00c853',
  };

  const fetchExpenses = React.useCallback(async () => {
    if (isRefreshingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    if (!vehicleIdRef.current) {
      setRawExpenses([]);
      setExpensesList([]);
      setBills([]);
      return;
    }
    isRefreshingRef.current = true;
    setLoading(true);
    try {
      const response = await api.get<any>(
        vehicleIdRef.current ? `/v1/expenses?vehicleId=${vehicleIdRef.current}` : '/v1/expenses'
      );
      console.log("response", response);
      const items =
        response?.data?.expenses ??
        response?.data?.data?.expenses ??
        response?.data?.data ??
        response?.expenses ??
        response?.data ??
        [];
      const list = Array.isArray(items) ? items : [];

      setRawExpenses(list);

      const mappedExpenses = list.map((item: any) => {
        const category = String(item.category || 'OTHER').toUpperCase();
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
    } catch (error) {
      console.error("Fetch Expenses Error:", error);
    } finally {
      setLoading(false);
      isRefreshingRef.current = false;
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        fetchExpenses();
      }
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await vehicleService.getVehicles();
        const list = Array.isArray(res)
          ? res
          : Array.isArray((res as any)?.data)
            ? (res as any).data
            : [];
        const primary = list.find((v: any) => v?.isPrimary) || list[0];
        if (mounted) setVehicleId(primary?.id ?? null);
      } catch {
        if (mounted) setVehicleId(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    vehicleIdRef.current = vehicleId;
  }, [vehicleId]);

  React.useEffect(() => {
    if (vehicleId === null) return;
    fetchExpenses();
  }, [vehicleId, fetchExpenses]);

  useFocusEffect(
    React.useCallback(() => {
      // Check if refresh was requested and apply appropriate delay
      const needsRefresh = getAndClearExpenseListRefresh();
      const timers: ReturnType<typeof setTimeout>[] = [];

      fetchExpenses();
      if (needsRefresh) {
        // Follow-up fetch helps when backend write/indexing is slightly delayed.
        timers.push(setTimeout(() => {
          fetchExpenses();
        }, 1000));
      }

      return () => {
        timers.forEach(clearTimeout);
      };
    }, [fetchExpenses])
  );

  // ── Compute "Total This Month" ──
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
    const total = filtered.reduce((sum: number, e: any) => sum + toNumber(e.amount), 0);
    console.log("Calculated totalFiltered:", total, "for timelineFilter:", timelineFilter, "selectedFromDate:", selectedFromDate, "selectedToDate:", selectedToDate);
    setTotalFiltered(total);

    // Category breakdown
    const catMap: Record<string, number> = {};
    filtered.forEach((e: any) => {
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
  }, [rawExpenses, timelineFilter, selectedFromDate, selectedToDate]);

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

  return (

    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchExpenses} tintColor="#fff" />
        }
      >
        <View style={styles.shader}>
          <View style={styles.header}>
            <BackButton onPress={() => navigation.goBack()} />
            <Text style={styles.headerTitle}>Expenses</Text>
            <TouchableOpacity onPress={() => navigation.navigate('addExpense')}>
              <Icon name="plus" size={wp(5)} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: wp(4), marginTop: hp(1) }}>
            <NotificationPermission />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Total This Month</Text>
            <Text style={styles.amount}>{formatCurrency(totalThisMonth)}</Text>

            <View style={styles.row}>
              <Icon
                name={growthPercent >= 0 ? 'arrow-up' : 'arrow-down'}
                size={wp(3)}
                color={growthPercent >= 0 ? '#ff5252' : '#00c853'}
              />
              <Text style={[
                styles.growthText,
                { color: growthPercent >= 0 ? '#ff5252' : '#00c853' }
              ]}>
                {' '}{growthPercent >= 0 ? '+' : ''}{growthPercent}% from last month
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.card, { marginTop: hp(-4), backgroundColor: 'rgb(18, 18, 23)' }]}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardLabel}>Total Spent</Text>
            <View style={styles.percentBadge}>
              <TouchableOpacity
                onPress={() => {
                  setCalendarSelectionTarget(selectedFromDate ? 'to' : 'from');
                  setIsCalendarVisible(true);
                }}
                style={styles.calendarButton}
              >
                <Ionicons name="calendar-outline" size={22} color="#FFFFFF" />
                <Text style={styles.selectedDateText}>{selectedDateLabel}</Text>
              </TouchableOpacity>
              
            </View>
          </View>
          <Text style={styles.amount}>{formatCurrency(totalFiltered)}</Text>

          <View style={styles.timelineContainer}>
            <View style={styles.timelineSubContainer}>
              {['Daily', 'Weekly', 'Monthly', 'Yearly'].map(item => (
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
                  setIsCalendarVisible(false)
                  }
                  }
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
            categoryBreakdown.map(item => (
              <ProgressRow
                key={item.key}
                label={item.label}
                percent={item.percent}
                color={item.color}
                value={`₹${item.amount.toLocaleString('en-IN')} (${item.percent}%)`}
              />
            ))
          ) : (
            <View style={{ paddingVertical: hp(2), alignItems: 'center' }}>
              <Text style={{ color: '#666', fontSize: wp(3.5) }}>No data for this period</Text>
            </View>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            {serviceTypes.map(item => {
              const isActive = selectedType === item;

              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.filterChip,
                    isActive && styles.activeChip,
                  ]}
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

        {filteredExpenses.length === 0 && !loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No expenses found</Text>
          </View>
        ) : (
          displayedExpenses.map(item => (
            <View key={item.id} style={styles.listCard}>
              <View style={[styles.iconCircle, { borderColor: item.color }]}>
                <Icon name={item.icon} size={wp(5)} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.title}</Text>

                <Text style={styles.itemSub}>
                  {item.date} · {item.source}
                </Text>
              </View>

              <Text style={styles.itemAmount}>₹{item.amount}</Text>
            </View>
          ))
        )}

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

      </ScrollView>
      <Modal
        visible={isCalendarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCalendarVisible(false)}
      >
        <Pressable style={styles.calendarModalBackdrop} onPress={() => setIsCalendarVisible(false)}>
          <View style={styles.calendarModalCard}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                onPress={() =>
                  setCalendarMonth(
                    prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  )
                }
              >
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>{calendarTitle}</Text>
              <TouchableOpacity
                onPress={() =>
                  setCalendarMonth(
                    prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  )
                }
              >
                <Ionicons name="chevron-forward" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.weekHeader}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <Text key={`${day}-${idx}`} style={styles.weekHeaderText}>{day}</Text>
              ))}
            </View>

            <View style={styles.rangePickerRow}>
              <TouchableOpacity
                style={[styles.rangeChip, calendarSelectionTarget === 'from' && styles.rangeChipActive]}
                onPress={() => setCalendarSelectionTarget('from')}
              >
                <Text style={styles.rangeChipLabel}>From</Text>
                <Text style={styles.rangeChipValue}>
                  {selectedFromDate ? formatRangeDate(selectedFromDate) : 'Select date'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rangeChip, calendarSelectionTarget === 'to' && styles.rangeChipActive]}
                onPress={() => setCalendarSelectionTarget('to')}
              >
                <Text style={styles.rangeChipLabel}>To</Text>
                <Text style={styles.rangeChipValue}>
                  {selectedToDate ? formatRangeDate(selectedToDate) : 'Select date'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.calendarGrid}>
              {buildCalendarDays.map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }
                const isFrom = selectedFromDate ? sameDay(day, selectedFromDate) : false;
                const isTo = selectedToDate ? sameDay(day, selectedToDate) : false;
                const isInRange =
                  selectedFromDate && selectedToDate
                    ? day >= startOfDay(selectedFromDate) && day <= endOfDay(selectedToDate)
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
                    <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
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
    // justifyContent: 'center',
  },
  selectedDateText: {
    color: '#aaa',
    fontSize: wp(3.2),
    // marginTop: hp(1),
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
    backgroundColor: '#141414',
    marginHorizontal: wp(4),
    marginVertical: hp(1.5),
    padding: wp(8),
    borderRadius: wp(6),
    borderWidth: wp(0.2),
    borderColor: '#f3efef70',
    alignItems: 'center',
  },
  iconCircle: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(4),
  },
  itemTitle: { color: '#fff', fontSize: wp(4.5), fontWeight: '600' },
  itemSub: { color: '#888', fontSize: wp(3.2) },
  itemAmount: { color: '#fff', fontSize: wp(5), fontWeight: '700' },
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
  Dropcontainer:{
    // backgroundColor:"#999",
    // color:"#999"
    padding:wp(3)
  }
});
