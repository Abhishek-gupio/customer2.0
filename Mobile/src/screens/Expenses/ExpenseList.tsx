import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { expenses } from './data';
import LinearGradient from 'react-native-linear-gradient';
import Bills from './Bills';

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

  const serviceTypes = ['All', 'Fuel', 'Service', 'Tolls', 'Insurance','Other'];

  const [selectedType, setSelectedType] = React.useState('All');
  const [timelineFilter, setTimelineFilter] = React.useState('Monthly');

  const [percentages, setPercentages] = React.useState({
    fuel: 60,
    maintenance: 36,
    other: 4,
  });

  React.useEffect(() => {
    switch (timelineFilter) {
      case 'Daily':
        setPercentages({ fuel: 70, maintenance: 20, other: 10 });
        break;
      case 'Weekly':
        setPercentages({ fuel: 65, maintenance: 25, other: 10 });
        break;
      case 'Monthly':
        setPercentages({ fuel: 60, maintenance: 36, other: 4 });
        break;
      case 'Yearly':
        setPercentages({ fuel: 55, maintenance: 35, other: 10 });
        break;
    }
  }, [timelineFilter]);

  const progressConfig = [
    {
      key: 'fuel',
      label: 'Fuel',
      color: '#2196f3',
      amount: 7500,
    },
    {
      key: 'maintenance',
      label: 'Maintenance',
      color: '#ff6d00',
      amount: 4500,
    },
    {
      key: 'other',
      label: 'Other',
      color: '#00c853',
      amount: 450,
    },
  ];

  const filteredExpenses =
    selectedType === 'All'
      ? expenses
      : expenses.filter(item => item.type === selectedType);

  return (

    <SafeAreaView style={styles.container} edges={['top']}>
    <ScrollView showsVerticalScrollIndicator={false}>
    <View style={styles.shader}>
      <View style={styles.header}>
        <View style={styles.subHeder}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={wp(5)} color="#fff" />
        </TouchableOpacity>

            <Text style={styles.headerTitle}>Expenses List</Text>
        </View>
            <TouchableOpacity onPress={() => navigation.navigate('addExpense')}>
              <Icon name="plus" size={wp(5)} color="#fff" />
            </TouchableOpacity>
      </View>


        <View style={styles.card}>
          <Text style={styles.cardLabel}>Total This Month</Text>
          <Text style={styles.amount}>₹12,450</Text>

          <View style={styles.row}>
            <Icon name="arrow-up" size={wp(3)} color="#00c853" />
            <Text style={styles.growthText}> +8% from last month</Text>
          </View>
        </View>
      </View>
        <View style={[styles.card, { marginTop: hp(-4),backgroundColor: 'transparentrgb(18, 18, 23)'}]}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardLabel}>Total Spent</Text>
            <View style={styles.percentBadge}>
              <Icon name="arrow-up" size={wp(3)} color="#ff5252" />
              <Text style={styles.percentText}> 8%</Text>
            </View>
          </View>
          <Text style={styles.amount}>₹12,450</Text>

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

          {progressConfig.map(item => {
            const percent =
              percentages[item.key as keyof typeof percentages];

            return (
              <ProgressRow
                key={item.key}
                label={item.label}
                percent={percent}
                color={item.color}
                value={`₹${item.amount.toLocaleString()} (${percent}%)`}
              />
            );
          })}
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

        {filteredExpenses.map(item => (
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
        ))}

        <Bills />

        <TouchableOpacity
          style={styles.sectionTitleCentered}
          onPress={() => navigation.navigate('ExpenseAnalytics')}
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
    paddingVertical: hp(1),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: wp(6.5), fontWeight: '700' },
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
  shader:{
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
    padding: wp(6),
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
  activeTimelineItem: { backgroundColor: '#ffbf00' },
  timelineText: { 
    color: 'rgb(164, 164, 166)',
    fontWeight:'600' 
  },
  activeTimelineText: { color: '#000' },
});
