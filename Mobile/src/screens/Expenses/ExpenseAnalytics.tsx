import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Platform,
  RefreshControl,
  NativeModules,
  PermissionsAndroid,
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
import TopSpendingCard, { type TopSpendingItem } from "../../components/TopSpending";
import Iconi from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from "../../theme/colors";
import { fontSizes } from "../../theme/Fontsize";
import RNFS from "react-native-fs";
import { jsPDF } from "jspdf";
let RNHTMLtoPDF: any = null;
try {
  // Some builds expose it via require default export
  const mod = require("react-native-html-to-pdf");
  RNHTMLtoPDF = mod?.default ?? mod;
} catch {
  RNHTMLtoPDF = null;
}
// Fallback to NativeModules if default export isn't wired
if (!RNHTMLtoPDF?.convert) {
  RNHTMLtoPDF = NativeModules.RNHTMLtoPDF ?? RNHTMLtoPDF;
}
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

type CostPerKmSummary = {
  totalExpenses: number;
  totalKm: number;
  costPerKm: number;
  categoryBreakdownPerKm: { category: string; costPerKm: number }[];
  period: string;
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

const getTotalThisMonth = (expenses: any[]) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return expenses.reduce((sum: number, e: any) => {
    const d = toDate(e.date);
    if (!d) return sum;
    if (d < monthStart || d > monthEnd) return sum;
    return sum + toNumber(e.amount);
  }, 0);
};

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

const ensureDownloadPermission = async () => {
  if (Platform.OS !== "android") return true;
  if (Platform.Version >= 29) return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: "Storage Permission",
        message: "Allow storage access to save the analytics PDF.",
        buttonPositive: "OK",
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

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

const sumTotals = (totals: Record<string, number>) =>
  Object.values(totals).reduce((sum, value) => sum + value, 0);

const buildCategoryTotals = (expenses: any[], start: Date, end: Date) => {
  const totals: Record<string, number> = {};
  expenses.forEach((e) => {
    const d = toDate(e.date);
    if (!d || d < start || d > end) return;
    const category = String(e.category || "OTHER").toUpperCase();
    totals[category] = (totals[category] || 0) + toNumber(e.amount);
  });
  return totals;
};

const getPreviousTimeFrameRange = (timeFrame: TimeFrame, start: Date) => {
  switch (timeFrame) {
    case "Day": {
      const prevStart = startOfDay(
        new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1)
      );
      return { start: prevStart, end: endOfDay(prevStart) };
    }
    case "Week": {
      const prevStart = startOfDay(
        new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7)
      );
      const prevEnd = endOfDay(
        new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1)
      );
      return { start: prevStart, end: prevEnd };
    }
    case "Quarter": {
      const prevStart = new Date(start.getFullYear(), start.getMonth() - 3, 1);
      const prevEnd = endOfDay(new Date(start.getFullYear(), start.getMonth(), 0));
      return { start: prevStart, end: prevEnd };
    }
    case "Year": {
      const prevStart = new Date(start.getFullYear() - 1, 0, 1);
      const prevEnd = endOfDay(new Date(start.getFullYear() - 1, 11, 31));
      return { start: prevStart, end: prevEnd };
    }
    case "Month":
    default: {
      const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
      const prevEnd = endOfDay(new Date(start.getFullYear(), start.getMonth(), 0));
      return { start: prevStart, end: prevEnd };
    }
  }
};

