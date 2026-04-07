import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { PART_TYPE_OPTIONS } from '../../constants/partTypes';
import type { WarrantyDashboardPart } from '../../services/warrantyService';

type WarrantyUpdateModalProps = {
  visible: boolean;
  selectedPart: WarrantyDashboardPart | null;
  selectedPartTypes: string[];
  updateAmount: string;
  updateOdometer: string;
  updateDate: string;
  updateNotes: string;
  savingUpdate: boolean;
  onClose: () => void;
  onSave: () => void;
  onSelectedPartTypesChange: React.Dispatch<React.SetStateAction<string[]>>;
  onUpdateAmountChange: (value: string) => void;
  onUpdateOdometerChange: (value: string) => void;
  onUpdateDateChange: (value: string) => void;
  onUpdateNotesChange: (value: string) => void;
};

export function WarrantyUpdateModal({
  visible,
  selectedPart,
  selectedPartTypes,
  updateAmount,
  updateOdometer,
  updateDate,
  updateNotes,
  savingUpdate,
  onClose,
  onSave,
  onSelectedPartTypesChange,
  onUpdateAmountChange,
  onUpdateOdometerChange,
  onUpdateDateChange,
  onUpdateNotesChange,
}: WarrantyUpdateModalProps) {
  const [showPartPicker, setShowPartPicker] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShowPartPicker(false);
    }
  }, [visible]);

  const selectedPartLabel =
    selectedPartTypes.length > 0
      ? PART_TYPE_OPTIONS
          .filter((part) => selectedPartTypes.includes(part.value))
          .map((part) => part.label)
          .join(', ')
      : selectedPart?.title || '';

  return (
    <>
      <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
        <Pressable style={styles.modalBackdrop} onPress={onClose}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}
          >
            <Pressable style={styles.modalPanel} onPress={(event) => event.stopPropagation()}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle}>Update Part</Text>
                  <Text style={styles.modalSubtitle}>{selectedPartLabel}</Text>
                </View>
                <TouchableOpacity onPress={onClose} disabled={savingUpdate}>
                  <Icon name="times" size={wp(5)} color="#fff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Parts Serviced</Text>
              <TouchableOpacity
                style={styles.selectorInput}
                onPress={() => setShowPartPicker(true)}
                disabled={savingUpdate}
              >
                <Text
                  style={[
                    styles.selectorInputText,
                    selectedPartTypes.length === 0 && styles.selectorPlaceholderText,
                  ]}
                >
                  {selectedPartTypes.length > 0 ? selectedPartLabel : 'Select parts'}
                </Text>
                <Icon name="chevron-down" size={wp(3.5)} color="#999" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Part Cost</Text>
              <TextInput
                value={updateAmount}
                onChangeText={onUpdateAmountChange}
                keyboardType="numeric"
                placeholder="Enter amount"
                placeholderTextColor="#666"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Odometer Reading</Text>
              <TextInput
                value={updateOdometer}
                onChangeText={onUpdateOdometerChange}
                keyboardType="numeric"
                placeholder="Enter km"
                placeholderTextColor="#666"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Service Date</Text>
              <TextInput
                value={updateDate}
                onChangeText={onUpdateDateChange}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#666"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                value={updateNotes}
                onChangeText={onUpdateNotesChange}
                placeholder="Optional notes"
                placeholderTextColor="#666"
                style={[styles.input, styles.notesInput]}
                multiline
              />

              <TouchableOpacity
                style={[styles.updateButton, savingUpdate && styles.updateButtonDisabled]}
                onPress={onSave}
                disabled={savingUpdate}
              >
                {savingUpdate ? null : (
                  <Text style={styles.updateButtonText}>Save Update</Text>
                )}
              </TouchableOpacity>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <Modal transparent visible={showPartPicker} animationType="fade" statusBarTranslucent>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPartPicker(false)}>
          <Pressable style={styles.partPickerPanel} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.partPickerTitle}>Select Parts</Text>
            <ScrollView style={styles.partPickerScroll} showsVerticalScrollIndicator={false}>
              {PART_TYPE_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.partPickerItem,
                    selectedPartTypes.includes(item.value) && styles.partPickerItemSelected,
                  ]}
                  onPress={() => {
                    onSelectedPartTypesChange((prev) =>
                      prev.includes(item.value)
                        ? prev.filter((value) => value !== item.value)
                        : [...prev, item.value],
                    );
                  }}
                >
                  <Text style={styles.partPickerItemText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.partPickerActions}>
              <TouchableOpacity
                style={styles.partPickerActionButton}
                onPress={() => onSelectedPartTypesChange(selectedPart ? [selectedPart.id] : [])}
              >
                <Text style={styles.partPickerActionText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.partPickerActionButton}
                onPress={() => setShowPartPicker(false)}
              >
                <Text style={styles.partPickerActionText}>Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(4),
  },
  modalKeyboard: {
    width: '100%',
    alignItems: 'center',
  },
  modalPanel: {
    width: '100%',
    backgroundColor: '#151515',
    borderRadius: wp(6),
    padding: wp(5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(2),
    gap: wp(3),
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    color: '#fff',
    fontSize: wp(5),
    fontFamily: 'Outfit-Bold',
  },
  modalSubtitle: {
    color: '#999',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Regular',
    marginTop: hp(0.3),
  },
  inputLabel: {
    color: '#bbb',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Medium',
    marginBottom: hp(0.8),
  },
  input: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: wp(4),
    color: '#fff',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    marginBottom: hp(1.8),
  },
  selectorInput: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: wp(4),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.7),
    marginBottom: hp(1.8),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: wp(3),
  },
  selectorInputText: {
    flex: 1,
    color: '#fff',
    fontSize: wp(3.8),
    fontFamily: 'Outfit-Regular',
  },
  selectorPlaceholderText: {
    color: '#666',
  },
  notesInput: {
    minHeight: hp(10),
    textAlignVertical: 'top',
  },
  partPickerPanel: {
    width: '100%',
    maxWidth: wp(90),
    maxHeight: hp(65),
    backgroundColor: '#151515',
    borderRadius: wp(6),
    padding: wp(5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  partPickerTitle: {
    color: '#fff',
    fontSize: wp(4.8),
    fontFamily: 'Outfit-Bold',
    marginBottom: hp(1.5),
  },
  partPickerScroll: {
    maxHeight: hp(45),
  },
  partPickerItem: {
    paddingVertical: hp(1.6),
    paddingHorizontal: wp(4),
    borderRadius: wp(3.5),
    backgroundColor: '#0f0f0f',
    marginBottom: hp(1),
  },
  partPickerItemSelected: {
    borderWidth: 1,
    borderColor: '#FFBF00',
    backgroundColor: 'rgba(255,191,0,0.12)',
  },
  partPickerItemText: {
    color: '#fff',
    fontSize: wp(3.8),
    fontFamily: 'Outfit-Medium',
  },
  partPickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: wp(3),
    marginTop: hp(1),
  },
  partPickerActionButton: {
    backgroundColor: '#242424',
    borderRadius: wp(3.5),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
  },
  partPickerActionText: {
    color: '#fff',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Medium',
  },
  updateButton: {
    backgroundColor: '#FFBF00',
    borderRadius: wp(4),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: hp(6.5),
    marginTop: hp(1),
  },
  updateButtonDisabled: {
    opacity: 0.7,
  },
  updateButtonText: {
    color: '#000',
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
  },
});
