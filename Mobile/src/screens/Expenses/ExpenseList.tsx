import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import LinearGradient from 'react-native-linear-gradient';
import { api } from '../../services/api';
import { getExpenseIcon, getExpenseColor, formatDate } from './expenseUtils';
import { getAndClearExpenseListRefresh } from '../../utils/refreshManager';

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

const ExpenseFeed = () => {
  const navigation = useNavigation<DocListNavProp>();

  const serviceTypes = ['All', 'Fuel', 'Service', 'Toll', 'Insurance', 'Parking', 'Other'];

  const [selectedType, setSelectedType] = React.useState('All');
  const [timelineFilter, setTimelineFilter] = React.useState('Monthly');
  const [expensesList, setExpensesList] = React.useState<any[]>([]);
  const [rawExpenses, setRawExpenses] = React.useState<any[]>([]); // Raw data with Date objects
  const [loading, setLoading] = React.useState(false);

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
    setLoading(true);
    try {
      const response = await api.get<any>('/v1/expenses');
      console.log("response", response);
      const items = response?.data?.expenses ?? response?.data ?? [];
      const list = Array.isArray(items) ? items : [];

      setRawExpenses(list);

      const mappedExpenses = list.map((item: any) => ({
        id: item.id,
        title: item.category,
        type: item.category.charAt(0) + item.category.slice(1).toLowerCase(),
        amount: item.amount,
        date: formatDate(item.date),
        rawDate: new Date(item.date),
        source: item.source,
        icon: getExpenseIcon(item.category),
        color: getExpenseColor(item.category),
        category: item.category,
      }));
      setExpensesList(mappedExpenses);
    } catch (error) {
      console.error("Fetch Expenses Error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      // Check if refresh was requested and apply appropriate delay
      const needsRefresh = getAndClearExpenseListRefresh();
      const delay = needsRefresh ? 100 : 0;
      
      setTimeout(() => {
        fetchExpenses();
      }, delay);
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
      const d = new Date(e.date);
      return d >= monthStart && d <= monthEnd;
    });
    const total = thisMonthExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
    setTotalThisMonth(total);

    // Growth: compare with last month
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const lastMonthExpenses = rawExpenses.filter((e: any) => {
      const d = new Date(e.date);
      return d >= lastMonthStart && d <= lastMonthEnd;
    });
    const lastTotal = lastMonthExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
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

    const filtered = rawExpenses.filter((e: any) => new Date(e.date) >= filterStart);
    const total = filtered.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
    console.log("Calculated totalFiltered:", total, "for timelineFilter:", timelineFilter);
    setTotalFiltered(total);

    // Category breakdown
    const catMap: Record<string, number> = {};
    filtered.forEach((e: any) => {
      const cat = e.category || 'OTHER';
      catMap[cat] = (catMap[cat] || 0) + (e.amount || 0);
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
  }, [rawExpenses, timelineFilter]);

  const filteredExpenses =
    selectedType === 'All'
      ? expensesList
      : expensesList.filter(item => item.type.toUpperCase() === selectedType.toUpperCase());

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
        <LinearGradient colors={['rgb(62, 59, 59)', 'rgba(27, 26, 26, 0.95)']} style={styles.shader}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="arrow-left" size={wp(5)} color="#fff" />
            </TouchableOpacity>
            <View style={styles.subHeder}>
              <Text style={styles.headerTitle}>Expenses</Text>

              <TouchableOpacity onPress={() => navigation.navigate('addExpense')}>
                <Icon name="plus" size={wp(5)} color="#fff" />
              </TouchableOpacity>
            </View>
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
        </LinearGradient>
        <View style={[styles.card, { marginTop: hp(-4), backgroundColor: 'rgb(18, 18, 23)' }]}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardLabel}>Total Spent</Text>
            {growthPercent !== 0 && (
              <View style={[styles.percentBadge, growthPercent < 0 && { backgroundColor: '#002a00' }]}>
                <Icon
                  name={growthPercent >= 0 ? 'arrow-up' : 'arrow-down'}
                  size={wp(3)}
                  color={growthPercent >= 0 ? '#ff5252' : '#00c853'}
                />
                <Text style={[styles.percentText, growthPercent < 0 && { color: '#00c853' }]}>
                  {' '}{Math.abs(growthPercent)}%
                </Text>
              </View>
            )}
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
                  onPress={() => setTimelineFilter(item)}
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
          filteredExpenses.map(item => (
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

        <TouchableOpacity
          style={styles.sectionTitleCentered}
          onPress={() => navigation.navigate('Analytics')}
        >
          <Icon name="chart-bar" size={wp(5)} color="#fff" />
          <Text style={{ color: '#fff', marginLeft: wp(2) }}>
            View Detailed Analytics
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ExpenseFeed;



const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    paddingHorizontal: wp(6),
    paddingVertical: hp(1.5),
    gap: wp(3),
  },
  headerTitle: { color: '#fff', fontSize: wp(8), fontWeight: '700' },
  subHeder: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  growthText: { color: '#00c853', fontSize: wp(3.5) },
  percentBadge: {
    flexDirection: 'row',
    backgroundColor: '#2a0000',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.7),
    borderRadius: wp(5),
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
  activeChip: { backgroundColor: '#ddd' },
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
  activeTimelineItem: { backgroundColor: '#e5e5e2' },
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
});
