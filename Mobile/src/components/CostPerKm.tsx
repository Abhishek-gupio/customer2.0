import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface Props {
  monthlyData?: number[];
  labels?: string[];
  totalDistance?: number;
  avgMonthly?: number;
  avgCost?: number;
}

const screenWidth = Dimensions.get('window').width - 40;

const CostPerKmCard: React.FC<Props> = ({
  monthlyData = [6.5, 6, 6.8, 7, 7.2, 7, 7.5, 7.2, 7.3, 6.8, 7, 6.5],
  labels = ['Feb','Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
  totalDistance = 22850,
  avgMonthly = 1904,
  avgCost = 7.51,
}) => {
  // State to track the selected point for the tooltip
  const [tooltip, setTooltip] = useState({
    x: 0,
    y: 0,
    visible: false,
    value: 0,
    label: "",
  });

  const handlePointClick = (data: any) => {
    // If user clicks the same point, hide it; otherwise, show it
    const isSamePoint = tooltip.x === data.x && tooltip.y === data.y;
    setTooltip({
      x: data.x,
      y: data.y,
      value: data.value,
      label: labels[data.index],
      visible: !isSamePoint || !tooltip.visible,
    });
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Cost per Kilometer</Text>
        <View style={styles.avgContainer}>
          <Text style={styles.avgText}>Avg: ₹{avgCost.toFixed(2)}/km</Text>
        </View>
      </View>


      <View style={styles.chartWrapper}>
        <LineChart
          data={{
            labels: labels,
            datasets: [
              {
                data: monthlyData,
                color: () => '#4e73df',
                strokeWidth: 3,
              },
            ],
          }}
          width={screenWidth-4}
          height={220}
          chartConfig={{
            backgroundGradientFrom: '#121212',
            backgroundGradientTo: '#121212',
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(78, 115, 223, ${opacity})`,
            labelColor: () => '#ffffff',
            propsForDots: {
              r: '5', 
              strokeWidth: '2',
              stroke: '#4e73df',
            },
            propsForBackgroundLines: {
              stroke: '#333',
            },
          }}
          style={styles.chartStyle}
          bezier
          fromZero
          onDataPointClick={handlePointClick}
          decorator={() => {
            return tooltip.visible ? (
              <View
                style={[
                  styles.tooltip,
                  {
                    top: tooltip.y + hp(5), 
                    left: tooltip.x - 30, 
                  },
                ]}
              >
                <Text style={styles.tooltipValue}>₹{tooltip.value}</Text>
                <Text style={styles.tooltipLabel}>{tooltip.label}</Text>
              </View>
            ) : null;
          }}

        />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons
                name="tune-variant"
                size={18}
                color="#9ca3af"
                style={{ marginRight: 6 }}
            />
            <Text style={{ color: '#9ca3af', fontSize: 14 }}>
                Cost per KM
            </Text>
        </View>      
            </View>

      <View style={styles.statsContainer}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Total Distance (Year)</Text>
          <Text style={styles.statValue}>{totalDistance.toLocaleString()} km</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Avg Monthly</Text>
          <Text style={styles.statValue}>{avgMonthly.toLocaleString()} km</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#151515",
    borderRadius: wp(6),
    padding: wp(5),
    margin: wp(4),
    overflow: 'visible',
    borderWidth: wp(0.1),
    borderColor: '#999',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(1.2),
  },
  title: {
    color: '#fff',
    fontSize: hp(2.2),
    fontWeight: 'bold',
  },
  avgContainer: {
    // backgroundColor: '#1e1e1e',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.6),
    // borderRadius: wp(2),
    borderWidth: wp(0.4),
    borderColor: '#636060',
    borderRadius: wp(6),
    backgroundColor: 'rgb(31, 31, 36)',
  },
  avgText: {
    color: '#aaa',
    fontWeight: '600',
    fontSize: hp(1.6),
  },
  chartWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  chartStyle: {
    marginVertical: hp(1.2),
    borderRadius: wp(3),
    overflow: 'hidden',
    padding: wp(2),
    // marginLeft: -wp(5),
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: hp(2),
    marginBottom: hp(1.2),
    padding: wp(5),
    borderWidth: wp(0.4),
    borderColor: '#636060',
    borderRadius: wp(6),
    backgroundColor: 'rgb(31, 31, 36)',
  },
  stat: {
    // alignItems: 'center',
  },
  statLabel: {
    color: '#aaa',
    fontSize: hp(1.4),
  },
  statValue: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: hp(2),
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: '#4e73df',
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.5),
    borderRadius: wp(2),
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: wp(15),
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  tooltipValue: {
    color: '#fff',
    fontSize: hp(1.5),
    fontWeight: 'bold',
  },
  tooltipLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: hp(1.2),
  },
});

export default CostPerKmCard;