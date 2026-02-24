import React from "react";
import { View, Text, StyleSheet, Image, ImageSourcePropType } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from "react-native-responsive-screen";
import { Bill } from "../navigation/types";

interface Props {
  item: Bill;
}

const BillCard: React.FC<Props> = ({ item }) => {
  const isVerified = item.status === "verified";

  const imageSource: ImageSourcePropType | undefined =
    typeof item.image === "string"
      ? { uri: item.image }
      : typeof item.image === "number"
      ? item.image
      : undefined;

  return (
    <LinearGradient colors={["#363738", "#363638"]} style={styles.card}>
      {/* Status */}
      <View
        style={[
          styles.statusPill,
          { backgroundColor: isVerified ? "#22c55e" : "#f97316" },
        ]}
      >
        <Text style={styles.statusText}>
          {isVerified ? "✓ Verified" : "⏳ Pending"}
        </Text>
      </View>

      {/* Image */}
      {imageSource ? (
        <Image source={imageSource} style={styles.billImage} resizeMode="contain" />
      ) : (
        <View style={styles.imageFallback}>
          <Text style={styles.fallbackText}>No Bill Image</Text>
        </View>
      )}

      {/* Bottom */}
      <View style={styles.bottomRow}>
        <View>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.amount}>₹{item.amount}</Text>
          <Text style={styles.meta}>
            Bill Photo • Uploaded {item.uploadedAt}
          </Text>
        </View>

        {item.warrantyMonths != null && (
          <View style={styles.warrantyPill}>
            <Text style={styles.warrantyText}>
              {item.warrantyMonths}M Warranty
            </Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
};

export default BillCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: wp(6),
    padding: wp(4),
    height: hp(28),
    marginBottom: hp(2),
  },

  statusPill: {
    position: "absolute",
    top: hp(1.5),
    right: wp(4),
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(0.6),
    borderRadius: wp(6),
    zIndex: 2,
  },

  statusText: {
    color: "#fff",
    fontSize: hp(1.4),
    fontWeight: "700",
  },

  billImage: {
    width: "100%",
    height: hp(14),
    borderRadius: wp(3),
    marginVertical: hp(1),
  },

  imageFallback: {
    height: hp(14),
    borderRadius: wp(3),
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: hp(1),
  },

  fallbackText: {
    color: "#9ca3af",
    fontSize: hp(1.3),
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: hp(0.5),
  },

  title: {
    color: "#fff",
    fontSize: hp(1.6),
    fontWeight: "600",
  },

  amount: {
    color: "#d1d5db",
    fontSize: hp(2.6),
    fontWeight: "800",
    marginVertical: hp(0.3),
  },

  meta: {
    color: "#9ca3af",
    fontSize: hp(1.3),
  },

  warrantyPill: {
    borderWidth: 1,
    borderColor: "#facc15",
    backgroundColor: "#2a2a1a",
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.6),
    borderRadius: wp(6),
  },

  warrantyText: {
    color: "#facc15",
    fontSize: hp(1.3),
    fontWeight: "700",
  },
});