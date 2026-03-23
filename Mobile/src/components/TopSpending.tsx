import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import Icon from "react-native-vector-icons/FontAwesome5";
import { getExpenseColor, getExpenseIcon } from "../screens/Expenses/expenseUtils";

export type TopSpendingItem = {
  category: string;
  amount: number;
  percentage: number;
  trendLabel: string;
  trendType: "up" | "down" | "none";
};

type CategoryProps = TopSpendingItem;

type TopSpendingCardProps = {
  items: TopSpendingItem[];
  loading?: boolean;
};

const formatCategoryLabel = (category: string) =>
  category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();

const CategoryItem: React.FC<CategoryProps> = ({
  category,
  amount,
  percentage,
  trendLabel,
  trendType,
}) => {
  const isUp = trendType === "up";
  const isDown = trendType === "down";
  const iconName = getExpenseIcon(category);
  const color = getExpenseColor(category);
  const upLabel = trendLabel === "New" ? "New" : `+${trendLabel}`;

  return (
    <View style={styles.itemContainer}>
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Icon name={iconName} size={wp(4.8)} color={color} solid />
        </View>

        <View style={styles.labelContainer}>
          <Text style={styles.labelText}>{formatCategoryLabel(category)}</Text>
          <Text style={styles.subText}>{percentage}% of total</Text>
        </View>

        <View style={styles.rightContainer}>
          <Text style={styles.amountText}>
            INR {Math.round(amount).toLocaleString("en-IN")}
          </Text>
          <View style={styles.trendRow}>
            {isUp && <Text style={styles.trendUp}>{upLabel}</Text>}
            {isDown && <Text style={styles.trendDown}>-{trendLabel}</Text>}
            {trendType === "none" && (
              <Text style={styles.trendNone}>{trendLabel || "No change"}</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.progressBarBackground}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${percentage}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
};

const TopSpendingCard = ({ items, loading }: TopSpendingCardProps) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Top Spending Categories</Text>
      {loading ? (
        <Text style={styles.emptyText}>Loading...</Text>
      ) : items.length === 0 ? (
        <Text style={styles.emptyText}>No spending data for this period.</Text>
      ) : (
        items.map((item, index) => (
          <CategoryItem key={`${item.category}-${index}`} {...item} />
        ))
      )}
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
    borderColor: "#999",
  },
  title: {
    color: "#fff",
    fontSize: hp(2.4),
    fontWeight: "bold",
    marginBottom: hp(2.5),
  },
  itemContainer: {
    marginBottom: hp(3),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: hp(1.5),
  },
  iconCircle: {
    width: wp(11),
    height: wp(11),
    borderRadius: wp(5.5),
    backgroundColor: "#1e1e1e",
    borderWidth: wp(0.3),
    borderColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    marginRight: wp(3),
  },
  labelContainer: {
    flex: 1,
  },
  labelText: {
    color: "#fff",
    fontSize: hp(2.1),
    fontWeight: "600",
  },
  subText: {
    color: "#888",
    fontSize: hp(1.6),
    marginTop: hp(0.4),
  },
  rightContainer: {
    alignItems: "flex-end",
  },
  amountText: {
    color: "#fff",
    fontSize: hp(2.1),
    fontWeight: "bold",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: hp(0.5),
  },
  trendUp: {
    color: "#ff4d4d",
    fontSize: hp(1.5),
    fontWeight: "600",
  },
  trendDown: {
    color: "#00e676",
    fontSize: hp(1.5),
    fontWeight: "600",
  },
  trendNone: {
    color: "#666",
    fontSize: hp(1.5),
  },
  progressBarBackground: {
    height: hp(0.8),
    backgroundColor: "#2a2a2a",
    borderRadius: hp(0.4),
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: hp(0.4),
  },
  emptyText: {
    color: "#aaa",
    fontSize: hp(1.7),
  },
});

export default TopSpendingCard;
