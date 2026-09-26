import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { colors, radius, spacing } from '@/constants/theme';
import {
  androidPromptDismissed,
  androidStoreUrl,
  dismissAndroidPrompt,
  isAndroidBrowser,
} from '@/lib/android-web-prompt';

export function AndroidWebPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isAndroidBrowser() || androidPromptDismissed()) return;
    setVisible(true);
  }, []);

  const dismiss = () => {
    dismissAndroidPrompt();
    setVisible(false);
  };

  if (Platform.OS !== 'web') return null;

  return (
    <BottomSheet visible={visible} onClose={dismiss}>
      <Text style={styles.title}>vPay is on the Play Store</Text>
      <Text style={styles.body}>
        The Android app is available. Install it from the Play Store, or keep using vPay in this
        browser.
      </Text>
      <Pressable
        onPress={() => void Linking.openURL(androidStoreUrl())}
        accessibilityRole="link"
        style={styles.storeLink}>
        <Text style={styles.storeLinkText}>Open Play Store</Text>
      </Pressable>
      <View style={styles.actions}>
        <Pressable style={styles.ignoreButton} onPress={dismiss} accessibilityRole="button">
          <Text style={styles.ignoreText}>Ignore</Text>
        </Pressable>
        <Pressable style={styles.webButton} onPress={dismiss} accessibilityRole="button">
          <Text style={styles.webText}>Use the web</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  body: {
    marginTop: spacing.sm,
    fontSize: 15,
    lineHeight: 22,
    color: colors.gray600,
    fontFamily: 'Inter_400Regular',
  },
  storeLink: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
  },
  storeLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.emerald600,
    fontFamily: 'Inter_600SemiBold',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  ignoreButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    paddingVertical: 14,
  },
  ignoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray700,
    fontFamily: 'Inter_600SemiBold',
  },
  webButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.emerald600,
    paddingVertical: 14,
  },
  webText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
    fontFamily: 'Inter_700Bold',
  },
});
