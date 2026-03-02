import React from "react";
import { View, FlatList, Text, StyleSheet } from "react-native";
import BillCard from "../../components/RecentScanndBills";
import { Bill } from "../../navigation/types";
import { formatDate } from "./expenseUtils";
import { API_BASE_URL } from "../../config";

type ExpenseWithReceipt = {
  id: string;
  category?: string;
  amount?: number;
  date?: string;
  receiptUrl?: string | null;
  source?: string;
};

interface BillsProps {
  expenses?: ExpenseWithReceipt[];
}

const normalizeReceiptUrl = (url?: string | null): string | null => {
  if (!url) return null;
  const cleaned = url.trim().replace(/\\/g, "/");
  if (!cleaned) return null;
  return cleaned.startsWith("http") ? cleaned : `${API_BASE_URL}${cleaned}`;
};

const Bills: React.FC<BillsProps> = ({ expenses = [] }) => {
  const billsData: Bill[] = React.useMemo(() => {
    const scanned = expenses
      .map((item) => ({
        ...item,
        normalizedReceiptUrl: normalizeReceiptUrl(item.receiptUrl),
      }))
      .filter((item) => typeof item.normalizedReceiptUrl === "string" && item.normalizedReceiptUrl.length > 0)
      .slice(0, 10)
      .map((item) => ({
        id: item.id,
        title:
          item.category && item.category.length > 0
            ? item.category.charAt(0) + item.category.slice(1).toLowerCase()
            : "Bill",
        amount: Number(item.amount || 0),
        status: "verified" as const,
        uploadedAt: item.date ? formatDate(item.date) : "Recently",
        image: item.normalizedReceiptUrl,
      }));

    return scanned;
  }, [expenses]);

  const renderItem = ({ item }: { item: Bill }) => <BillCard item={item} />;

  if (billsData.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Recent Scanned Bills</Text>
        <Text style={styles.emptyText}>No scanned bills yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Recent Scanned Bills</Text>

      <FlatList
        data={billsData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
};

export default Bills;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  heading: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginVertical: 12,
  },
  emptyText: {
    color: "#888",
    marginBottom: 12,
  },
});
