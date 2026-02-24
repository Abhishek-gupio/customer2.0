import React from "react";
import { View, FlatList, Text, StyleSheet } from "react-native";
import BillCard from "../../components/RecentScanndBills";
import { billsData } from "./data";
import { Bill } from "../../navigation/types";

const Bills: React.FC = () => {
  const renderItem = ({ item }: { item: Bill }) => (
    <BillCard item={item} />
  );

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
  });