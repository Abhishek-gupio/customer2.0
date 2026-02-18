import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/FontAwesome5";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import { useNavigation } from "../../lib/react-navigation-native";
import type { NativeStackNavigationProp } from "../../lib/react-navigation-native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { expenses } from "./data";

type DocListNavProp = NativeStackNavigationProp<RootStackParamList>;

const ProgressRow = ({ label, value, percent, color }: any) => {
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
  const serviceTypes = ["All", "Fuel", "Service", "Tolls", "Insurance"];
  const navigation = useNavigation<DocListNavProp>();
  const [selectedType, setSelectedType] = React.useState("All");
  const [timelineFilter, setTimelineFilter] = React.useState("Monthly");

  const filteredExpenses =
    selectedType === "All"
      ? expenses
      : expenses.filter((item) => item.type === selectedType);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={wp(5)} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Expense Feed</Text>

        <TouchableOpacity onPress={() => navigation.navigate("addExpense")}>
          <Icon name="plus" size={wp(5)} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Total This Month</Text>
          <Text style={styles.amount}>₹12,450</Text>

          <View style={styles.row}>
            <Icon name="arrow-up" size={wp(3)} color="#00c853" />
            <Text style={styles.growthText}> +8% from last month</Text>
          </View>
        </View>

        <View style={styles.card}>
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
              {["Daily", "Weekly", "Monthly", "Yearly"].map((item) => (
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

          <ProgressRow
            label="Fuel"
            value="₹7,500 (60%)"
            percent={60}
            color="#2196f3"
          />

          <ProgressRow
            label="Maintenance"
            value="₹4,500 (36%)"
            percent={36}
            color="#ff6d00"
          />

          <ProgressRow
            label="Other"
            value="₹450 (4%)"
            percent={4}
            color="#00c853"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            {serviceTypes.map((item) => {
              const isActive = selectedType === item;

              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.filterChip, isActive && styles.activeChip]}
                  onPress={() => {
                    setSelectedType(item);
                  }}
                >
                  <Text
                    style={[styles.filterText, isActive && styles.activeText]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {filteredExpenses.map((item) => (
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

        <TouchableOpacity
          style={styles.sectionTitleCentered}
          onPress={() => navigation.navigate("Analytics")}
        >
          <Icon
            name="chart-bar"
            size={wp(5)}
            color="#fff"
            style={{ padding: wp(2) }}
          />
          <Text style={{ color: "#fff" }}>View Detailed Analytics</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ExpenseFeed;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
  },

  headerTitle: {
    color: "#fff",
    fontSize: wp(5.5),
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#1a1a1a",
    marginHorizontal: wp(4),
    marginTop: hp(2),
    borderRadius: wp(6),
    padding: wp(5),
  },

  cardLabel: {
    color: "#aaa",
    fontSize: wp(3.8),
  },

  amount: {
    color: "#fff",
    fontSize: wp(7),
    fontWeight: "700",
    marginTop: hp(1),
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: hp(1),
  },

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  growthText: {
    color: "#00c853",
    fontSize: wp(3.5),
  },

  percentBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a0000",
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.7),
    borderRadius: wp(5),
  },

  percentText: {
    color: "#ff5252",
    fontSize: wp(3.5),
    fontWeight: "600",
  },

  progressLabel: {
    color: "#fff",
    fontSize: wp(4),
  },

  progressValue: {
    color: "#aaa",
    fontSize: wp(3.5),
  },

  progressBg: {
    height: hp(1.2),
    backgroundColor: "#333",
    borderRadius: wp(5),
    marginTop: hp(1),
  },

  progressFill: {
    height: "100%",
    borderRadius: wp(5),
  },

  filterRow: {
    flexDirection: "row",
    paddingHorizontal: wp(4),
    marginTop: hp(2),
  },

  filterChip: {
    borderWidth: 1,
    borderColor: "#555",
    borderRadius: wp(6),
    paddingHorizontal: wp(5),
    paddingVertical: hp(1),
    marginRight: wp(3),
  },

  activeChip: {
    backgroundColor: "#ddd",
  },

  filterText: {
    color: "#fff",
    fontSize: wp(3.8),
  },

  activeText: {
    color: "#000",
    fontWeight: "600",
  },

  listCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141414",
    marginHorizontal: wp(4),
    marginVertical: hp(2),
    padding: wp(4),
    borderRadius: wp(6),
  },

  iconCircle: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    borderWidth: 1,
    borderColor: "#4caf50",
    alignItems: "center",
    justifyContent: "center",
    marginRight: wp(4),
  },

  itemTitle: {
    color: "#fff",
    fontSize: wp(4.5),
    fontWeight: "600",
  },

  itemSub: {
    color: "#888",
    fontSize: wp(3.2),
    marginTop: hp(0.5),
  },

  itemAmount: {
    color: "#fff",
    fontSize: wp(5),
    fontWeight: "700",
  },
  sectionTitleCentered: {
    padding: wp(4),
    backgroundColor: "#1a1a1a",
    borderRadius: wp(6),
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderColor: "#b4bd79",
    borderWidth: 1,
    marginHorizontal: wp(4),
    marginVertical: hp(2),
  },
  timelineContainer: {
    marginTop: hp(2),
    paddingHorizontal: wp(3),
    backgroundColor: "#0d0b0b",
    borderRadius: wp(6),
    padding: wp(2.5),
    borderColor: "#b4bd79",
    borderWidth: 1,
  },
  timelineSubContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timelineItem: {
    paddingVertical: hp(1),
    paddingHorizontal: wp(2),
    borderRadius: wp(2),
    backgroundColor: "#333",
    marginHorizontal: wp(1),
  },
  activeTimelineItem: {
    backgroundColor: "#b4bd79",
  },
  timelineText: {
    color: "#fff",
    fontSize: wp(3.5),
  },
  activeTimelineText: {
    color: "#000",
    fontWeight: "600",
  },
});
