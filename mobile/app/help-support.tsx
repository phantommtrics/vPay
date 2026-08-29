import { router } from 'expo-router';
import { ChevronRight, Send, Ticket } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppStackHeader } from '@/components/AppStackScreen';
import { colors, radius, spacing } from '@/constants/theme';

export default function HelpSupportScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <AppStackHeader title="Help & Support" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Track existing requests or send a new one. We assign each ticket to the right person.
        </Text>

        <HubCard
          icon={Ticket}
          iconBg={colors.purple50}
          iconColor={colors.purple600}
          title="Your tickets"
          subtitle="View status and details of requests you have sent"
          onPress={() => router.push('/my-tickets')}
        />
        <HubCard
          icon={Send}
          iconBg={colors.emerald50}
          iconColor={colors.emerald600}
          title="Send a request"
          subtitle="Ask a question or report a problem"
          onPress={() => router.push('/send-request')}
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
}: {
  icon: typeof Ticket;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Icon size={20} color={iconColor} />
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
    backgroundColor: colors.gray50,
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
