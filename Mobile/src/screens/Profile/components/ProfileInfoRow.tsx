import React from 'react';
import { Text, TextInput, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';

type ProfileInfoRowProps = {
  styles: any;
  icon: string;
  label: string;
  value: string;
  isEditing: boolean;
  onChange?: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  error?: string;
  numberOfLines?: number;
  fixedHeight?: boolean;
};

export const ProfileInfoRow = React.memo(function ProfileInfoRow({
  styles,
  icon,
  label,
  value,
  isEditing,
  onChange,
  keyboardType = 'default',
  error,
  numberOfLines,
  fixedHeight,
}: ProfileInfoRowProps) {
  return (
    <View style={styles.verticalRow}>
      <View style={styles.vIconWrap}>
        <Icon name={icon} size={wp(3.8)} color="#aaa" />
      </View>
      <View style={styles.vContentWrap}>
        <Text style={styles.vLabel}>{label}</Text>
        <View
          style={[
            styles.inputContainer,
            isEditing ? styles.inputContainerActive : undefined,
            isEditing && error ? styles.inputContainerError : undefined,
            fixedHeight ? styles.inputContainerFixed : undefined,
          ]}
        >
          {isEditing && onChange ? (
            <TextInput
              value={value}
              onChangeText={onChange}
              keyboardType={keyboardType}
              autoCorrect={false}
              placeholder={`Enter ${label}`}
              placeholderTextColor="#444"
              style={styles.vInput}
            />
          ) : (
            <Text style={styles.vValue} numberOfLines={numberOfLines}>
              {value || 'Not provided'}
            </Text>
          )}
        </View>
        {isEditing && error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </View>
  );
});
