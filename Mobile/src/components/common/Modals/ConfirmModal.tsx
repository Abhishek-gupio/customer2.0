import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'default' | 'delete' | 'logout';
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  message,
  type = 'default',
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={[
            styles.iconCircle,
            type === 'logout' ? styles.iconCircleLogout : 
            type === 'delete' ? styles.iconCircleDelete : styles.iconCircleDefault
          ]}>
            <MaterialIcon 
              name={type === 'logout' ? 'logout' : type === 'delete' ? 'delete-outline' : 'info-outline'} 
              size={wp(10)} 
              color={type === 'logout' ? '#FFBF00' : type === 'delete' ? '#FF453A' : '#FFF'} 
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: type === 'delete' ? '#FF453A' : type === 'logout' ? '#FFBF00' : '#FFF' }
              ]}
              onPress={onConfirm}
            >
              <Text style={[
                styles.confirmText, 
                (type === 'logout' || type === 'default') && { color: '#000' }
              ]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(8),
  },
  content: {
    width: '100%',
    backgroundColor: '#121212',
    borderRadius: 32,
    padding: wp(8),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  iconCircle: {
    width: wp(20),
    height: wp(20),
    borderRadius: wp(10),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(3),
  },
  iconCircleDefault: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  iconCircleDelete: {
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
  },
  iconCircleLogout: {
    backgroundColor: 'rgba(255, 191, 0, 0.1)',
  },
  title: {
    fontSize: wp(5.5),
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
    marginBottom: hp(1),
    textAlign: 'center',
  },
  message: {
    fontSize: wp(3.8),
    fontFamily: 'Outfit-Regular',
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: hp(4),
    lineHeight: wp(5.5),
  },
  actionRow: {
    flexDirection: 'row',
    gap: wp(3),
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    paddingVertical: hp(2),
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  cancelText: {
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
    color: '#8E8E93',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: hp(2),
    borderRadius: 16,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
  },
});

export default ConfirmModal;
