import { Plus, Settings2, ShieldAlert, Snowflake, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VirtualCard } from '@/components/VirtualCard';
import { colors, radius, spacing } from '@/constants/theme';

export default function CardsScreen() {
  const insets = useSafeAreaInsets();
  const [isFrozen, setIsFrozen] = useState(false);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}>
      <View>
        <Text style={styles.title}>Your Cards</Text>
        <Text style={styles.subtitle}>Manage your virtual cards</Text>
      </View>

      <View>
        <VirtualCard
          balance={124.5}
          cardNumber="4242 4242 4242 1234"
          expiry="12/26"
          cvv="456"
          isFrozen={isFrozen}
        />
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
        </View>
      </View>

      <View style={styles.controls}>
        <ControlButton
          icon={Snowflake}
          label={isFrozen ? 'Unfreeze' : 'Freeze'}
          iconBg={isFrozen ? colors.blue100 : colors.gray100}
          iconColor={isFrozen ? colors.blue600 : colors.gray600}
          onPress={() => setIsFrozen(!isFrozen)}
        />
        <ControlButton
          icon={Settings2}
          label="Limits"
          iconBg={colors.gray100}
          iconColor={colors.gray600}
        />
        <ControlButton
          icon={ShieldAlert}
          label="Security"
          iconBg={colors.gray100}
          iconColor={colors.gray600}
        />
        <ControlButton
          icon={Trash2}
          label="Delete"
          iconBg={colors.red50}
          iconColor={colors.red500}
          labelColor={colors.red500}
        />
      </View>

      <Pressable style={styles.newCard}>
        <View style={styles.newCardIcon}>
          <Plus size={18} color={colors.emerald700} />
        </View>
        <Text style={styles.newCardText}>Generate New Card</Text>
      </Pressable>

      <Text style={styles.feeNote}>
        Card creation fee: $1.50. You can have up to 3 active virtual cards at a
        time.
      </Text>
    </ScrollView>
  );
}

function ControlButton({
  icon: Icon,
  label,
  iconBg,
  iconColor,
  labelColor = colors.gray600,
  onPress,
}: {
  icon: typeof Snowflake;
  label: string;
  iconBg: string;
  iconColor: string;
  labelColor?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.controlButton} onPress={onPress}>
      <View style={[styles.controlIcon, { backgroundColor: iconBg }]}>
        <Icon size={20} color={iconColor} />
      </View>
      <Text style={[styles.controlLabel, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 14,
    color: colors.gray500,
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gray300,
  },
  dotActive: {
    width: 16,
    backgroundColor: colors.emerald600,
  },
  controls: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  controlButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
  },
  controlIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  controlLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
  },
  newCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.emerald100,
    backgroundColor: colors.emerald50,
  },
  newCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.emerald200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newCardText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.emerald700,
    fontFamily: 'Inter_600SemiBold',
  },
  feeNote: {
    fontSize: 12,
    color: colors.gray400,
    textAlign: 'center',
    paddingHorizontal: 16,
    fontFamily: 'Inter_400Regular',
  },
});
