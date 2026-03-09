import type { JSX } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { LineChart, PieChart } from "react-native-chart-kit";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import ViewShot from "react-native-view-shot";

const screenWidth = Dimensions.get("window").width - wp(10);

type ViewMode = "trend" | "breakdown";
type TimeFrame = "Day" | "Week" | "Month" | "Quarter" | "Year";

/* ---------- Legend Config ---------- */
const LEGEND_ITEMS = [
  { label: "Fuel", color: "#3b82f6" },
  { label: "Maintenance", color: "#f97316" },
  { label: "Other", color: "#10b981" },
];

/* ---------- Chart Data ---------- */
const chartData: Record<TimeFrame, { trend: any; breakdown: any }> = {
  Day: {
    trend: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      datasets: [
        { data: [500, 700, 600, 800, 750, 900, 650], color: () => "#3b82f6", strokeWidth: 3 },
        { data: [200, 300, 250, 400, 350, 450, 300], color: () => "#f97316", strokeWidth: 3 },
        { data: [100, 150, 120, 180, 140, 160, 130], color: () => "#10b981", strokeWidth: 3 },
      ],
    },
    breakdown: [
      { name: "Fuel", population: 50, color: "#3b82f6", legendFontColor: "transparent", legendFontSize: 0,strokeWidth: wp(1),strokeColor: "#ffffff", },
      { name: "Maintenance", population: 35, color: "#f97316", legendFontColor: "transparent", legendFontSize: 0,strokeWidth: wp(1),strokeColor: "#ffffff", },
      { name: "Other", population: 15, color: "#10b981", legendFontColor: "transparent", legendFontSize: 0,strokeWidth: wp(1),strokeColor: "#ffffff", },
    ],
  },

  Week: {
    trend: {
      labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
      datasets: [
        { data: [2000, 2500, 2300, 2600], color: () => "#3b82f6", strokeWidth: 3 },
        { data: [1200, 1500, 1300, 1400], color: () => "#f97316", strokeWidth: 3 },
        { data: [400, 500, 450, 480], color: () => "#10b981", strokeWidth: 3 },
      ],
    },
    breakdown: [
      { name: "Fuel", population: 55, color: "#3b82f6", legendFontColor: "transparent", legendFontSize: 0 },
      { name: "Maintenance", population: 30, color: "#f97316", legendFontColor: "transparent", legendFontSize: 0 },
      { name: "Other", population: 15, color: "#10b981", legendFontColor: "transparent", legendFontSize: 0 },
    ],
  },

  Month: {
    trend: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      datasets: [
        { data: [6500, 7200, 6900, 7600, 8200, 7800, 8600, 7900, 8400, 7600, 8100, 7500], color: () => "#3b82f6", strokeWidth: 3 },
        { data: [3500, 2800, 4200, 3100, 5400, 3700, 4500, 3900, 4800, 4200, 5200, 4500], color: () => "#f97316", strokeWidth: 3 },
        { data: [1200, 1500, 1100, 1300, 1800, 1400, 1600, 1200, 1700, 1500, 1600, 1400], color: () => "#10b981", strokeWidth: 3 },
      ],
    },
    breakdown: [
      { name: "Fuel", population: 52, color: "#3b82f6", legendFontColor: "transparent", legendFontSize: 0 },
      { name: "Maintenance", population: 31, color: "#f97316", legendFontColor: "transparent", legendFontSize: 0 },
      { name: "Insurance", population: 9, color: "#8b5cf6", legendFontColor: "transparent", legendFontSize: 0 },
      { name: "Parking", population: 5, color: "#10b981", legendFontColor: "transparent", legendFontSize: 0 },
      { name: "Other", population: 3, color: "#facc15", legendFontColor: "transparent", legendFontSize: 0 },
    ],
  },

  Quarter: {
    trend: {
      labels: ["Q1", "Q2", "Q3", "Q4"],
      datasets: [
        { data: [18000, 21000, 20000, 22000], color: () => "#3b82f6", strokeWidth: 3 },
        { data: [9000, 10000, 9500, 10500], color: () => "#f97316", strokeWidth: 3 },
        { data: [4000, 4500, 4200, 4800], color: () => "#10b981", strokeWidth: 3 },
      ],
    },
    breakdown: [
      { name: "Fuel", population: 50, color: "#3b82f6", legendFontColor: "transparent", legendFontSize: 0 },
      { name: "Maintenance", population: 30, color: "#f97316", legendFontColor: "transparent", legendFontSize: 0 },
      { name: "Other", population: 20, color: "#10b981", legendFontColor: "transparent", legendFontSize: 0 },
    ],
  },

  Year: {
    trend: {
      labels: ["2019", "2020", "2021", "2022", "2023"],
      datasets: [
        { data: [75000, 80000, 78000, 82000, 85000], color: () => "#3b82f6", strokeWidth: 3 },
        { data: [40000, 42000, 41000, 43000, 45000], color: () => "#f97316", strokeWidth: 3 },
        { data: [15000, 16000, 15500, 16500, 17000], color: () => "#10b981", strokeWidth: 3 },
      ],
    },
    breakdown: [
      { name: "Fuel", population: 55, color: "#3b82f6", legendFontColor: "transparent", legendFontSize: 14 },
      { name: "Maintenance", population: 30, color: "#f97316", legendFontColor: "transparent", legendFontSize: 14 },
      { name: "Other", population: 15, color: "#10b981", legendFontColor: "transparent", legendFontSize: 14 },
    ],
  },
};

