import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { SafeAreaView } from "react-native-safe-area-context";


export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
        <View style={styles.status}>
          <View style={styles.dot} />
          <Text style={styles.headerText}>GUPIO AI</Text>
        </View>
      </View>

      {/* Orb */}
      <View style={styles.orbContainer}>
        <View style={styles.orb} />
      </View>

      {/* Text */}
      <Text style={styles.hello}>Hello Robin</Text>
      <Text style={styles.title}>How can I help{"\n"}you today?</Text>

      {/* Cards */}
      <View style={styles.cards}>
        <ActionCard
          icon ="car"
          title="Vehicle Health"
          subtitle="Check my car"
        />
        <ActionCard
          icon="shield-checkmark"
          title="Insurance Status"
          subtitle="Policy details"
        />
        <ActionCard
          icon="cash"
          title="Monthly Expenses"
          subtitle="Spending report"
        />
        <ActionCard
          icon="build"
          title="Schedule Service"
          subtitle="Book service"
        />
      </View>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Ask anything..."
          placeholderTextColor="#7a8599"
          style={styles.input}
        />
        <Ionicons name="mic" size={20} color="#9fb3ff" />
      </View>
    </SafeAreaView>
  );
}

function ActionCard({ icon ={icon}, title, subtitle }) {
  return (
    <TouchableOpacity style={styles.card}>
      <Ionicons name={icon} size={22} color="#9fb3ff" />
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050b17",
    paddingHorizontal: 20,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },

  status: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00ff9c",
    marginRight: 6,
  },

  headerText: {
    color: "#bfc9ff",
    fontSize: 14,
    letterSpacing: 1,
  },

  orbContainer: {
    alignItems: "center",
    marginVertical: 40,
  },

  orb: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#0b1c38",
    shadowColor: "#5da9ff",
    shadowOpacity: 0.8,
    shadowRadius: 40,
  },

  hello: {
    color: "#7a8599",
    textAlign: "center",
    marginBottom: 8,
  },

  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 30,
  },

  cards: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  card: {
    width: "48%",
    backgroundColor: "#0b1326",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },

  cardTitle: {
    color: "#fff",
    fontWeight: "600",
    marginTop: 10,
  },

  cardSubtitle: {
    color: "#7a8599",
    fontSize: 12,
    marginTop: 4,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0b1326",
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: "auto",
    marginBottom: 20,
  },

  input: {
    flex: 1,
    color: "#fff",
    marginRight: 10,
  },
});