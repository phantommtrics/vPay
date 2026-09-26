import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import ConfirmPasswordScreen from '@/app/confirm-password';
import ConfirmPinScreen from '@/app/confirm-pin';
import DeleteAccountScreen from '@/app/delete-account';
import HelpSupportScreen from '@/app/help-support';
import MyTicketsScreen from '@/app/my-tickets';
import PersonalDetailsScreen from '@/app/personal-details';
import PrivacyScreen from '@/app/privacy';
import SecurityScreen from '@/app/security';
import SendRequestScreen from '@/app/send-request';
import SetPasswordScreen from '@/app/set-password';
import SetPinScreen from '@/app/set-pin';
import TermsScreen from '@/app/terms';
import TicketDetailScreen from '@/app/ticket/[id]';
import VerifyCredentialScreen from '@/app/verify-credential';
import CardsScreen from '@/app/(tabs)/cards';
import FundScreen from '@/app/(tabs)/fund';
import HomeScreen from '@/app/(tabs)/index';
import ProfileScreen from '@/app/(tabs)/profile';
import TransactionsScreen from '@/app/(tabs)/transactions';
import { VPayWordmark } from '@/components/VPayWordmark';
import { colors, radius, spacing } from '@/constants/theme';
import {
  EmbedModeProvider,
  PanelScope,
  useCardsExpanded,
  usePanelStack,
  useSetShellActive,
  useWalletFlowActive,
} from '@/contexts/WebShellContext';
import { useAuth } from '@/contexts/AuthContext';
import { getUserDisplayName } from '@/lib/api';
import type { PanelEntry } from '@/lib/consumer-nav';

export function DesktopShell() {
  const setShellActive = useSetShellActive();
  const stack = usePanelStack();
  const walletFlow = useWalletFlowActive();
  const cardsExpanded = useCardsExpanded();
  const { user } = useAuth();
  const panel = stack[stack.length - 1] ?? null;
  const displayName = user ? getUserDisplayName(user) : null;

  useEffect(() => {
    setShellActive(true);
    return () => setShellActive(false);
  }, [setShellActive]);

  const fundFills = walletFlow && !cardsExpanded;
  const hideCards = walletFlow && !cardsExpanded;

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <VPayWordmark width={132} height={43} />
        {displayName ? <Text style={styles.welcome}>Welcome, {displayName}</Text> : null}
      </View>

      <View style={styles.columns}>
        <View style={styles.homeCol}>
          <View style={styles.homeIntro}>
            <EmbedModeProvider mode="home">
              <HomeScreen />
            </EmbedModeProvider>
          </View>
          <View style={styles.activity}>
            <EmbedModeProvider mode="activity">
              <TransactionsScreen />
            </EmbedModeProvider>
          </View>
        </View>

        <View style={styles.moneyCol}>
          <View style={fundFills ? styles.slotFill : cardsExpanded ? styles.slotHidden : styles.slotHug}>
            <EmbedModeProvider mode="wallet">
              <FundScreen />
            </EmbedModeProvider>
          </View>
          <View style={hideCards ? styles.slotHidden : styles.slotFill}>
            <EmbedModeProvider mode="cards">
              <CardsScreen />
            </EmbedModeProvider>
          </View>
        </View>

        <View style={styles.profileCol}>
          <EmbedModeProvider mode="profile">
            <ProfileScreen />
          </EmbedModeProvider>
          {panel ? <ProfileDrawer entry={panel} depth={stack.length} /> : null}
        </View>
      </View>
    </View>
  );
}

function ProfileDrawer({ entry, depth }: { entry: PanelEntry; depth: number }) {
  const slide = useRef(new Animated.Value(48)).current;
  const key = `${depth}:${entry.name}:${entry.params.id ?? ''}:${entry.params.next ?? ''}:${entry.params.mode ?? ''}`;

  useEffect(() => {
    slide.setValue(48);
    Animated.timing(slide, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [key, slide]);

  return (
    <Animated.View style={[styles.drawer, { transform: [{ translateX: slide }] }]}>
      <PanelScope params={entry.params}>
        <View style={styles.drawerBody}>
          <PanelScreen entry={entry} />
        </View>
      </PanelScope>
    </Animated.View>
  );
}

function PanelScreen({ entry }: { entry: PanelEntry }) {
  switch (entry.name) {
    case 'personal-details':
      return <PersonalDetailsScreen />;
    case 'security':
      return <SecurityScreen />;
    case 'help-support':
      return <HelpSupportScreen />;
    case 'my-tickets':
      return <MyTicketsScreen />;
    case 'send-request':
      return <SendRequestScreen />;
    case 'terms':
      return <TermsScreen />;
    case 'privacy':
      return <PrivacyScreen />;
    case 'delete-account':
      return <DeleteAccountScreen />;
    case 'verify-credential':
      return <VerifyCredentialScreen />;
    case 'set-pin':
      return <SetPinScreen />;
    case 'set-password':
      return <SetPasswordScreen />;
    case 'confirm-pin':
      return <ConfirmPinScreen />;
    case 'confirm-password':
      return <ConfirmPasswordScreen />;
    case 'ticket':
      return <TicketDetailScreen />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.gray50,
    overflow: 'hidden',
    height: '100dvh' as unknown as number,
    maxHeight: '100dvh' as unknown as number,
  },
  header: {
    height: 64,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcome: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray700,
    fontFamily: 'Inter_600SemiBold',
  },
  columns: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  homeCol: {
    flex: 4,
    minWidth: 0,
    minHeight: 0,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray100,
    overflow: 'hidden',
  },
  homeIntro: {
    flex: 1.15,
    minHeight: 0,
    overflow: 'hidden',
  },
  activity: {
    flex: 1,
    minHeight: 0,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  moneyCol: {
    flex: 3,
    minWidth: 0,
    minHeight: 0,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray100,
    overflow: 'hidden',
  },
  profileCol: {
    flex: 3,
    minWidth: 0,
    minHeight: 0,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray100,
    overflow: 'hidden',
  },
  slotFill: {
    flex: 1,
    minHeight: 0,
  },
  slotHug: {
    flexGrow: 0,
    flexShrink: 0,
  },
  slotHidden: {
    display: 'none',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.gray50,
    zIndex: 2,
  },
  drawerBody: {
    flex: 1,
    minHeight: 0,
  },
});