const buildTopSpending = (expenses: any[], timeFrame: TimeFrame): TopSpendingItem[] => {
  const { start, end } = getTimeFrameRange(timeFrame);
  const { start: prevStart, end: prevEnd } = getPreviousTimeFrameRange(timeFrame, start);
  const currentTotals = buildCategoryTotals(expenses, start, end);
  const previousTotals = buildCategoryTotals(expenses, prevStart, prevEnd);
  const overall = sumTotals(currentTotals);

  if (overall <= 0) return [];

  return Object.entries(currentTotals)
    .map(([category, amount]) => {
      const prevAmount = previousTotals[category] || 0;
      let trendType: TopSpendingItem["trendType"] = "none";
      let trendLabel = "0%";

      if (prevAmount <= 0 && amount > 0) {
        trendType = "up";
        trendLabel = "New";
      } else if (prevAmount > 0) {
        const change = ((amount - prevAmount) / prevAmount) * 100;
        if (Math.abs(change) >= 0.5) {
          trendType = change > 0 ? "up" : "down";
          trendLabel = `${Math.round(Math.abs(change))}%`;
        }
      }

      return {
        category,
        amount,
        percentage: Math.round((amount / overall) * 100),
        trendLabel,
        trendType,
      };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
};

export default function ExpenseAnalytics() {
  const navigation = useNavigation();
  const spendingAnalysisRef = useRef<SpendingAnalysisHandle>(null);
  const baseExpensesRef = useRef<any[]>([]);
  const insightsRef = useRef<string[]>([]);
  const costPerKmRef = useRef<number>(0);
  const isRefreshingRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const vehicleIdRef = useRef<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<TimeFrame>("Month");
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [costPerKmSummary, setCostPerKmSummary] = useState<CostPerKmSummary | null>(null);

  const computeAnalyticsForTimeFrame = (timeFrame: TimeFrame, expenses: any[]) => {
    const { start, end } = getTimeFrameRange(timeFrame);
    const filtered = expenses.filter((e: any) => {
      const d = toDate(e.date);
      return d ? d >= start && d <= end : false;
    });

    const computedTotalSpent = filtered.reduce(
      (sum: number, e: any) => sum + toNumber(e.amount),
      0
    );
    const totalSpent =
      costPerKmSummary && Number.isFinite(costPerKmSummary.totalExpenses)
        ? toNumber(costPerKmSummary.totalExpenses)
        : computedTotalSpent;
    const avgMonthly = getTotalThisMonth(expenses);

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
    if (isRefreshingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    isRefreshingRef.current = true;
    setLoadingAnalytics(true);
    setAnalyticsError(null);
    try {
      const expensesRes = await getWithRetry(() =>
        api.get<any>(
          vehicleIdRef.current
            ? `/v1/expenses?vehicleId=${vehicleIdRef.current}`
            : "/v1/expenses"
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
      const costVehicleId = vehicleIdRef.current ?? primaryVehicle?.id ?? null;
      if (costVehicleId) {
        try {
          const costRes = await api.get<any>(
            `/v1/expenses/vehicles/${costVehicleId}/cost-per-km`
          );
          const costPayload = (costRes as any)?.data ?? costRes;
          costPerKmRef.current = toNumber(costPayload?.costPerKm);
          setCostPerKmSummary(costPayload ?? null);
        } catch {
          costPerKmRef.current = 0;
          setCostPerKmSummary(null);
        }
      } else {
        costPerKmRef.current = 0;
        setCostPerKmSummary(null);
      }

      setAnalytics(
        computeAnalyticsForTimeFrame(selectedTimeFrame, baseExpensesRef.current)
      );
    } catch (error) {
      console.log("Analytics fetch error:", error);
      setAnalyticsError("Unable to load analytics right now. Please try again.");
    } finally {
      setLoadingAnalytics(false);
      isRefreshingRef.current = false;
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        refreshAnalytics();
      }
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
  const topSpending = useMemo(
    () => buildTopSpending(baseExpensesRef.current, selectedTimeFrame),
    [selectedTimeFrame, analytics]
  );

  const costPerKmTrend = useMemo(() => {
    const labels = analytics?.trend?.labels ?? [];
    const series = analytics?.trend?.series?.[0]?.data ?? [];
    if (!labels.length || !series.length) return { labels: [], data: [] as number[] };
    const totalKm = toNumber(costPerKmSummary?.totalKm);
    const kmPerBucket = totalKm > 0 ? totalKm / labels.length : 0;
    const data = series.map((value) =>
      kmPerBucket > 0 ? toNumber(value) / kmPerBucket : 0
    );
    return { labels, data };
  }, [analytics, costPerKmSummary?.totalKm]);

  useEffect(() => {
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

  useEffect(() => {
    vehicleIdRef.current = vehicleId;
  }, [vehicleId]);

  useEffect(() => {
    refreshAnalytics();
  }, [vehicleId]);

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const buildAnalyticsHtml = (lineDataUri: string, pieDataUri: string) => {
    const summary = [
      `Total Spent: INR ${Math.round(analytics?.totalSpent ?? 0).toLocaleString("en-IN")}`,
      `Avg Monthly: INR ${Math.round(analytics?.avgMonthly ?? 0).toLocaleString("en-IN")}`,
      `Cost/Km: INR ${Number(analytics?.costPerKm ?? 0).toFixed(2)}`,
    ];
    const insights =
      reportInsights.length > 0
        ? reportInsights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
        : "<li>No insights available</li>";

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            h2 { font-size: 16px; margin-top: 18px; }
            p, li { font-size: 12px; line-height: 1.4; }
            .muted { color: #666; font-size: 11px; }
            .chart { width: 100%; margin-top: 12px; }
            .section { margin-top: 12px; }
          </style>
        </head>
        <body>
          <h1>Expense Analytics Report</h1>
          <p class="muted">Generated: ${escapeHtml(new Date().toLocaleString("en-IN"))}</p>

          <div class="section">
            <h2>Summary (${escapeHtml(selectedTimeFrame)})</h2>
            <ul>
              ${summary.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>

          <div class="section">
            <h2>Key Insights</h2>
            <ul>${insights}</ul>
          </div>

          <div class="section">
            <h2>Charts</h2>
            <img class="chart" src="${lineDataUri}" />
            <img class="chart" src="${pieDataUri}" />
          </div>
        </body>
      </html>
    `;
  };

  const onDownloadAnalytics = async () => {
    try {
      if (!analytics) {
        throw new Error("Analytics are not ready yet");
      }
      if (!spendingAnalysisRef.current) {
        throw new Error("Charts are not ready yet");
      }

      // Allow charts to render before capture
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

      const { lineChartPath, pieChartPath } = await spendingAnalysisRef.current.captureCharts();
      const linePath = normalizePath(lineChartPath);
      const piePath = normalizePath(pieChartPath);

      const canWriteDownloads = await ensureDownloadPermission();
      const baseDir =
        Platform.OS === "android"
          ? (canWriteDownloads && RNFS.DownloadDirectoryPath) ||
            RNFS.ExternalDirectoryPath ||
            RNFS.DocumentDirectoryPath
          : RNFS.DocumentDirectoryPath;
      const stamp = Date.now();
      const fileBase = `expense-analytics-report-${stamp}`;

      const lineBase64 = await RNFS.readFile(linePath, "base64");
      const pieBase64 = await RNFS.readFile(piePath, "base64");
      const lineMime = linePath.toLowerCase().endsWith(".jpg") || linePath.toLowerCase().endsWith(".jpeg")
        ? "image/jpeg"
        : "image/png";
      const pieMime = piePath.toLowerCase().endsWith(".jpg") || piePath.toLowerCase().endsWith(".jpeg")
        ? "image/jpeg"
        : "image/png";
      const lineDataUrl = `data:${lineMime};base64,${lineBase64}`;
      const pieDataUrl = `data:${pieMime};base64,${pieBase64}`;

      const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 24;
      let y = margin;

      doc.setFontSize(18);
      doc.text("Expense Analytics Report", margin, y);
      y += 22;
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, margin, y);
      y += 18;
      doc.setTextColor(0);
      doc.setFontSize(12);

      const summaryLines = [
        `TimeFrame: ${selectedTimeFrame}`,
        `Total Spent: INR ${Math.round(analytics.totalSpent).toLocaleString("en-IN")}`,
        `Avg Monthly: INR ${Math.round(analytics.avgMonthly).toLocaleString("en-IN")}`,
        `Cost/Km: INR ${Number(analytics.costPerKm).toFixed(2)}`,
      ];
      summaryLines.forEach((line) => {
        doc.text(line, margin, y);
        y += 16;
      });
      y += 8;

      const addImageWithPaging = (dataUrl: string, label: string, format: "PNG" | "JPEG") => {
        const maxWidth = pageWidth - margin * 2;
        const imgHeight = Math.round(maxWidth * 0.6);
        if (y + 20 + imgHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.setFontSize(13);
        doc.text(label, margin, y);
        y += 12;
        doc.addImage(dataUrl, format, margin, y, maxWidth, imgHeight);
        y += imgHeight + 16;
      };

      addImageWithPaging(lineDataUrl, "Spending Trend", lineMime.includes("png") ? "PNG" : "JPEG");
      addImageWithPaging(pieDataUrl, "Spending Breakdown", pieMime.includes("png") ? "PNG" : "JPEG");

      const pdfBase64Uri = doc.output("datauristring");
      const pdfBase64 = pdfBase64Uri.split(",")[1] || "";
      if (!pdfBase64) {
        throw new Error("PDF generation returned no data");
      }

      await RNFS.mkdir(baseDir);
      const reportDest = `${baseDir}/${fileBase}.pdf`;
      await RNFS.writeFile(reportDest, pdfBase64, "base64");

      Alert.alert(
        "Downloaded",
        `Analytics PDF report saved to:\n${reportDest}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate analytics PDF right now.";
      Alert.alert("Download Failed", message);
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
          // change="+12%"
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
          // change="-3%"
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
          // change="-5%"
          positive
        />
      </View>

      <SpendingAnalysis
        ref={spendingAnalysisRef}
        analytics={analytics}
        loading={loadingAnalytics}
        onTimeFrameChange={handleTimeFrameChange}
      />
      <CostPerKmCard
        labels={costPerKmTrend.labels}
        monthlyData={costPerKmTrend.data}
        avgCost={costPerKmSummary?.costPerKm}
        totalDistance={costPerKmSummary?.totalKm}
        avgMonthly={
          costPerKmTrend.labels.length
            ? toNumber(costPerKmSummary?.totalKm) / costPerKmTrend.labels.length
            : undefined
        }
        period={costPerKmSummary?.period}
      />
      <TopSpendingCard items={topSpending} loading={loadingAnalytics} />
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

const StatCard = ({ title, value, positive }: { title: string; value: string; positive?: boolean }) => (
  <View style={styles.statCard}>
    <Text style={styles.statTitle}>{title}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={[styles.statChange, { color: positive ? "#2ECC71" : "#E74C3C" }]}>
      {/* {change} */}
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
