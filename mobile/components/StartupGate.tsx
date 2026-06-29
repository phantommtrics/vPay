import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { getConfigError } from '@/lib/config';

export function StartupGate({ children }: { children: React.ReactNode }) {
  const configError = getConfigError();

  if (configError) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Configuration required</Text>
        <Text style={styles.message}>{configError}</Text>
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.gray50,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.gray600,
    textAlign: 'center',
  },
});
