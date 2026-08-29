import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatSupportTicketDate,
  supportStatusLabel,
  supportTicketKindLabel,
} from '@/lib/support-tickets';
import type { SupportTicketSummary } from '@/lib/types';
import { colors, radius } from '@/constants/theme';

export function SupportTicketRow({
  ticket,
  onPress,
}: {
  ticket: SupportTicketSummary;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={styles.ticketCard}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Ticket ${ticket.ref}`}>
      <View style={styles.ticketTop}>
        <Text style={styles.ticketRef}>{ticket.ref}</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{supportStatusLabel(ticket.status)}</Text>
        </View>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.ticketSummary}>{ticket.summary}</Text>
        {onPress ? <ChevronRight size={18} color={colors.gray400} /> : null}
      </View>
      <Text style={styles.ticketMeta}>
        {formatSupportTicketDate(ticket.createdAt)} · {supportTicketKindLabel(ticket)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ticketCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.gray100,
    gap: 6,
  },
  ticketTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  ticketRef: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.emerald700,
    fontFamily: 'Inter_700Bold',
  },
  statusPill: {
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray700,
    fontFamily: 'Inter_600SemiBold',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ticketSummary: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.gray900,
    fontFamily: 'Inter_500Medium',
  },
  ticketMeta: {
    fontSize: 12,
    color: colors.gray500,
    fontFamily: 'Inter_400Regular',
  },
});
