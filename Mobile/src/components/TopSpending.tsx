import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

interface CategoryProps {
  label: string;
  amount: string;
  percentage: number;
  trend: string;
  trendType: 'up' | 'down' | 'none';
  icon: string; // Placeholder for icon name or emoji
}

const CategoryItem: React.FC<CategoryProps> = ({ label, amount, percentage, trend, trendType, icon }) => {
  const isUp = trendType === 'up';
  const isDown = trendType === 'down';

  return (
    <View style={styles.itemContainer}>
      <View style={styles.row}>
        {/* Icon Circle */}
        <View style={styles.iconCircle}>
          <Text style={{ fontSize: 20 }}>{icon}</Text>
        </View>

        {/* Label and Subtext */}
        <View style={styles.labelContainer}>
          <Text style={styles.labelText}>{label}</Text>
          <Text style={styles.subText}>{percentage}% of total</Text>
        </View>

        {/* Amount and Trend */}
        <View style={styles.rightContainer}>
          <Text style={styles.amountText}>₹{amount}</Text>
          <View style={styles.trendRow}>
            {isUp && <Text style={styles.trendUp}>↗ +{trend}</Text>}
            {isDown && <Text style={styles.trendDown}>↘ -{trend}</Text>}
            {trendType === 'none' && <Text style={styles.trendNone}>No change</Text>}
          </View>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarBackground}>
        <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
      </View>
    </View>
  );
};

const TopSpendingCard = () => {
  const categories: CategoryProps[] = [
    { label: 'Fuel', amount: '89K', percentage: 52, trend: '5%', trendType: 'up', icon: '⛽' },
    { label: 'Maintenance', amount: '53K', percentage: 31, trend: '2%', trendType: 'down', icon: '🔧' },
    { label: 'Insurance', amount: '15K', percentage: 9, trend: '', trendType: 'none', icon: '🛡️' },
    { label: 'Parking', amount: '8K', percentage: 5, trend: '3%', trendType: 'up', icon: '🅿️' },
    { label: 'Other', amount: '7K', percentage: 4, trend: '1%', trendType: 'down', icon: '📝' },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Top Spending Categories</Text>
      {categories.map((item, index) => (
        <CategoryItem key={index} {...item} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#151515",
    borderRadius: wp(6),
    padding: wp(5),
    margin: wp(4),
    borderWidth: wp(0.1),
    borderColor: '#999',
  },
  title: {
    color: '#fff',
    fontSize: hp(2.4),
    fontWeight: 'bold',
    marginBottom: hp(2.5),
  },
  itemContainer: {
    marginBottom: hp(3),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(1.5),
  },
  iconCircle: {
    width: wp(11),
    height: wp(11),
    borderRadius: wp(5.5),
    backgroundColor: '#1e1e1e',
    borderWidth: wp(0.3),
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(3),
  },
  labelContainer: {
    flex: 1,
  },
  labelText: {
    color: '#fff',
    fontSize: hp(2.1),
    fontWeight: '600',
  },
  subText: {
    color: '#888',
    fontSize: hp(1.6),
    marginTop: hp(0.4),
  },
  rightContainer: {
    alignItems: 'flex-end',
  },
  amountText: {
    color: '#fff',
    fontSize: hp(2.1),
    fontWeight: 'bold',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp(0.5),
  },
  trendUp: {
    color: '#ff4d4d',
    fontSize: hp(1.5),
    fontWeight: '600',
  },
  trendDown: {
    color: '#00e676',
    fontSize: hp(1.5),
    fontWeight: '600',
  },
  trendNone: {
    color: '#666',
    fontSize: hp(1.5),
  },
  progressBarBackground: {
    height: hp(0.8),
    backgroundColor: '#2a2a2a',
    borderRadius: hp(0.4),
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#999',
    borderRadius: hp(0.4),
  },
});

export default TopSpendingCard;