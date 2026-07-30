import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Clipboard } from 'react-native';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { triggerHaptic } from '../../utils/haptics';

interface VehicleActionSheetProps {
  visible: boolean;
  vehicle: any;
  onClose: () => void;
  onNavigate: (screen: string, params?: any) => void;
  onShowToast: (msg: string) => void;
}

export const VehicleActionSheet: React.FC<VehicleActionSheetProps> = ({
  visible,
  vehicle,
  onClose,
  onNavigate,
  onShowToast,
}) => {
  if (!vehicle) return null;

  const handleCopyPlate = () => {
    triggerHaptic('medium');
    Clipboard.setString(vehicle.registrationNumber);
    onClose();
    onShowToast(`Plate number ${vehicle.registrationNumber} copied to clipboard!`);
  };

  const handleAction = (action: () => void) => {
    triggerHaptic('light');
    onClose();
    action();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheetContainer}>
          <View style={styles.handleBar} />
          
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <IconMC name="car-sports" size={wp(6)} color="#5F9EA0" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.plateText}>{vehicle.registrationNumber}</Text>
              <Text style={styles.modelText}>{vehicle.make || 'Vehicle'} {vehicle.model || ''}</Text>
            </View>
          </View>

          <View style={styles.menuDivider} />

          {/* Action 1: Copy Plate */}
          <TouchableOpacity style={styles.actionItem} onPress={handleCopyPlate} activeOpacity={0.75}>
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(95, 158, 160, 0.15)' }]}>
              <IconMC name="content-copy" size={wp(5)} color="#5F9EA0" />
            </View>
            <View style={styles.actionTextBox}>
              <Text style={styles.actionTitle}>Copy Registration Plate</Text>
              <Text style={styles.actionSub}>Copy plate number to clipboard</Text>
            </View>
            <IconMC name="chevron-right" size={wp(5)} color="#666" />
          </TouchableOpacity>

          {/* Action 2: Vehicle QR Code */}
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => handleAction(() => onNavigate('MyVehicleQrCode', { vehicleId: vehicle.id, registrationNumber: vehicle.registrationNumber }))}
            activeOpacity={0.75}
          >
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(255, 255, 255, 0.12)' }]}>
              <IconMC name="qrcode" size={wp(5)} color="#FFFFFF" />
            </View>
            <View style={styles.actionTextBox}>
              <Text style={styles.actionTitle}>Vehicle QR Code</Text>
              <Text style={styles.actionSub}>Show owner contact & scan QR</Text>
            </View>
            <IconMC name="chevron-right" size={wp(5)} color="#666" />
          </TouchableOpacity>

          {/* Action 3: Traffic Challans */}
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => handleAction(() => onNavigate('Challans', { vehicle }))}
            activeOpacity={0.75}
          >
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(255, 69, 58, 0.15)' }]}>
              <IconMC name="file-document-outline" size={wp(5)} color="#FF453A" />
            </View>
            <View style={styles.actionTextBox}>
              <Text style={styles.actionTitle}>Check Traffic Challans</Text>
              <Text style={styles.actionSub}>View & clear pending fines</Text>
            </View>
            <IconMC name="chevron-right" size={wp(5)} color="#666" />
          </TouchableOpacity>

          {/* Action 4: Digital Glovebox */}
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => handleAction(() => onNavigate('DocumentList'))}
            activeOpacity={0.75}
          >
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(10, 132, 255, 0.15)' }]}>
              <IconMC name="shield-check-outline" size={wp(5)} color="#0A84FF" />
            </View>
            <View style={styles.actionTextBox}>
              <Text style={styles.actionTitle}>Digital Glovebox</Text>
              <Text style={styles.actionSub}>RC, Insurance & License docs</Text>
            </View>
            <IconMC name="chevron-right" size={wp(5)} color="#666" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#12141F',
    borderTopLeftRadius: wp(6),
    borderTopRightRadius: wp(6),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: wp(5),
    paddingTop: hp(1.5),
    paddingBottom: hp(4),
  },
  handleBar: {
    width: wp(12),
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginBottom: hp(2),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(1.5),
  },
  iconCircle: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    backgroundColor: 'rgba(95, 158, 160, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(95, 158, 160, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3.5),
  },
  plateText: {
    fontSize: hp(2),
    color: '#FFFFFF',
    fontFamily: 'Outfit-Bold',
    letterSpacing: 0.5,
  },
  modelText: {
    fontSize: hp(1.4),
    color: '#8E8E93',
    fontFamily: 'Outfit-Regular',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: hp(1.5),
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(1.2),
  },
  actionIconBox: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3.5),
  },
  actionTextBox: {
    flex: 1,
  },
  actionTitle: {
    fontSize: hp(1.6),
    color: '#FFFFFF',
    fontFamily: 'Outfit-Medium',
  },
  actionSub: {
    fontSize: hp(1.2),
    color: '#8E8E93',
    fontFamily: 'Outfit-Regular',
    marginTop: hp(0.2),
  },
});

export default VehicleActionSheet;
