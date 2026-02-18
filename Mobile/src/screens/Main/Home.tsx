import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import Icon from "react-native-vector-icons/FontAwesome5";
import HomeVideo from "../../components/HomeVideo";
import QuickServicesGrid from "../../components/QuickServicesGrid";
import { useNavigation } from "../../lib/react-navigation-native";
import type { NativeStackNavigationProp } from "../../lib/react-navigation-native-stack";
import type { RootStackParamList } from "../../navigation/types";

export default function Home() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Platform.OS === "android" ? "#0a0a0a" : undefined}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <HomeVideo onProfilePress={() => {}} onHelpPress={() => {}} />

        <QuickServicesGrid
          onServicePress={(label) => {
            if (label === "Documents") {
              navigation.navigate("DocumentList");
            } else if (label === "Expenses") {
              navigation.navigate("Expenses");
            }
          }}
        />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Vehicles</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.cardsScroll}
          >
            <View style={styles.card}>
              <Text style={styles.cardReg}>MH12XX</Text>
              <Text style={styles.cardModel}>Swift</Text>
              <View style={styles.healthBadge}>
                <Icon name="heart" size={14} color="#e74c3c" />
                <Text style={styles.healthText}>85/100</Text>
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardReg}>MH14YY</Text>
              <Text style={styles.cardModel}>i20</Text>
              <View style={styles.healthBadge}>
                <Icon name="heart" size={14} color="#e74c3c" />
                <Text style={styles.healthText}>62/100</Text>
              </View>
            </View>
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitleCentered}>Expiring Soon</Text>
          <View style={styles.alertCard}>
            <Icon
              name="exclamation-triangle"
              size={wp(5)}
              color="#FFBF00"
              style={styles.alertIcon}
            />
            <Text style={styles.alertText}>PUC expires in 15 days (Swift)</Text>
          </View>
          <View style={styles.alertCard}>
            <Icon
              name="exclamation-triangle"
              size={wp(5)}
              color="#FFBF00"
              style={styles.alertIcon}
            />
            <Text style={styles.alertText}>Insurance exp in 30 days (i20)</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitleCentered}>This Month</Text>
          <View style={styles.expenseRow}>
            <Text style={styles.expenseTotal}>Total: ₹12,450</Text>
          </View>
          <View style={styles.expenseItem}>
            <Icon
              name="gas-pump"
              size={wp(4)}
              color="#888"
              style={styles.expenseIcon}
            />
            <Text style={styles.expenseLabel}>Fuel ₹6,200</Text>
          </View>
          <View style={styles.expenseItem}>
            <Icon
              name="parking"
              size={wp(4)}
              color="#888"
              style={styles.expenseIcon}
            />
            <Text style={styles.expenseLabel}>Parking ₹1,800</Text>
          </View>
          <View style={styles.expenseItem}>
            <Icon
              name="wrench"
              size={wp(4)}
              color="#888"
              style={styles.expenseIcon}
            />
            <Text style={styles.expenseLabel}>Service ₹4,450</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitleCentered}>Pending Challans</Text>
          <Text style={styles.placeholderText}>No pending challans</Text>
        </View>

        <View style={{ height: hp(4) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: hp(2),
  },
  section: {
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: hp(1.5),
  },
  sectionTitle: {
    fontSize: wp(5),
    fontWeight: "700",
    color: "#fff",
  },
  sectionTitleCentered: {
    fontSize: wp(5),
    fontWeight: "700",
    color: "#fff",
    marginBottom: hp(1.5),
    textAlign: "center",
  },
  seeAll: {
    fontSize: wp(3.5),
    fontWeight: "600",
    color: "#FFBF00",
  },
  cardsScroll: {
    marginHorizontal: -wp(5),
  },
  card: {
    width: wp(55),
    marginRight: wp(4),
    backgroundColor: "#1a1a1a",
    borderRadius: wp(3),
    padding: wp(4),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardReg: {
    fontSize: wp(4.5),
    fontWeight: "700",
    color: "#fff",
    marginBottom: hp(0.5),
  },
  cardModel: {
    fontSize: wp(3.8),
    color: "#888",
    marginBottom: hp(1),
  },
  healthBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(1.5),
  },
  healthText: {
    fontSize: wp(3.5),
    fontWeight: "600",
    color: "#fff",
  },
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: wp(2.5),
    padding: wp(4),
    marginBottom: hp(1),
    borderWidth: 1,
    borderColor: "rgba(255,191,0,0.2)",
  },
  alertIcon: {
    marginRight: wp(3),
  },
  alertText: {
    flex: 1,
    fontSize: wp(3.8),
    color: "#fff",
    fontWeight: "500",
  },
  expenseRow: {
    marginBottom: hp(1),
  },
  expenseTotal: {
    fontSize: wp(5),
    fontWeight: "700",
    color: "#FFBF00",
  },
  expenseItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: hp(1),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  expenseIcon: {
    marginRight: wp(3),
  },
  expenseLabel: {
    fontSize: wp(4),
    color: "#fff",
  },
  placeholderText: {
    fontSize: wp(3.8),
    color: "#888",
    textAlign: "center",
    paddingVertical: hp(2),
  },
});
