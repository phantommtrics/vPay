import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/constants/theme';

export function AppStackHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <View style={styles.topBar}>
      <Pressable style={styles.backButton} onPress={onBack ?? (() => router.back())}>
        <ArrowLeft size={22} color={colors.gray900} />
      </Pressable>
      <Text style={styles.screenTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

export function AppStackScreen({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + spacing.md }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppStackHeader title={title} onBack={onBack} />
      <View style={[styles.body, { paddingBottom: insets.bottom + spacing.xl }]}>{children}</View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  headerSpacer: {
    width: 40,
  },
  screenTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
});
