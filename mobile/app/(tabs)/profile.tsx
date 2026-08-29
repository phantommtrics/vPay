import { router } from 'expo-router';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  HelpCircle,
  LogOut,
  Shield,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VPayWordmark } from '@/components/VPayWordmark';
import { useAuth } from '@/contexts/AuthContext';
import { getUserDisplayName, getUserInitials } from '@/lib/api';
import { colors, radius, spacing } from '@/constants/theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  if (!user) return null;

  const displayName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : getUserDisplayName(user) ?? 'Complete your profile';
  const initials = getUserInitials(user) ?? '?';

  const handleLogout = async () => {
    await signOut();
    router.replace('/onboarding');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Profile</Text>

      <Pressable
        style={styles.userCard}
        onPress={() => router.push('/personal-details')}
        accessibilityRole="button"
        accessibilityLabel="Open personal details">
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userPhone}>{user.phone ?? user.email}</Text>
        </View>
        <ChevronRight size={20} color={colors.gray400} />
      </Pressable>

      {user.kycStatus === 'approved' ? (
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
      ) : user.kycStatus === 'pending' ? (
        <Pressable style={styles.kycReview} onPress={() => router.push('/personal-details')}>
          <Clock size={20} color={colors.amber600} />
          <View style={styles.kycContent}>
            <Text style={styles.kycPendingTitle}>Under review</Text>
            <Text style={styles.kycPendingBody}>
              We&apos;re reviewing your documents. You&apos;ll be notified once approved.
            </Text>
          </View>
          <ChevronRight size={18} color={colors.amber600} />
        </Pressable>
      ) : user.kycStatus === 'rejected' ? (
        <Pressable style={styles.kycRejected} onPress={() => router.push('/personal-details')}>
          <AlertCircle size={20} color={colors.red500} />
          <View style={styles.kycContent}>
            <Text style={styles.kycRejectedTitle}>Verification rejected</Text>
            <Text style={styles.kycPendingBody}>
              {user.kycRejectionReason ?? 'Please update your details and resubmit.'}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.red500} />
        </Pressable>
      ) : (
        <Pressable
          style={styles.kycPending}
          onPress={() => router.push('/personal-details')}>
          <AlertCircle size={20} color={colors.amber600} />
          <View style={styles.kycContent}>
            <Text style={styles.kycPendingTitle}>Verification Required</Text>
            <Text style={styles.kycPendingBody}>
              Complete your personal details and upload your ID to get verified.
            </Text>
          </View>
          <ChevronRight size={18} color={colors.amber600} />
        </Pressable>
      )}

      <View style={styles.settingsCard}>
        <SettingsRow
          icon={User}
          label="Personal Details"
          iconBg={colors.blue50}
          iconColor={colors.blue600}
          onPress={() => router.push('/personal-details')}
        />
        <SettingsRow
          icon={ShieldCheck}
          label="Security & Limits"
          iconBg={colors.emerald50}
          iconColor={colors.emerald600}
          onPress={() => router.push('/security')}
        />
        <SettingsRow
          icon={HelpCircle}
          label="Help & Support"
          iconBg={colors.purple50}
          iconColor={colors.purple600}
          onPress={() => router.push('/help-support')}
        />
        <SettingsRow
          icon={FileText}
          label="Terms of Service"
          iconBg={colors.gray100}
          iconColor={colors.gray600}
          onPress={() => router.push('/terms')}
        />
        <SettingsRow
          icon={Shield}
          label="Privacy Policy"
          iconBg={colors.blue50}
          iconColor={colors.blue600}
          onPress={() => router.push('/privacy')}
        />
        <SettingsRow
          icon={Trash2}
          label="Delete Account"
          iconBg={colors.red50}
          iconColor={colors.red500}
          labelColor={colors.red500}
          onPress={() => router.push('/delete-account')}
          isLast
        />
      </View>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <LogOut size={18} color={colors.red500} />
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>

      <View style={styles.partnershipSection}>
        <Text style={styles.partnershipLabel}>Powered by</Text>
        <View style={styles.partnerLogos}>
          <VPayWordmark variant="light" width={108} height={35} />
          <View style={styles.partnerDivider} />
          <Image
            source={require('@/assets/images/directPay.png')}
            style={styles.directPayLogo}
            resizeMode="contain"
            accessibilityLabel="Direct Pay"
          />
        </View>
        <Text style={styles.partnershipText}>
          vPay partners with Direct Pay to bring you secure wallet top-ups from local mobile money
          services, including Wave and APS Wallet.
        </Text>
      </View>
    </ScrollView>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  iconBg,
  iconColor,
  labelColor,
  onPress,
  isLast,
}: {
  icon: typeof User;
  label: string;
  iconBg: string;
  iconColor: string;
  labelColor?: string;
  onPress?: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      style={[styles.settingsRow, !isLast && styles.settingsRowBorder]}
      onPress={onPress}>
      <View style={styles.settingsLeft}>
        <View style={[styles.settingsIcon, { backgroundColor: iconBg }]}>
          <Icon size={16} color={iconColor} />
        </View>
        <Text style={[styles.settingsLabel, labelColor ? { color: labelColor } : null]}>
          {label}
        </Text>
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
  kycPending: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amber100,
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: radius.md,
    padding: 16,
    gap: 12,
  },
  kycReview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amber100,
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: radius.md,
    padding: 16,
    gap: 12,
  },
  kycRejected: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.red50,
    borderWidth: 1,
    borderColor: '#fecaca',
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
  kycPendingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  kycRejectedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.red500,
    fontFamily: 'Inter_700Bold',
  },
  kycPendingBody: {
    fontSize: 12,
    color: colors.gray600,
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
  partnershipSection: {
    alignItems: 'center',
    gap: 14,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  partnershipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: 'Inter_600SemiBold',
  },
  partnerLogos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  partnerDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.gray200,
  },
  directPayLogo: {
    width: 120,
    height: 40,
  },
  partnershipText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.gray500,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    maxWidth: 300,
  },
});
