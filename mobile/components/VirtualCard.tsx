import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { CardBrandMark } from '@/components/CardBrandMark';
import { CardRevealWebView } from '@/components/CardRevealWebView';
import { colors, radius } from '@/constants/theme';
import { formatCardBalance, formatMaskedCardBalance } from '@/lib/currency';
import type { VirtualCardSummary } from '@/lib/types';

type VirtualCardProps = {
  card: VirtualCardSummary;
  stripePublishableKey: string | null;
  stripeConnectedAccountId: string | null;
  style?: ViewStyle;
};

function formatExpiry(expMonth: number, expYear: number): string {
  const month = String(expMonth).padStart(2, '0');
  const year = String(expYear).slice(-2);
  return `${month}/${year}`;
}

export function VirtualCard({
  card,
  stripePublishableKey,
  stripeConnectedAccountId,
  style,
}: VirtualCardProps) {
  const [revealed, setRevealed] = useState(false);

  const isFrozen = card.status === 'inactive';
  const maskedNumber = `•••• •••• •••• ${card.last4}`;
  const expiry = formatExpiry(card.expMonth, card.expYear);

  return (
    <View style={[styles.wrapper, style]}>
      <LinearGradient
        colors={
          isFrozen
            ? [colors.gray500, colors.gray600, colors.gray700]
            : [colors.emerald950, colors.emerald800, colors.teal900]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}>
        <View style={styles.circleTop} />
        <View style={styles.circleBottom} />

        {isFrozen && (
          <View style={styles.frozenOverlay}>
            <View style={styles.frozenBadge}>
              <Text style={styles.frozenText}>Card Frozen</Text>
            </View>
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.topRow}>
            <View>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <Text style={styles.balanceValue}>
                {revealed
                  ? formatCardBalance(card.balance, card.currency)
                  : formatMaskedCardBalance(card.currency)}
              </Text>
            </View>
            <CardBrandMark brand={card.brand} size={32} />
          </View>

          <View style={styles.bottomSection}>
            {!revealed ? (
              <>
                <View style={styles.numberRow}>
                  <Text style={styles.cardNumber}>{maskedNumber}</Text>
                  <Pressable
                    onPress={() => setRevealed(true)}
                    style={styles.iconButton}
                    hitSlop={8}
                    disabled={!stripePublishableKey}>
                    <Eye size={18} color={colors.white} />
                  </Pressable>
                </View>

                <View style={styles.detailsRow}>
                  <View style={styles.detailGroup}>
                    <View>
                      <Text style={styles.detailLabel}>Valid Thru</Text>
                      <Text style={styles.detailValue}>{expiry}</Text>
                    </View>
                    <View>
                      <Text style={styles.detailLabel}>CVV</Text>
                      <Text style={styles.detailValue}>•••</Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.revealSection}>
                <View style={styles.revealWebview}>
                  <CardRevealWebView
                    active={revealed}
                    card={card}
                    publishableKey={stripePublishableKey}
                    stripeConnectedAccountId={stripeConnectedAccountId}
                  />
                </View>

                <View style={styles.revealValidThru} pointerEvents="none">
                  <Text style={styles.detailLabel}>Valid Thru</Text>
                  <Text style={styles.detailValue}>{expiry}</Text>
                </View>

                <Pressable
                  onPress={() => setRevealed(false)}
                  style={styles.revealEyeButton}
                  hitSlop={8}>
                  <EyeOff size={18} color={colors.white} />
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    aspectRatio: 1.586,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  card: {
    flex: 1,
    padding: 24,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  circleTop: {
    position: 'absolute',
    top: -96,
    right: -96,
    width: 256,
    height: 256,
    borderRadius: 128,
    borderWidth: 40,
    borderColor: 'rgba(255,255,255,0.1)',
    opacity: 0.2,
  },
  circleBottom: {
    position: 'absolute',
    bottom: -96,
    left: -96,
    width: 256,
    height: 256,
    borderRadius: 128,
    borderWidth: 40,
    borderColor: 'rgba(255,255,255,0.1)',
    opacity: 0.2,
  },
  frozenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  frozenBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  frozenText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  balanceLabel: {
    color: 'rgba(167,243,208,0.8)',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  balanceValue: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '700',
  },
  bottomSection: {
    gap: 12,
    overflow: 'visible',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  cardNumber: {
    color: colors.white,
    fontSize: 17,
    fontFamily: 'SpaceMono',
    letterSpacing: 2,
    flex: 1,
  },
  iconButton: {
    padding: 8,
    borderRadius: radius.full,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  detailGroup: {
    flexDirection: 'row',
    gap: 24,
  },
  detailLabel: {
    color: 'rgba(167,243,208,0.8)',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  detailValue: {
    color: colors.white,
    fontSize: 14,
    fontFamily: 'SpaceMono',
  },
  revealSection: {
    minHeight: 76,
    position: 'relative',
    overflow: 'visible',
  },
  revealWebview: {
    height: 76,
    paddingRight: 36,
    overflow: 'visible',
  },
  revealValidThru: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    zIndex: 2,
  },
  revealEyeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 8,
    borderRadius: radius.full,
    zIndex: 3,
  },
});
