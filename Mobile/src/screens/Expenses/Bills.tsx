import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import BillCard from "../../components/RecentScanndBills";
import { Bill } from "../../navigation/types";
import Ionicons from "react-native-vector-icons/Ionicons";
import Icon from 'react-native-vector-icons/Ionicons';


interface BillsProps {
  bills: Bill[];
}

const Bills: React.FC<BillsProps> = ({ bills }) => {
  const [showAll, setShowAll] = useState(false);

  if (!bills || bills.length === 0) {
    return null;
  }

  const hasMoreThanThree = bills.length > 3;
  const visibleBills = showAll || !hasMoreThanThree ? bills : bills.slice(0, 3);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Recent Scanned Bills</Text>
      {visibleBills.map(item => (
        <BillCard key={item.id} item={item} />
      ))}
      {hasMoreThanThree && (
        <TouchableOpacity onPress={() => setShowAll((prev) => !prev)} style={styles.toggleBtn}>
          <Text style={styles.toggleText}>{showAll ? "View less" : "View more"}</Text>
          <Icon
            name={showAll ? 'chevron-up' : 'chevron-down'}
            size={15}
            color="#4CAF50"
            style={{ marginLeft: 6 }}
          />
        </TouchableOpacity>
      )}
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
    toggleBtn: {
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      marginBottom: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      // borderColor: "#4b5563",
      // backgroundColor: "#1f2937",
    },
    toggleText: {
    color: '#4CAF50',
      fontSize: 15,
      fontWeight: "600",
    },
  });
