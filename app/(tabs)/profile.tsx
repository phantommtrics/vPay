import {
  Bell,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  LogOut,
  ShieldCheck,
  User,
} from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/constants/theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>MJ</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>Modou Jallow</Text>
          <Text style={styles.userPhone}>+220 712 3456</Text>
        </View>
        <ChevronRight size={20} color={colors.gray400} />
      </View>

      <View style={styles.kycBanner}>
        <CheckCircle2 size={20} color={colors.emerald600} />
        <View style={styles.kycContent}>
          <Text style={styles.kycTitle}>Identity Verified</Text>
          <Text style={styles.kycBody}>
            Your KYC is approved. You have full access to create virtual cards
            and fund your account.
          </Text>
        </View>
      </View>

      <View style={styles.settingsCard}>
        <SettingsRow
          icon={User}
          label="Personal Details"
          iconBg={colors.blue50}
          iconColor={colors.blue600}
        />
        <SettingsRow
          icon={ShieldCheck}
          label="Security & Limits"
          iconBg={colors.emerald50}
          iconColor={colors.emerald600}
        />
        <SettingsRow
          icon={Bell}
          label="Notifications"
          iconBg={colors.orange50}
          iconColor={colors.orange600}
        />
        <SettingsRow
          icon={HelpCircle}
          label="Help & Support"
          iconBg={colors.purple50}
          iconColor={colors.purple600}
          isLast
        />
      </View>

      <Pressable style={styles.logoutButton}>
        <LogOut size={18} color={colors.red500} />
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  iconBg,
  iconColor,
  isLast,
}: {
  icon: typeof User;
  label: string;
  iconBg: string;
  iconColor: string;
  isLast?: boolean;
}) {
  return (
    <Pressable style={[styles.settingsRow, !isLast && styles.settingsRowBorder]}>
      <View style={styles.settingsLeft}>
        <View style={[styles.settingsIcon, { backgroundColor: iconBg }]}>
          <Icon size={16} color={iconColor} />
        </View>
        <Text style={styles.settingsLabel}>{label}</Text>
      </View>
      <ChevronRight size={18} color={colors.gray400} />
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.gray100,
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.emerald100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.emerald700,
    fontFamily: 'Inter_700Bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  userPhone: {
    fontSize: 14,
    color: colors.gray500,
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
  },
  kycBanner: {
    flexDirection: 'row',
    backgroundColor: colors.emerald50,
    borderWidth: 1,
    borderColor: colors.emerald100,
    borderRadius: radius.md,
    padding: 16,
    gap: 12,
  },
  kycContent: {
    flex: 1,
  },
  kycTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.emerald900,
    fontFamily: 'Inter_700Bold',
  },
  kycBody: {
    fontSize: 12,
    color: colors.emerald700,
    marginTop: 4,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  settingsCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gray100,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingsRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray50,
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray700,
    fontFamily: 'Inter_500Medium',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: radius.md,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.red500,
    fontFamily: 'Inter_500Medium',
  },
});
