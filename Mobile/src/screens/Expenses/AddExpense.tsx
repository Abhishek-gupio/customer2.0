import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import ManualEntryOverlay from "./ManualEntry";

import { launchCamera } from "react-native-image-picker";

const openCamera = () => {
  launchCamera({ mediaType: "photo" }, (response) => {
    if (!response.didCancel && response.assets) {
      console.log("Image:", response.assets[0].uri);
    }
  });
};

import Voice from "@react-native-voice/voice";

const startVoiceRecording = async () => {
  try {
    await Voice.start("en-US");
  } catch (e) {
    console.error(e);
  }
};


interface AddExpenseOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export default function AddExpenseOverlay({ visible, onClose }: AddExpenseOverlayProps) {
  const [showManual, setShowManual] = useState(false);

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.panel} onPress={() => {}}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Add Expense</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <ActionCard
              icon="camera-outline"
              label="Scan Bills"
              onPress={openCamera}
            />

            <ActionCard
              icon="mic-outline"
              label="Add by Voice"
              onPress={startVoiceRecording}
            />

            <ActionCard
              icon="create-outline"
              label="Enter Manually"
              onPress={() => setShowManual(true)}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Manual Entry Overlay */}
      <ManualEntryOverlay
        visible={showManual}
        onClose={() => setShowManual(false)}
      />
    </>
  );
}

function ActionCard({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={26} color="#fff" />
      </View>
      <Text style={styles.cardText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  panel: {
    borderRadius: 28,
    padding: 20,
    backgroundColor: "rgba(28,28,28,0.95)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 22,
    paddingVertical: 26,
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  cardText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
});
