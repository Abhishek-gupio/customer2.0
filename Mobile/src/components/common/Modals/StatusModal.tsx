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

interface StatusModalProps {
  visible: boolean;
  type: 'success' | 'delete' | 'error';
  title: string;
  message: string;
  onClose: () => void;
}

const StatusModal: React.FC<StatusModalProps> = ({
  visible,
  type,
  title,
  message,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={[
            styles.iconCircle,
            type === 'delete' ? styles.iconCircleDelete : 
            type === 'error' ? styles.iconCircleError : styles.iconCircleSuccess
          ]}>
            {type === 'success' ? (
              <MaterialIcon name="check-circle-outline" size={wp(10)} color="#00C853" />
            ) : type === 'error' ? (
                <MaterialIcon name="error-outline" size={wp(10)} color="#FF3B30" />
            ) : (
              <MaterialIcon name="delete-outline" size={wp(10)} color="#FF453A" />
            )}
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onClose}
          >
            <Text style={styles.actionText}>Done</Text>
          </TouchableOpacity>
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
  iconCircleSuccess: {
    backgroundColor: 'rgba(0, 200, 83, 0.1)',
  },
  iconCircleDelete: {
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
  },
  iconCircleError: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
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
  actionBtn: {
    width: '100%',
    backgroundColor: '#FFF',
    paddingVertical: hp(2),
    borderRadius: 16,
    alignItems: 'center',
  },
  actionText: {
    fontSize: wp(4.2),
    fontFamily: 'Outfit-Bold',
    color: '#000',
    fontWeight: '700',
  },
});

export default StatusModal;
