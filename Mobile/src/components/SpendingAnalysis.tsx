import type { JSX } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
} from "react-native";
import { LineChart, PieChart } from "react-native-chart-kit";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import ViewShot from "react-native-view-shot";

const screenWidth = Dimensions.get("window").width - wp(10);

type ViewMode = "trend" | "breakdown";
type TimeFrame = "Day" | "Week" | "Month" | "Quarter" | "Year";

type AnalyticsTrend = {
  labels: string[];
  series: { name: string; color: string; data: number[] }[];
};

type AnalyticsBreakdown = {
  name: string;
  value: number;
  color: string;
};

type AnalyticsPayload = {
  trend: AnalyticsTrend;
  breakdown: AnalyticsBreakdown[];
};

/* ---------- Component ---------- */
export type SpendingAnalysisHandle = {
  captureCharts: () => Promise<{ lineChartPath: string; pieChartPath: string }>;
};

type SpendingAnalysisProps = {
  analytics: AnalyticsPayload | null;
  loading?: boolean;
  onTimeFrameChange?: (timeFrame: TimeFrame) => void;
};

const SpendingAnalysis = forwardRef<SpendingAnalysisHandle, SpendingAnalysisProps>(({ analytics, loading, onTimeFrameChange }, ref): JSX.Element => {
  const [view, setView] = useState<ViewMode>("trend");
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("Month");
  const lineChartRef = useRef<ViewShot>(null);
  const pieChartRef = useRef<ViewShot>(null);

  const lineChartWidth = useMemo(() => {
    const labelCount = analytics?.trend.labels.length ?? 0;
    const minWidth = screenWidth;
    const perLabel = wp(8);
    return Math.max(minWidth, labelCount * perLabel);
  }, [analytics]);

  const handleTimeFrameChange = (next: TimeFrame) => {
    setTimeFrame(next);
    onTimeFrameChange?.(next);
  };

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

  const lineData = useMemo(() => {
    if (!analytics) return null;
    return {
      labels: analytics.trend.labels,
      datasets: analytics.trend.series.map((s) => ({
        data: s.data,
        color: () => s.color,
        strokeWidth: 3,
      })),
    };
  }, [analytics]);

  const pieData = useMemo(() => {
    if (!analytics) return null;
    return analytics.breakdown.map((b) => ({
      name: b.name,
      population: b.value,
      color: b.color,
      legendFontColor: "transparent",
      legendFontSize: 0,
      strokeWidth: wp(1),
      strokeColor: "#ffffff",
    }));
  }, [analytics]);

  return (
    <View style={styles.container}>
      {/* Time Tabs */}
      <View style={styles.timeTabs}>
        {(["Day", "Week", "Month", "Quarter", "Year"] as TimeFrame[]).map((tf) => (
          <TouchableOpacity
            key={tf}
            style={[styles.timeTabBtn, timeFrame === tf && styles.activeTimeTab]}
            onPress={() => handleTimeFrameChange(tf)}
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

        {loading && (
          <Text style={{ color: "#aaa", marginBottom: hp(1) }}>Loading...</Text>
        )}

        {view === "trend" && lineData && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chartScrollContent}
          >
            <LineChart
              data={lineData}
              width={lineChartWidth}
              height={hp(36)}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          </ScrollView>
        )}

        {view === "trend" && analytics && (
          <View style={styles.legendContainer}>
            {analytics.trend.series.map((item) => (
              <View key={item.name} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={[styles.legendText, { color: item.color }]}>{item.name}</Text>
              </View>
            ))}
          </View>
        )}

        {view === "breakdown" && pieData && (
        <PieChart
            data={pieData}
            width={screenWidth - wp(1)}
            height={hp(32)}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft={String(wp(21))}
            hasLegend={false} 
            absolute={false} 
          />
        )}

        {view === "breakdown" && pieData && (
    <View style={styles.legendContainer}>
      {pieData.map((item: any) => (
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
          options={{ format: "jpg", quality: 0.95, result: "tmpfile" }}
        >
          <View collapsable={false} style={[styles.exportCard, { width: lineChartWidth }]}>
            <Text style={styles.exportTitle}>Spending Trend ({timeFrame})</Text>
            {lineData && (
              <LineChart
                data={lineData}
                width={lineChartWidth}
                height={hp(36)}
                chartConfig={chartConfig}
                bezier
                horizontalLabelRotation={-35}
                style={styles.chart}
              />
            )}
          </View>
        </ViewShot>

        <ViewShot
          ref={pieChartRef}
          options={{ format: "jpg", quality: 0.95, result: "tmpfile" }}
        >
          <View collapsable={false} style={styles.exportCard}>
            <Text style={styles.exportTitle}>Spending Breakdown ({timeFrame})</Text>
            {pieData && (
              <PieChart
                data={pieData}
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
  chartScrollContent: {
    paddingRight: wp(3),
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
