import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, Copy, Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { colors, radius } from '@/constants/theme';

type VirtualCardProps = {
  balance: number;
  cardNumber: string;
  expiry: string;
  cvv: string;
  isFrozen?: boolean;
  style?: ViewStyle;
};

export function VirtualCard({
  balance,
  cardNumber,
  expiry,
  cvv,
  isFrozen = false,
  style,
}: VirtualCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(cardNumber.replace(/\s/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maskedNumber = `•••• •••• •••• ${cardNumber.slice(-4)}`;

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
              <Text style={styles.balanceValue}>${balance.toFixed(2)}</Text>
            </View>
            <View style={styles.cardLogos}>
              <View style={[styles.logoCircle, styles.logoRed]} />
              <View style={[styles.logoCircle, styles.logoYellow]} />
            </View>
          </View>

          <View style={styles.bottomSection}>
            <View style={styles.numberRow}>
              <Text style={styles.cardNumber}>
                {showDetails ? cardNumber : maskedNumber}
              </Text>
              <Pressable
                onPress={() => setShowDetails(!showDetails)}
                style={styles.iconButton}
                hitSlop={8}>
                {showDetails ? (
                  <EyeOff size={18} color={colors.white} />
                ) : (
                  <Eye size={18} color={colors.white} />
                )}
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
                  <Text style={styles.detailValue}>
                    {showDetails ? cvv : '•••'}
                  </Text>
                </View>
              </View>

              <Pressable onPress={handleCopy} style={styles.copyButton}>
                {copied ? (
                  <CheckCircle2 size={14} color="#4ade80" />
                ) : (
                  <Copy size={14} color={colors.white} />
                )}
                <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
              </Pressable>
            </View>
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
    overflow: 'hidden',
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
  cardLogos: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  logoRed: {
    backgroundColor: 'rgba(239,68,68,0.8)',
  },
  logoYellow: {
    backgroundColor: 'rgba(234,179,8,0.8)',
    marginLeft: -16,
  },
  bottomSection: {
    gap: 16,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardNumber: {
    color: colors.white,
    fontSize: 17,
    fontFamily: 'SpaceMono',
    letterSpacing: 2,
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
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  copyText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
  },
});
