import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useWebLayout } from '@/hooks/useWebLayout';

/** Centers the phone-sized auth and stack screens on a wide browser. */
export function DesktopPhoneFrame({ children }: { children: ReactNode }) {
  const { isDesktop } = useWebLayout();
  if (!isDesktop) return children;

  return (
    <View style={styles.canvas}>
      <View style={styles.phone}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: colors.gray50,
    alignItems: 'center',
  },
  phone: {
    flex: 1,
    width: 420,
    maxWidth: '100%',
    backgroundColor: colors.gray50,
    overflow: 'hidden',
  },
});
