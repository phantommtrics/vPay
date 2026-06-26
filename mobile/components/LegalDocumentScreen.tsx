import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LegalDocument } from '@/lib/legal-content';
import { colors, radius, spacing } from '@/constants/theme';

type LegalDocumentScreenProps = {
  document: LegalDocument;
};

export function LegalDocumentScreen({ document }: LegalDocumentScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityRole="button">
          <ArrowLeft size={22} color={colors.gray900} />
        </Pressable>
        <Text style={styles.screenTitle} numberOfLines={1}>
          {document.title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Last updated: {document.lastUpdated}</Text>
        <Text style={styles.intro}>{document.intro}</Text>

        {document.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.paragraphs.map((paragraph, index) => (
              <Text key={`${section.title}-${index}`} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
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
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  lastUpdated: {
    fontSize: 12,
    color: colors.gray400,
    fontFamily: 'Inter_500Medium',
  },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.gray700,
    fontFamily: 'Inter_400Regular',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gray100,
    padding: spacing.lg,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gray100,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.gray600,
    fontFamily: 'Inter_400Regular',
  },
});
