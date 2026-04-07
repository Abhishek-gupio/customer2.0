import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { styles } from '../homeStyles';
import { HOME_STATES } from '../types/home';

type StateSelectionModalProps = {
  visible: boolean;
  selectedState: string;
  onSelect: (state: string) => void;
  onClose: () => void;
};

export const StateSelectionModal = React.memo(function StateSelectionModal({
  visible,
  selectedState,
  onSelect,
  onClose,
}: StateSelectionModalProps) {
  const [stateSearchQuery, setStateSearchQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setStateSearchQuery('');
    }
  }, [visible]);

  const filteredStates = useMemo(
    () =>
      HOME_STATES.filter(state =>
        state.toLowerCase().includes(stateSearchQuery.toLowerCase()),
      ),
    [stateSearchQuery],
  );

  const handleClose = useCallback(() => {
    setStateSearchQuery('');
    onClose();
  }, [onClose]);

  const handleSelect = useCallback(
    (state: string) => {
      setStateSearchQuery('');
      onSelect(state);
    },
    [onSelect],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select State</Text>
            <TouchableOpacity onPress={handleClose}>
              <MaterialIcon name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.stateSearchContainer}>
            <MaterialIcon
              name="magnify"
              size={20}
              color="#999"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.stateSearchInput}
              placeholder="Search state..."
              placeholderTextColor="#666"
              value={stateSearchQuery}
              onChangeText={setStateSearchQuery}
            />
            {stateSearchQuery ? (
              <TouchableOpacity onPress={() => setStateSearchQuery('')}>
                <MaterialIcon name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            ) : null}
          </View>

          <FlatList
            data={filteredStates}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.stateOption,
                  selectedState === item
                    ? styles.selectedStateOption
                    : undefined,
                ]}
                onPress={() => handleSelect(item)}
              >
                <Text style={styles.stateOptionText}>{item}</Text>
                {selectedState === item ? (
                  <MaterialIcon name="check" size={20} color="#fff" />
                ) : null}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
});
