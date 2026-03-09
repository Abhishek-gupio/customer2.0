import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from "react-native-responsive-screen";
import { useNavigation } from "@react-navigation/native";

export default function HomeScreen() {
  const [message, setMessage] = useState("");
  const navigation = useNavigation();
  const statusPulse = useRef(new Animated.Value(1)).current;
  const orbBreath = useRef(new Animated.Value(0)).current;
  const ringSpinA = useRef(new Animated.Value(0)).current;
  const ringSpinB = useRef(new Animated.Value(0)).current;
  const highlightDrift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const statusAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(statusPulse, {
          toValue: 1.6,
          duration: 800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(statusPulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const orbAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(orbBreath, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orbBreath, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const ringAnimationA = Animated.loop(
      Animated.timing(ringSpinA, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const ringAnimationB = Animated.loop(
      Animated.timing(ringSpinB, {
        toValue: 1,
        duration: 17000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const driftAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(highlightDrift, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(highlightDrift, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    statusAnimation.start();
    orbAnimation.start();
    ringAnimationA.start();
    ringAnimationB.start();
    driftAnimation.start();

    return () => {
      statusAnimation.stop();
      orbAnimation.stop();
      ringAnimationA.stop();
      ringAnimationB.stop();
      driftAnimation.stop();
    };
  }, [statusPulse, orbBreath, ringSpinA, ringSpinB, highlightDrift]);

  const ringRotateA = ringSpinA.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const ringRotateB = ringSpinB.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"],
  });

  const auraBlueOpacity = orbBreath.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.28, 0.55, 0.28],
  });

  const auraCyanOpacity = orbBreath.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.2, 0.42, 0.2],
  });

  const auraScale = orbBreath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.12],
  });

  const coreScale = orbBreath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.05],
  });

  const coreOpacity = orbBreath.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.82, 1, 0.82],
  });

  const highlightX = highlightDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [-16, 18],
  });

  const highlightY = highlightDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [8, -12],
  });

  const highlightOpacity = highlightDrift.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.35, 0.85, 0.35],
  });

  const innerPulseScale = orbBreath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.08],
  });

  const innerPulseOpacity = orbBreath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.14, 0.3],
  });

  const ringOpacityA = orbBreath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0.48],
  });

  const ringOpacityB = orbBreath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.38],
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#050b17" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 20}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
            <View style={styles.status}>
              <Animated.View
                style={[
                  styles.dot,
                  {
                    transform: [{ scale: statusPulse }],
                    opacity: statusPulse.interpolate({
                      inputRange: [1, 1.6],
                      outputRange: [1, 0.4],
                    }),
                  },
                ]}
              />
              <Text style={styles.headerText}>GUPIO AI</Text>
            </View>
          </View>

          <View style={styles.orbContainer}>
            <Animated.View
              style={[
                styles.orbGlow,
                styles.orbGlowBlue,
                { opacity: auraBlueOpacity, transform: [{ scale: auraScale }] },
              ]}
            />
            <Animated.View
              style={[
                styles.orbGlow,
                styles.orbGlowCyan,
                { opacity: auraCyanOpacity, transform: [{ scale: auraScale }] },
              ]}
            />
            <View style={styles.orb}>
              <Animated.View
                style={[
                  styles.orbRing,
                  styles.orbRingA,
                  { opacity: ringOpacityA, transform: [{ rotate: ringRotateA }] },
                ]}
              />
              <Animated.View
                style={[
                  styles.orbRing,
                  styles.orbRingB,
                  { opacity: ringOpacityB, transform: [{ rotate: ringRotateB }] },
                ]}
              />
              <Animated.View
                style={[
                  styles.orbCore,
                  { transform: [{ scale: coreScale }], opacity: coreOpacity },
                ]}
              />
              <Animated.View
                style={[
                  styles.innerPulse,
                  { transform: [{ scale: innerPulseScale }], opacity: innerPulseOpacity },
                ]}
              />
              <Animated.View
                style={[
                  styles.orbHighlight,
                  {
                    opacity: highlightOpacity,
                    transform: [{ translateX: highlightX }, { translateY: highlightY }],
                  },
                ]}
              />
            </View>
          </View>

          <Text style={styles.hello}>Hello Shree</Text>
          <Text style={styles.title}>How can I help{"\n"}you today?</Text>

          <View style={styles.cards}>
            <ActionCard icon="car" title="Vehicle Health" subtitle="Check my car" />
            <ActionCard icon="shield-checkmark" title="Insurance Status" subtitle="Policy details" />
            <ActionCard icon="cash" title="Monthly Expenses" subtitle="Spending report" />
            <ActionCard icon="build" title="Schedule Service" subtitle="Book service" />
          </View>
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Ask anything..."
            placeholderTextColor="#7a8599"
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            returnKeyType="send"
            onSubmitEditing={() => {
              if (!message.trim()) return;

              navigation.navigate("Chat", {
                userMessage: message,
              });

              setMessage("");
            }}
          />
          <Ionicons name="mic" size={20} color="#9fb3ff" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type ActionCardProps = {
  icon: string;
  title: string;
  subtitle: string;
};

function ActionCard({ icon, title, subtitle }: ActionCardProps) {
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
    paddingHorizontal: hp(2.5),
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
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
    justifyContent: "center",
    marginVertical: 36,
    height: 210,
  },

  orbGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 105,
  },

  orbGlowBlue: {
    backgroundColor: "#3f4249",
  },

  orbGlowCyan: {
    backgroundColor: "#485c62",
  },

  orb: {
    width: 170,
    height: 170,
    borderRadius: 88,
    backgroundColor: "#0a1730",
    borderWidth: 1,
    borderColor: "rgba(159, 179, 255, 0.22)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  orbRing: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
  },

  orbRingA: {
    borderColor: "#6e7279",
    borderTopWidth: 2,
    borderRightWidth: 0.8,
    borderBottomWidth: 0.4,
    borderLeftWidth: 1.2,
  },

  orbRingB: {
    width: 198,
    height: 198,
    borderRadius: 99,
    borderColor: "#35636f",
    borderTopWidth: 0.6,
    borderRightWidth: 1.6,
    borderBottomWidth: 1.2,
    borderLeftWidth: 0.4,
  },

  orbCore: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: "#434e5e",
  },

  innerPulse: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#ced6dd",
  },

  orbHighlight: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 17,
    backgroundColor: "#506d7d",
    top: 46,
    left: 48,
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
  backButton: {
    borderRadius: wp(5),
    padding: wp(0.8),
    justifyContent: "center",
    alignItems: "center",
  },
});
