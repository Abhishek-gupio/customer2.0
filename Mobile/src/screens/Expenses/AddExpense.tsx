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
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";


const openCamera = () => {
  launchCamera({ mediaType: "photo" }, (response) => {
    if (!response.didCancel && response.assets) {
      console.log("Image:", response.assets[0].uri);
    }
  });
};

import Voice from "@react-native-voice/voice";
import { useNavigation } from "@react-navigation/native";

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
  
  const navigation=useNavigation();

  return (
    <>
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={() => navigation.goBack()}>
        <Pressable style={styles.panel} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Expense</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={25} color="#fff" />
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
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    paddingHorizontal: wp(5),
  },

  panel: {
    borderRadius: wp(7),
    padding: wp(5),
    backgroundColor: "rgba(28,28,28,0.95)",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: hp(2),
  },

  title: {
    color: "#fff",
    fontSize: hp(2.3),
    fontWeight: "600",
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: wp(6),
    paddingVertical: hp(3),
    alignItems: "center",
    marginBottom: hp(2),
  },

  iconCircle: {
    width: wp(16),
    height: wp(16),
    borderRadius: wp(8),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: hp(1),
  },

  cardText: {
    color: "#fff",
    fontSize: hp(1.9),
    fontWeight: "500",
  },
});

