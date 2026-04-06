import React, { useCallback } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import BackButton from '../../../components/BackButton';
import LoaderButton from '../../../components/Button';

type AvatarItem = {
  id: string;
  url: string;
  label: string;
};

type ProfileAvatarPickerModalProps = {
  styles: any;
  visible: boolean;
  avatarItems: AvatarItem[];
  selectedAvatar: string | null;
  saving: boolean;
  onClose: () => void;
  onSelectAvatar: (avatarUrl: string) => void;
  onConfirmAvatar: () => void;
};

export const ProfileAvatarPickerModal = React.memo(function ProfileAvatarPickerModal({
  styles,
  visible,
  avatarItems,
  selectedAvatar,
  saving,
  onClose,
  onSelectAvatar,
  onConfirmAvatar,
}: ProfileAvatarPickerModalProps) {
  const renderAvatarItem = useCallback(
    ({ item }: { item: AvatarItem }) => {
      const isSelected = selectedAvatar === item.url;
      return (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onSelectAvatar(item.url)}
          style={[styles.avatarGridItem, isSelected && styles.avatarGridItemSelected]}
        >
          <Image source={{ uri: item.url }} style={styles.avatarGridImage} resizeMode="cover" />
          {isSelected ? (
            <View style={styles.avatarSelectedBadge}>
              <MaterialIcon name="check" size={16} color="#fff" />
            </View>
          ) : null}
          <Text style={[styles.avatarGridLabel, isSelected && styles.avatarGridLabelSelected]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      );
    },
    [onSelectAvatar, selectedAvatar, styles],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.avatarModalContainer}>
        <View style={styles.avatarModalHeader}>
          <BackButton onPress={onClose} />
          <Text style={[styles.avatarModalTitle, localStyles.avatarModalTitle]}>Choose Avatar</Text>
          <View style={localStyles.headerSpacer} />
        </View>

        <FlatList
          data={avatarItems}
          numColumns={3}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.avatarGrid}
          columnWrapperStyle={styles.avatarRow}
          showsVerticalScrollIndicator={false}
          renderItem={renderAvatarItem}
        />

        {selectedAvatar ? (
          <View style={styles.avatarConfirmWrap}>
            <LoaderButton
              title="Set as Profile Picture"
              loading={saving}
              loadingTitle="Saving..."
              onPress={onConfirmAvatar}
              style={styles.avatarConfirmBtn}
              titleStyle={styles.avatarConfirmText}
              loadingTitleStyle={styles.avatarConfirmText}
              indicatorColor="#000"
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
});

const localStyles = {
  avatarModalTitle: {
    fontFamily: 'Outfit-Bold',
  },
  headerSpacer: {
    width: 40,
  },
};
