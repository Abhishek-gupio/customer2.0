import React, { useMemo } from 'react';
import { Image, View } from 'react-native';
import { createStyles } from '../homeStyles';
import { useTheme } from '../../../theme/ThemeContext';

export const ComingSoonSection = React.memo(function ComingSoonSection() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Image
        source={require('../../../assets/images/coming_soon.png') as any}
        style={styles.comingSoonBadge}
        resizeMode="contain"
      />
    </View>
  );
});
