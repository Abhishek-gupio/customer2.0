import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Platform,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import Icon from "react-native-vector-icons/Feather";
import { useNavigation } from "@react-navigation/native";
import { Alert } from "react-native";
import SpendingAnalysis, { type SpendingAnalysisHandle } from "../../components/SpendingAnalysis";
import CostPerKmCard from "../../components/CostPerKm";
import TopSpendingCard from "../../components/TopSpending";
import Iconi from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from "../../theme/colors";
import { fontSizes } from "../../theme/Fontsize";
import RNFS from "react-native-fs";
import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { vehicleService } from "../../services/vehicleService";

type AnalyticsTrend = {
  labels: string[];
  series: { name: string; color: string; data: number[] }[];
};

type AnalyticsBreakdown = {
  name: string;
  value: number;
  color: string;
};

type AnalyticsResponse = {
  totalSpent: number;
  avgMonthly: number;
  costPerKm: number;
  insights?: string[];
  trend: AnalyticsTrend;
  breakdown: AnalyticsBreakdown[];
};

type TimeFrame = "Day" | "Week" | "Month" | "Quarter" | "Year";

const CATEGORY_COLORS: Record<string, string> = {
  FUEL: "#2196f3",
  SERVICE: "#ff6d00",
  TOLL: "#9c27b0",
  TOLLS: "#9c27b0",
  INSURANCE: "#00bcd4",
  PARKING: "#ffeb3b",
  CHALLAN: "#f44336",
  EMI: "#4caf50",
  OTHER: "#00c853",
};

const toNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDate = (value: unknown) => {
  if (!value) return null;
  const d = new Date(value as any);
  if (!Number.isNaN(d.getTime())) return d;

  if (typeof value === "string") {
    const parts = value.split("-");
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

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const getTimeFrameRange = (timeFrame: TimeFrame) => {
  const now = new Date();
  let start: Date;

  switch (timeFrame) {
    case "Day":
      start = startOfDay(now);
      break;
    case "Week":
      start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
      break;
    case "Quarter":
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      break;
    case "Year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case "Month":
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  return { start, end: endOfDay(now) };
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getWithRetry = async <T,>(fn: () => Promise<T>, retries = 2) => {
  let attempt = 0;
  // Simple backoff to reduce 429s from the backend
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await wait(400 * (attempt + 1));
      attempt += 1;
    }
  }
  throw new Error("Request failed");
};

const buildTrendSeries = (expenses: any[], timeFrame: TimeFrame) => {
  const now = new Date();
  const totals: number[] = [];
  let labels: string[] = [];

  if (timeFrame === "Day") {
    labels = ["12a", "3a", "6a", "9a", "12p", "3p", "6p", "9p"];
    totals.push(...new Array(labels.length).fill(0));
    expenses.forEach((e) => {
      const d = toDate(e.date);
      if (!d) return;
      const bucket = Math.min(Math.floor(d.getHours() / 3), labels.length - 1);
      totals[bucket] += toNumber(e.amount);
    });
  } else if (timeFrame === "Week") {
    labels = [];
    totals.push(...new Array(7).fill(0));
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      labels.push(day.toLocaleDateString("en-IN", { weekday: "short" }));
    }
    expenses.forEach((e) => {
      const d = toDate(e.date);
      if (!d) return;
      const idx = Math.floor((startOfDay(d).getTime() - start.getTime()) / (24 * 3600 * 1000));
      if (idx >= 0 && idx < totals.length) totals[idx] += toNumber(e.amount);
    });
  } else if (timeFrame === "Month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
    totals.push(...new Array(daysInMonth).fill(0));
    expenses.forEach((e) => {
      const d = toDate(e.date);
      if (!d) return;
      const idx = d.getDate() - 1;
      if (idx >= 0 && idx < totals.length) totals[idx] += toNumber(e.amount);
    });
  } else if (timeFrame === "Quarter") {
    labels = [];
    totals.push(...new Array(3).fill(0));
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    for (let i = 0; i < 3; i += 1) {
      const labelDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
      labels.push(labelDate.toLocaleDateString("en-IN", { month: "short" }));
    }
    expenses.forEach((e) => {
      const d = toDate(e.date);
      if (!d) return;
      const idx =
        (d.getFullYear() - start.getFullYear()) * 12 +
        (d.getMonth() - start.getMonth());
      if (idx >= 0 && idx < totals.length) totals[idx] += toNumber(e.amount);
    });
  } else {
    labels = Array.from({ length: 12 }, (_, i) =>
      new Date(now.getFullYear(), i, 1).toLocaleDateString("en-IN", { month: "short" })
    );
    totals.push(...new Array(12).fill(0));
    expenses.forEach((e) => {
      const d = toDate(e.date);
      if (!d) return;
      const idx = d.getMonth();
      totals[idx] += toNumber(e.amount);
    });
  }

  return {
    labels,
    series: [
      {
        name: "Total",
        color: "#ffbf00",
        data: totals,
      },
    ],
  };
};

const buildBreakdown = (expenses: any[]) => {
  const totals: Record<string, number> = {};
  expenses.forEach((e) => {
    const category = String(e.category || "OTHER").toUpperCase();
    totals[category] = (totals[category] || 0) + toNumber(e.amount);
  });
  const overall = Object.values(totals).reduce((sum, v) => sum + v, 0);
  return Object.entries(totals)
    .map(([category, total]) => ({
      name: category.charAt(0) + category.slice(1).toLowerCase(),
      value: overall > 0 ? Math.round((total / overall) * 100) : 0,
      color: CATEGORY_COLORS[category] || "#00c853",
    }))
    .sort((a, b) => b.value - a.value);
};

export default function ExpenseAnalytics() {
  const navigation = useNavigation();
  const spendingAnalysisRef = useRef<SpendingAnalysisHandle>(null);
  const baseExpensesRef = useRef<any[]>([]);
  const insightsRef = useRef<string[]>([]);
  const costPerKmRef = useRef<number>(0);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<TimeFrame>("Month");
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const computeAnalyticsForTimeFrame = (timeFrame: TimeFrame, expenses: any[]) => {
    const { start, end } = getTimeFrameRange(timeFrame);
    const filtered = expenses.filter((e: any) => {
      const d = toDate(e.date);
      return d ? d >= start && d <= end : false;
    });

    const totalSpent = filtered.reduce((sum: number, e: any) => sum + toNumber(e.amount), 0);
    const monthsInRange =
      timeFrame === "Quarter" ? 3 : timeFrame === "Year" ? 12 : 1;
    const avgMonthly = monthsInRange > 0 ? totalSpent / monthsInRange : 0;

    return {
      totalSpent,
      avgMonthly,
      costPerKm: costPerKmRef.current,
      insights: insightsRef.current,
      trend: buildTrendSeries(filtered, timeFrame),
      breakdown: buildBreakdown(filtered),
    };
  };

  const refreshAnalytics = async () => {
    if (loadingAnalytics) return;
    setLoadingAnalytics(true);
    setAnalyticsError(null);
    try {
      const now = new Date();
      const start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const end = endOfDay(now);
      const expensesRes = await getWithRetry(() =>
        api.get<any>(
          `/v1/expenses?startDate=${start.toISOString()}&endDate=${end.toISOString()}`
        )
      );

      const items =
        expensesRes?.data?.expenses ??
        expensesRes?.data?.data?.expenses ??
        expensesRes?.data?.data ??
        expensesRes?.expenses ??
        expensesRes?.data ??
        [];
      baseExpensesRef.current = Array.isArray(items) ? items : [];

      const [insightsResult, vehiclesResult] = await Promise.allSettled([
        api.get<any>("/v1/expenses/insights"),
        vehicleService.getVehicles(),
      ]);

      const insightsPayload =
        insightsResult.status === "fulfilled"
          ? (insightsResult.value as any)?.data ?? insightsResult.value
          : null;
      insightsRef.current =
        insightsPayload?.smartTips ??
        insightsPayload?.weeklyDigest?.tips ??
        [];

      const vehicleList =
        vehiclesResult.status === "fulfilled" ? vehiclesResult.value : [];
      const primaryVehicle = Array.isArray(vehicleList)
        ? vehicleList.find((v) => v?.isPrimary) || vehicleList[0]
        : null;
      if (primaryVehicle?.id) {
        try {
          const costRes = await api.get<any>(
            `/v1/expenses/vehicles/${primaryVehicle.id}/cost-per-km`
          );
          const costPayload = (costRes as any)?.data ?? costRes;
          costPerKmRef.current = toNumber(costPayload?.costPerKm);
        } catch {
          costPerKmRef.current = 0;
        }
      } else {
        costPerKmRef.current = 0;
      }

      setAnalytics(
        computeAnalyticsForTimeFrame(selectedTimeFrame, baseExpensesRef.current)
      );
    } catch (error) {
      console.log("Analytics fetch error:", error);
      setAnalyticsError("Unable to load analytics right now. Please try again.");
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleTimeFrameChange = (timeFrame: TimeFrame) => {
    setSelectedTimeFrame(timeFrame);
    if (baseExpensesRef.current.length > 0) {
      setAnalytics(computeAnalyticsForTimeFrame(timeFrame, baseExpensesRef.current));
    }
  };

  const normalizePath = (path: string) => path.replace("file://", "");
  const reportInsights = analytics?.insights ?? [];

  useEffect(() => {
    refreshAnalytics();
  }, []);

  const buildAnalyticsReport = () =>
    [
      "Expense Analytics Report",
      `Generated: ${new Date().toLocaleString("en-IN")}`,
      "",
      `Summary (${selectedTimeFrame})`,
      `Total Spent: INR ${Math.round(analytics?.totalSpent ?? 0).toLocaleString("en-IN")}`,
      `Avg Monthly: INR ${Math.round(analytics?.avgMonthly ?? 0).toLocaleString("en-IN")}`,
      `Cost/Km: INR ${Number(analytics?.costPerKm ?? 0).toFixed(2)}`,
      "",
      "Key Insights",
      ...(reportInsights.length
        ? reportInsights.map((item) => `- ${item}`)
        : ["- No insights available"]),
    ];

  const buildAnalyticsPdf = () => {
    const lines = buildAnalyticsReport();
    const esc = (value: string) =>
      value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

    let y = 800;
    let stream = "BT\n/F1 12 Tf\n";
    lines.forEach((line) => {
      stream += `1 0 0 1 50 ${y} Tm\n(${esc(line)}) Tj\n`;
      y -= 18;
    });
    stream += "ET\n";

    const objects = [
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
      `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`,
      "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    ];

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [0];
    objects.forEach((obj) => {
      offsets.push(pdf.length);
      pdf += obj;
    });
    const xrefOffset = pdf.length;

    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (let i = 1; i < offsets.length; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;
    return pdf;
  };

  const onDownloadAnalytics = async () => {
    try {
      if (!spendingAnalysisRef.current) {
        throw new Error("Charts are not ready yet");
      }

      const { lineChartPath, pieChartPath } = await spendingAnalysisRef.current.captureCharts();
      const linePath = normalizePath(lineChartPath);
      const piePath = normalizePath(pieChartPath);
      const reportPdf = buildAnalyticsPdf();

      const baseDir =
        Platform.OS === "android" && RNFS.DownloadDirectoryPath
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;
      const stamp = Date.now();
      const lineImageName = `expense-linegraph-${stamp}.jpg`;
      const pieImageName = `expense-piechart-${stamp}.jpg`;
      const fileName = `expense-analytics-report-${stamp}.pdf`;
      const lineImageDest = `${baseDir}/${lineImageName}`;
      const pieImageDest = `${baseDir}/${pieImageName}`;
      const reportDest = `${baseDir}/${fileName}`;

      try {
        await RNFS.copyFile(linePath, lineImageDest);
        await RNFS.copyFile(piePath, pieImageDest);
        await RNFS.writeFile(reportDest, reportPdf, "utf8");
      } catch {
        const fallbackLineDest = `${RNFS.DocumentDirectoryPath}/${lineImageName}`;
        const fallbackPieDest = `${RNFS.DocumentDirectoryPath}/${pieImageName}`;
        const fallbackReportDest = `${RNFS.DocumentDirectoryPath}/${fileName}`;
        await RNFS.copyFile(linePath, fallbackLineDest);
        await RNFS.copyFile(piePath, fallbackPieDest);
        await RNFS.writeFile(fallbackReportDest, reportPdf, "utf8");
      }

      Alert.alert("Downloaded", "Analytics PDF report and graph images saved to your device.");
    } catch (error) {
      Alert.alert("Download Failed", "Unable to generate analytics PDF right now.");
    }
  };

  return (
    <ScrollView style={styles.container} contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loadingAnalytics}
          onRefresh={refreshAnalytics}
          tintColor="#fff"
        />
      }
      >
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
     <View style={styles.shader}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={wp(8)} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.downloadBtn} onPress={onDownloadAnalytics}>
            <Icon name="download" size={wp(8)} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.subHeder}>
          <Text style={styles.title}>Detailed Analytics</Text>
          <Text style={styles.subtitle}>Comprehensive expense insights</Text>
        </View>
      </View>

      <View style={styles.cardRow}>
        <StatCard
          title="Total Spent"
          value={
            loadingAnalytics
              ? "Loading..."
              : analytics
              ? `INR ${Math.round(analytics.totalSpent).toLocaleString("en-IN")}`
              : "No data"
          }
          change="+12%"
          positive
        />
        <StatCard
          title="Avg Monthly"
          value={
            loadingAnalytics
              ? "Loading..."
              : analytics
              ? `INR ${Math.round(analytics.avgMonthly).toLocaleString("en-IN")}`
              : "No data"
          }
          change="-3%"
        />
        <StatCard
          title="Cost/Km"
          value={
            loadingAnalytics
              ? "Loading..."
              : analytics
              ? `INR ${Number(analytics.costPerKm).toFixed(2)}`
              : "No data"
          }
          change="-5%"
          positive
        />
      </View>

      <SpendingAnalysis
        ref={spendingAnalysisRef}
        analytics={analytics}
        loading={loadingAnalytics}
        onTimeFrameChange={handleTimeFrameChange}
      />
      <CostPerKmCard/>
      <TopSpendingCard/>
    </SafeAreaView>

    <View style={styles.keyInsights}>
      <View style={styles.kryInsightsHeader}>
        <Iconi name="lightbulb-on" size={25} color="#FFD700" style={{ marginRight: 8 }} />
        <Text style={styles.title}>Key Insights</Text>
      </View>
      {analyticsError ? (
        <Text style={styles.insightText}>{analyticsError}</Text>
      ) : reportInsights.length === 0 ? (
        <Text style={styles.insightText}>- No insights available</Text>
      ) : (
        reportInsights.map((item, idx) => (
          <Text key={`${item}-${idx}`} style={styles.insightText}>- {item}</Text>
        ))
      )}
    </View>

    </ScrollView>
  );          
}

const StatCard = ({ title, value, change, positive }: { title: string; value: string; change: string; positive?: boolean }) => (
  <View style={styles.statCard}>
    <Text style={styles.statTitle}>{title}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={[styles.statChange, { color: positive ? "#2ECC71" : "#E74C3C" }]}>
      {change}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0E",
  },
    header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: hp(1),
    paddingHorizontal: wp(4),
  },
  shader:{
    borderBottomLeftRadius: wp(12),
    borderBottomRightRadius: wp(12),
  },

  title: {
    color: colors.Primary,
    fontSize: fontSizes.header,
    fontWeight: "700",
  },

  subtitle: {
    color: colors.Secondary,
    fontSize: fontSizes.subHeader,
    marginBottom: hp(2),
  },

  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: hp(2),
    paddingHorizontal: wp(3),
    marginTop: hp(-2),
  },

  statCard: {
    backgroundColor: "#151515",
    borderRadius: wp(5),
    padding: wp(3),
    width: wp(30),
    borderWidth: wp(0.1),
    borderColor: "rgba(239, 236, 236, 0.9)",
    gap: hp(0.6),
  },

  statTitle: {
    color: "#aaa",
    fontSize: hp(1.5),
  },

  statValue: {
    color: "#fff",
    fontSize: hp(2.5),
    fontWeight: "700",
    marginVertical: hp(0.5),
  },

  statChange: {
    fontSize: hp(1.5),
  },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#151515",
    borderRadius: wp(6),
    padding: wp(1),
    marginHorizontal: wp(3),
    marginBottom: hp(2),
  },

  tab: {
    flex: 1,
    paddingVertical: hp(1),
    borderRadius: wp(5),
  },

  tabActive: {
    backgroundColor: "#E6E6E6",
  },

  tabText: {
    color: "#777",
    textAlign: "center",
    fontSize: hp(1.6),
  },

  tabTextActive: {
    color: "#000",
    fontWeight: "600",
  },

  chartCard: {
    backgroundColor: "#151515",
    borderRadius: wp(6),
    padding: wp(3),
    marginHorizontal: wp(3),
  },

  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: hp(1),
  },

  chartTitle: {
    color: "#fff",
    fontSize: hp(2),
    fontWeight: "600",
  },

  switch: {
    flexDirection: "row",
    backgroundColor: "#222",
    borderRadius: wp(5),
  },

  switchBtn: {
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.6),
    borderRadius: wp(4),
  },

  switchBtnActive: {
    backgroundColor: "#E6E6E6",
  },

  switchText: {
    color: "#777",
    fontSize: hp(1.4),
  },

  switchTextActive: {
    color: "#000",
    fontWeight: "600",
  },

  chart: {
    borderRadius: wp(4),
    marginTop: hp(0.5),
    overflow: "hidden",
    padding:wp(2),
    marginLeft:-wp(5),
  },
  subHeder: {
      marginTop: hp(2),
      padding:wp(4)
  },
  downloadBtn: {
    padding: wp(2),
    borderRadius: wp(6),
    // backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: wp(0.2),
    borderColor: "rgba(255,255,255,0.3)",
  },
  keyInsights: {
    backgroundColor: "#151515",
    marginHorizontal: wp(4.5),
    borderRadius: wp(6),
    padding: wp(6),
    marginBottom: hp(3),
    fontWeight: "600",
    borderWidth: wp(0.1),
    borderColor: "#999",
  },
  insightText: {
    color: "#e6dfdf",
    fontSize: hp(1.8),
    marginBottom: hp(1),
    paddingBottom: hp(1.5),
  },
  kryInsightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: hp(1),
    paddingBottom: hp(1),
  },

});


