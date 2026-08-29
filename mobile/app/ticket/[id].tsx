import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppStackHeader } from '@/components/AppStackScreen';
import { PullToRefreshScrollView } from '@/components/PullToRefreshScrollView';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { getSupportTicket } from '@/lib/api';
import {
  formatSupportTicketDate,
  formatSupportTicketDateTime,
  supportStatusLabel,
  supportTicketKindLabel,
  supportTopicLabel,
} from '@/lib/support-tickets';
import type { SupportTicketComment, SupportTicketSummary } from '@/lib/types';
import { colors, radius, spacing } from '@/constants/theme';

export default function TicketDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const ticketId = typeof params.id === 'string' ? params.id : '';
  const [ticket, setTicket] = useState<SupportTicketSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadTicket = useCallback(
    async (mode: 'focus' | 'refresh' = 'focus') => {
      if (!ticketId) {
        setError('Ticket not found');
        setLoading(false);
        return;
      }
      if (mode === 'refresh') setRefreshing(true);
      setError('');
      try {
        const data = await getSupportTicket(ticketId);
        setTicket(data.ticket);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load this ticket');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [ticketId],
  );

  useRefreshOnFocus(() => loadTicket('focus'));

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <AppStackHeader title={ticket?.ref ?? 'Ticket'} onBack={() => router.back()} />
      {loading && !ticket ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.emerald600} />
          <Text style={styles.muted}>Loading ticket…</Text>
        </View>
      ) : !ticket ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Ticket not found'}</Text>
        </View>
      ) : (
        <PullToRefreshScrollView
          refreshing={refreshing}
          onRefresh={() => loadTicket('refresh')}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.ref}>{ticket.ref}</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{supportStatusLabel(ticket.status)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <DetailRow label="Topic" value={supportTopicLabel(ticket.topic)} />
            <DetailRow label="Type" value={supportTicketKindLabel(ticket)} />
            <DetailRow label="Sent" value={formatSupportTicketDate(ticket.createdAt)} last />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Subject</Text>
            <Text style={styles.summary}>{ticket.summary}</Text>
            <Text style={[styles.sectionLabel, styles.messageLabel]}>Message</Text>
            <Text style={styles.message}>{ticket.message}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Replies</Text>
            {(ticket.comments ?? []).length === 0 ? (
              <Text style={styles.emptyComments}>
                No replies yet. When support responds, it will show up here.
              </Text>
            ) : (
              (ticket.comments ?? []).map((comment, index) => (
                <CommentBlock
                  key={comment.id}
                  comment={comment}
                  last={index === (ticket.comments?.length ?? 0) - 1}
                />
              ))
            )}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </PullToRefreshScrollView>
      )}
    </View>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function CommentBlock({
  comment,
  last,
}: {
  comment: SupportTicketComment;
  last: boolean;
}) {
  return (
    <View style={[styles.comment, !last && styles.commentBorder]}>
      <View style={styles.commentMeta}>
        <Text style={styles.commentAuthor}>{comment.authorName}</Text>
        <Text style={styles.commentDate}>{formatSupportTicketDateTime(comment.createdAt)}</Text>
      </View>
      <Text style={styles.commentBody}>{comment.body}</Text>
    </View>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
  },
  muted: {
    fontSize: 14,
    color: colors.gray500,
    fontFamily: 'Inter_400Regular',
  },
  errorText: {
    fontSize: 14,
    color: colors.red500,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  ref: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.emerald700,
    fontFamily: 'Inter_700Bold',
  },
  statusPill: {
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray700,
    fontFamily: 'Inter_600SemiBold',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray50,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.gray500,
    fontFamily: 'Inter_400Regular',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontFamily: 'Inter_600SemiBold',
  },
  summary: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginTop: 8,
    fontFamily: 'Inter_600SemiBold',
  },
  messageLabel: {
    marginTop: 16,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.gray700,
    marginTop: 8,
    fontFamily: 'Inter_400Regular',
  },
  emptyComments: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray500,
    marginTop: 10,
    fontFamily: 'Inter_400Regular',
  },
  comment: {
    marginTop: 12,
    gap: 6,
  },
  commentBorder: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray50,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  commentAuthor: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
  },
  commentDate: {
    fontSize: 12,
    color: colors.gray400,
    fontFamily: 'Inter_400Regular',
  },
  commentBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.gray700,
    fontFamily: 'Inter_400Regular',
  },
});
