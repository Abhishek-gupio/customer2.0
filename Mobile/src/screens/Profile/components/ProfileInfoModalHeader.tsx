import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import BackButton from '../../../components/BackButton';
import LoaderButton from '../../../components/Button';

type ProfileInfoModalHeaderProps = {
  styles: any;
  isEditing: boolean;
  saving: boolean;
  onRequestClose: () => void;
  onEdit: () => void;
  onSave: () => void;
};

export const ProfileInfoModalHeader = React.memo(function ProfileInfoModalHeader({
  styles,
  isEditing,
  saving,
  onRequestClose,
  onEdit,
  onSave,
}: ProfileInfoModalHeaderProps) {
  return (
    <View style={styles.advancedModalHeader}>
      <View style={localStyles.headerRow}>
        <BackButton onPress={onRequestClose} />
        <View>
          <Text style={styles.advancedModalTitle}>Account Details</Text>
          <Text style={styles.advancedModalSubtitle}>Personal information & settings</Text>
        </View>
      </View>
      <View style={styles.headerActions}>
        {!isEditing ? (
          <TouchableOpacity style={styles.editPill} onPress={onEdit}>
            <Icon name="pen" size={10} color="#FFBF00" />
            <Text style={styles.editPillText}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <LoaderButton
            title="Save"
            loading={saving}
            loadingTitle="Saving..."
            onPress={onSave}
            style={styles.savePill}
            titleStyle={styles.savePillText}
            loadingTitleStyle={styles.savePillText}
            indicatorColor="#000"
          />
        )}
      </View>
    </View>
  );
});

const localStyles = {
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
};
