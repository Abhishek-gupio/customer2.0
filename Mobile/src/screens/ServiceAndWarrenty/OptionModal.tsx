import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import IconMC from "react-native-vector-icons/MaterialCommunityIcons";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

interface ServiceOptionsOverlayProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (screen: "ServiceHistory" | "WarrantyStatus") => void;
}

export default function ServiceOptionsOverlay({
  visible,
  onClose,
  onSelect,
}: ServiceOptionsOverlayProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel} onPress={() => {}}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Service Hub</Text>
              <Text style={styles.subtitle}>ADVANCED UTILITIES</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <IconMC name="close" size={wp(5)} color="#fff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => onSelect("ServiceHistory")}
            activeOpacity={0.8}
          >
            <View style={styles.iconCircle}>
               <IconMC name="history" size={wp(5)} color="#fff" />
            </View>
            <Text style={styles.optionText}>Service History</Text>
            <IconMC name="chevron-right" size={wp(4.5)} color="#222" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => onSelect("WarrantyStatus")}
            activeOpacity={0.8}
          >
            <View style={styles.iconCircle}>
               <IconMC name="shield-check-outline" size={wp(5)} color="#fff" />
            </View>
            <Text style={styles.optionText}>Warranty Vault</Text>
            <IconMC name="chevron-right" size={wp(4.5)} color="#222" />
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.98)",
    justifyContent: "center",
    paddingHorizontal: wp(6),
  },
  panel: {
    borderRadius: 32,
    padding: wp(6),
    backgroundColor: "#050505",
    borderWidth: 1,
    borderColor: "#111",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: hp(4),
  },
  title: {
    color: "#fff",
    fontSize: wp(6),
    fontFamily: "Outfit-Bold",
  },
  subtitle: {
    color: "#333",
    fontSize: wp(2.5),
    fontFamily: "Outfit-Black",
    letterSpacing: 1,
  },
  closeBtn: {
    width: wp(10),
    height: wp(10),
    borderRadius: 14,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    borderRadius: 24,
    paddingVertical: hp(2),
    paddingHorizontal: wp(4),
    marginBottom: hp(2.5),
    borderWidth: 1,
    borderColor: "#111",
  },
  iconCircle: {
     width: wp(11),
     height: wp(11),
     borderRadius: 14,
     backgroundColor: "#111",
     alignItems: "center",
     justifyContent: "center",
     marginRight: wp(4),
  },
  optionText: {
    flex: 1,
    color: "#fff",
    fontSize: wp(4),
    fontFamily: "Outfit-Bold",
  },
});