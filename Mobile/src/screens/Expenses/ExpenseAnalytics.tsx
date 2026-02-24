import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import Icon from "react-native-vector-icons/Feather";
import { useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import { Alert } from "react-native";
import SpendingAnalysis from "../../components/SpendingAnalysis";
import CostPerKmCard from "../../components/CostPerKm";
import TopSpendingCard from "../../components/TopSpending";
import Iconi from 'react-native-vector-icons/MaterialCommunityIcons';



const screenWidth = Dimensions.get("window").width;

export default function ExpenseAnalytics() {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container} contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        <LinearGradient
          colors={["rgb(62, 59, 59)", "rgba(27, 26, 26, 0.95)"]}
          style={styles.shader}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="arrow-left" size={wp(8)} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.downloadBtn} onPress={() => Alert.alert("Download", "Chart download functionality coming soon!")}>
              <Icon name="download" size={wp(8)} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.subHeder}>
            <Text style={styles.title}>Detailed Analytics</Text>
            <Text style={styles.subtitle}>Comprehensive expense insights</Text>
          </View>
        </LinearGradient>

        <View style={styles.cardRow}>
          <StatCard title="Total Spent" value="₹172K" change="+12%" positive />
          <StatCard title="Avg Monthly" value="₹14.3K" change="-3%" />
          <StatCard title="Cost/Km" value="₹7.51" change="-5%" positive />
        </View>

        <SpendingAnalysis />
        <CostPerKmCard />
        <TopSpendingCard />
      </SafeAreaView>

      <View style={styles.keyInsights}>
        <View style={styles.kryInsightsHeader}>
          <Iconi name="lightbulb-on" size={25} color="#FFD700" style={{ marginRight: 8 }} />
          <Text style={styles.title}>Key Insights</Text>
        </View>
        <Text style={styles.insightText}>• Your fuel expenses are 5% higher than average this month.</Text>
        <Text style={styles.insightText}>• Maintenance costs decreased by 15% compared to last quarter.</Text>
        <Text style={styles.insightText}>• You can save ₹2,450/month by optimizing fuel purchases.</Text>
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
  shader: {
    borderBottomLeftRadius: wp(12),
    borderBottomRightRadius: wp(12),
  },

  title: {
    color: "#fff",
    fontSize: hp(2.9),
    fontWeight: "700",
  },

  subtitle: {
    color: "#888",
    fontSize: hp(1.8),
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
    padding: wp(2),
    marginLeft: -wp(5),
  },
  subHeder: {
    marginTop: hp(2),
    padding: wp(4)
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


