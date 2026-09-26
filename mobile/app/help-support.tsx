import { useCallback, useState } from 'react';
import { pushRoute } from '@/lib/consumer-nav';
import { ChevronRight, MessageCircle, Send, Ticket } from 'lucide-react-native';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppStackHeader } from '@/components/AppStackScreen';
import { colors, radius, spacing } from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { ApiError, createWhatsappSession, getWhatsappSupport } from '@/lib/api';
import type { SupportWhatsappConfig } from '@/lib/types';

function waMeUrl(supportE164: string, prefill: string): string {
  const digits = supportE164.replace(/[^\d]/g, '');
  const text = encodeURIComponent(prefill);
  return `https://wa.me/${digits}?text=${text}`;
}

export default function HelpSupportScreen() {
  const insets = useSafeAreaInsets();
  const [whatsapp, setWhatsapp] = useState<SupportWhatsappConfig | null>(null);
  const [opening, setOpening] = useState(false);

  const loadWhatsapp = useCallback(async () => {
    try {
      const data = await getWhatsappSupport();
      setWhatsapp(data.whatsapp);
    } catch {
      setWhatsapp({ enabled: false, unavailableReason: 'not_configured' });
    }
  }, []);

  useRefreshOnFocus(loadWhatsapp);

  const showWhatsappCard =
    whatsapp != null && whatsapp.unavailableReason !== 'not_configured';

  const openWhatsapp = async () => {
    if (opening) return;
    if (whatsapp?.unavailableReason === 'no_phone') {
      Alert.alert(
        'Add your phone',
        'Chat on WhatsApp is only available from the number on your vPay wallet. Add your phone in Profile first.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Add phone', onPress: () => pushRoute('/personal-details') },
        ],
      );
      return;
    }
    if (!whatsapp?.enabled) return;

    setOpening(true);
    try {
      const { whatsapp: session } = await createWhatsappSession();
      const supportE164 = session.supportE164;
      const prefill = session.prefill;
      const masked = session.walletPhoneMasked;
      if (!supportE164 || !prefill || !masked) {
        throw new Error('WhatsApp support is not available yet.');
      }

      Alert.alert(
        'Use your vPay WhatsApp',
        `Open WhatsApp logged into ${masked}. We only chat with that wallet number.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open WhatsApp',
            onPress: () => {
              void Linking.openURL(waMeUrl(supportE164, prefill)).catch(() => {
                Alert.alert(
                  'WhatsApp not available',
                  `Install WhatsApp on ${masked} and try again.`,
                );
              });
            },
          },
        ],
      );
    } catch (err) {
      Alert.alert(
        'Could not open WhatsApp',
        err instanceof ApiError ? err.message : 'Try again shortly.',
      );
    } finally {
      setOpening(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <AppStackHeader title="Help & Support" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Chat on WhatsApp from your vPay number, track existing requests, or send a new one.
        </Text>

        {showWhatsappCard ? (
          <HubCard
            icon={MessageCircle}
            iconBg={colors.teal100}
            iconColor={colors.teal600}
            title="Chat on WhatsApp"
            subtitle={
              whatsapp.unavailableReason === 'no_phone'
                ? 'Add your phone in Profile'
                : whatsapp.walletPhoneMasked
                  ? `Chat from ${whatsapp.walletPhoneMasked}`
                  : 'Chat from your vPay WhatsApp number'
            }
            disabled={whatsapp.unavailableReason === 'no_phone'}
            loading={opening}
            onPress={() => void openWhatsapp()}
          />
        ) : null}

        <HubCard
          icon={Ticket}
          iconBg={colors.purple50}
          iconColor={colors.purple600}
          title="Your tickets"
          subtitle="View status and details of requests you have sent"
          onPress={() => pushRoute('/my-tickets')}
        />
        <HubCard
          icon={Send}
          iconBg={colors.emerald50}
          iconColor={colors.emerald600}
          title="Send a request"
          subtitle="Ask a question or report a problem"
          onPress={() => pushRoute('/send-request')}
        />
      </ScrollView>
    </View>
  );
}

function HubCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  onPress,
  disabled,
  loading,
}: {
  icon: typeof Ticket;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      style={[styles.card, disabled ? styles.cardDisabled : null]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(loading) }}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <Icon size={20} color={iconColor} />
        )}
      </View>
      <View style={styles.cardCopy}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight size={20} color={colors.gray400} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.gray50,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray600,
    marginBottom: 4,
    fontFamily: 'Inter_400Regular',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  cardDisabled: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray500,
    fontFamily: 'Inter_400Regular',
  },
});