/* ---------- Component ---------- */
export type SpendingAnalysisHandle = {
  captureCharts: () => Promise<{ lineChartPath: string; pieChartPath: string }>;
};

const SpendingAnalysis = forwardRef<SpendingAnalysisHandle, Record<string, never>>((_, ref): JSX.Element => {
  const [view, setView] = useState<ViewMode>("trend");
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("Month");
  const lineChartRef = useRef<ViewShot>(null);
  const pieChartRef = useRef<ViewShot>(null);

  useImperativeHandle(ref, () => ({
    captureCharts: async () => {
      const lineChartPath = await lineChartRef.current?.capture?.();
      const pieChartPath = await pieChartRef.current?.capture?.();

      if (!lineChartPath || !pieChartPath) {
        throw new Error("Unable to capture charts");
      }

      return { lineChartPath, pieChartPath };
    },
  }));

  return (
    <View style={styles.container}>
      {/* Time Tabs */}
      <View style={styles.timeTabs}>
        {(["Day", "Week", "Month", "Quarter", "Year"] as TimeFrame[]).map((tf) => (
          <TouchableOpacity
            key={tf}
            style={[styles.timeTabBtn, timeFrame === tf && styles.activeTimeTab]}
            onPress={() => setTimeFrame(tf)}
          >
            <Text style={[styles.timeTabText, timeFrame === tf && styles.activeTimeTabText]}>{tf}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Spending Analysis</Text>
<View style={styles.toggle}>
  <TouchableOpacity
    style={[
      styles.toggleBtn,
      view === "trend" && styles.activeBtn,
    ]}
    onPress={() => setView("trend")}
  >
    <Text
      style={[
        styles.toggleText,
        view === "trend" ? styles.activeText : styles.inactiveText,
      ]}
    >
      Trend
    </Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[
      styles.toggleBtn,
      view === "breakdown" && styles.activeBtn,
    ]}
    onPress={() => setView("breakdown")}
  >
    <Text
      style={[
        styles.toggleText,
        view === "breakdown" ? styles.activeText : styles.inactiveText,
      ]}
    >
      Breakdown
    </Text>
  </TouchableOpacity>
</View>
        </View>

        {view === "trend" && (
          <LineChart
            data={chartData[timeFrame].trend}
            width={screenWidth-wp(7)}
            height={hp(32)}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        )}

        {view === "trend" && (
          <View style={styles.legendContainer}>
            {LEGEND_ITEMS.map((item) => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={[styles.legendText, { color: item.color }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        )}

        {view === "breakdown" && (
        <PieChart
            data={chartData[timeFrame].breakdown}
            width={screenWidth - wp(10)}
            height={hp(32)}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft={String(wp(21))}
            hasLegend={false} 
            absolute={false} 
          />
        )}

        {view === "breakdown" && (
    <View style={styles.legendContainer}>
      {chartData[timeFrame].breakdown.map((item: any) => (
        <View key={item.name} style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: item.color }]}
          />
          <Text style={[styles.legendText]}>{item.name}</Text>
          <Text style={[styles.legendValue, { color: item.color }]}>{item.population}%</Text>
        </View>
      ))}
    </View>
  )}
      </View>

      <View style={styles.exportCaptureContainer}>
        <ViewShot
          ref={lineChartRef}
          collapsable={false}
          options={{ format: "jpg", quality: 0.95, result: "tmpfile" }}
        >
          <View style={styles.exportCard}>
            <Text style={styles.exportTitle}>Spending Trend ({timeFrame})</Text>
            <LineChart
              data={chartData[timeFrame].trend}
              width={screenWidth - wp(7)}
              height={hp(32)}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          </View>
        </ViewShot>

        <ViewShot
          ref={pieChartRef}
          collapsable={false}
          options={{ format: "jpg", quality: 0.95, result: "tmpfile" }}
        >
          <View style={styles.exportCard}>
            <Text style={styles.exportTitle}>Spending Breakdown ({timeFrame})</Text>
            <PieChart
              data={chartData[timeFrame].breakdown}
              width={screenWidth - wp(10)}
              height={hp(32)}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft={String(wp(21))}
              hasLegend={false}
              absolute={false}
            />
          </View>
        </ViewShot>
      </View>
    </View>
  );
});

SpendingAnalysis.displayName = "SpendingAnalysis";
export default SpendingAnalysis;

/* ---------- Chart Config ---------- */
const chartConfig = {
    // backgroundColor: "#151515",
  backgroundGradientFrom: "#151515",
  backgroundGradientTo: "#151515",
  decimalPlaces: 0,
  color: () => "#2f2d2d",
  labelColor: () => "#a1a1aa",
  propsForDots: { r: "4" },
};


/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  container: {
    padding: wp(4),
  },
  legendValue: {
  marginLeft: wp(1),
  color: "#a1a1aa",
  fontSize: hp(1.4),
},
  card: {
    backgroundColor: "#151515",
    borderRadius: wp(6),
    padding: wp(4),
    borderWidth: wp(0.15),
    borderColor: "#999",
  },

  timeTabs: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: hp(1.9),
    backgroundColor: "#2c2c2e",
    borderRadius: wp(6),
    padding: wp(1),
  },
  timeTabBtn: {
    paddingHorizontal: wp(4.5),
    paddingVertical: hp(0.9),
    borderRadius: wp(6),
  },
  timeTabText: {
    color: "#afafb2",
    fontSize: hp(1.4),
    fontWeight: "800",
  },
    activeTimeTab: {
    backgroundColor: '#ffbf00',
    color: "#18191a",
  },
  activeTimeTabText: {
    color: "#18191a",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: hp(1.2),
    gap: wp(1.5),
  },
  title: {
    color: "#fff",
    fontSize: hp(2),
    fontWeight: "600",
  },

  toggle: {
    flexDirection: "row",
    backgroundColor: "#2c2c2e",
    borderRadius: wp(6),
    padding: wp(0.7),
  },
toggleBtn: {
  paddingHorizontal: wp(3.5),
  paddingVertical: hp(0.8),
},

activeBtn: {
  backgroundColor: '#ffbf00',
  borderRadius: wp(6),
},

toggleText: {
  fontSize: hp(1.5),
  fontWeight: "800",
},

activeText: {
  color: "#1a1616",
},

inactiveText: {
  color: "#fff",
},
  legendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    marginBottom: hp(1.5),
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: wp(3),
  },
  legendDot: {
    width: wp(2.4),
    height: wp(2.4),
    borderRadius: wp(1.2),
    marginRight: wp(1.4),
  },
  legendText: {

    fontSize: hp(1.5),
    fontWeight: "500",
    color:'#999'
  },

  chart: {
    marginVertical: hp(1),
    // borderRadius: wp(4),
    backgroundColor: "#151515",
  },
  exportCaptureContainer: {
    position: "absolute",
    left: -10000,
    top: -10000,
  },
  exportCard: {
    backgroundColor: "#151515",
    padding: wp(3),
  },
  exportTitle: {
    color: "#fff",
    fontSize: hp(1.8),
    fontWeight: "600",
    marginBottom: hp(1),
  },
});

