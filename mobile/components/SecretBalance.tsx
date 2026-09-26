import { Eye, EyeOff } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { colors } from '@/constants/theme';

type SecretBalanceProps = {
  amount: string;
  masked: string;
  shown: boolean;
  onToggle: () => void;
  amountStyle?: StyleProp<TextStyle>;
  iconColor?: string;
};

export function SecretBalance({
  amount,
  masked,
  shown,
  onToggle,
  amountStyle,
  iconColor = colors.gray600,
}: SecretBalanceProps) {
  return (
    <View style={styles.row}>
      <Text style={amountStyle} numberOfLines={1}>
        {shown ? amount : masked}
      </Text>
      <Pressable
        onPress={onToggle}
        style={styles.eyeButton}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={shown ? 'Hide balance' : 'Show balance'}>
        {shown ? <EyeOff size={18} color={iconColor} /> : <Eye size={18} color={iconColor} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flexShrink: 1,
  },
  eyeButton: {
    padding: 4,
  },
});
