import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { CheckCircle2, ChevronRight, Clock, Send } from 'lucide-react-native';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppStackHeader } from '@/components/AppStackScreen';
import { ApiError, createSupportTicket } from '@/lib/api';
import { SUPPORT_TOPICS } from '@/lib/support-tickets';
import type { SupportKind, SupportTopicKey } from '@/lib/types';
import { colors, radius, spacing } from '@/constants/theme';

export default function SendRequestScreen() {
  const insets = useSafeAreaInsets();
  const [topic, setTopic] = useState<SupportTopicKey | null>(null);
  const [kind, setKind] = useState<SupportKind>('question');
  const [summary, setSummary] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedId, setSubmittedId] = useState('');
  const [submittedRef, setSubmittedRef] = useState('');

  const canSubmit =
    Boolean(topic) && summary.trim().length >= 3 && message.trim().length >= 10 && !submitting;

  const handleSubmit = async () => {
    if (!topic || !canSubmit) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const { ticket } = await createSupportTicket({
        topic,
        summary: summary.trim(),
        message: message.trim(),
        kind,
      });
      setSummary('');
      setMessage('');
      setTopic(null);
      setKind('question');
      setSubmittedId(ticket.id);
      setSubmittedRef(ticket.ref);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Could not send your request');
    } finally {
      setSubmitting(false);
    }
  };

  const goToTicket = useCallback(() => {
    if (!submittedId) return;
    router.replace(`/ticket/${submittedId}`);
  }, [submittedId]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + spacing.md }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppStackHeader title="Send a request" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Tell us what you need help with. We&apos;ll create a ticket and assign it to the right
          person.
        </Text>

        {submittedRef ? (
          <Pressable style={styles.successCard} onPress={goToTicket}>
            <CheckCircle2 size={20} color={colors.emerald600} />
            <View style={styles.successCopy}>
              <Text style={styles.successTitle}>Request sent</Text>
              <Text style={styles.successBody}>
                Your ticket number is {submittedRef}. Tap to view details.
              </Text>
            </View>
            <ChevronRight size={18} color={colors.emerald600} />
          </Pressable>
        ) : null}

        <Text style={styles.sectionLabel}>Topic</Text>
        <View style={styles.chips}>
          {SUPPORT_TOPICS.map((item) => {
            const selected = topic === item.key;
            return (
              <Pressable
                key={item.key}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setTopic(item.key)}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Type</Text>
        <View style={styles.kindRow}>
          <Pressable
            style={[styles.kindOption, kind === 'question' && styles.kindOptionSelected]}
            onPress={() => setKind('question')}>
            <Text style={[styles.kindText, kind === 'question' && styles.kindTextSelected]}>
              Question
            </Text>
          </Pressable>
          <Pressable
            style={[styles.kindOption, kind === 'issue' && styles.kindOptionSelected]}
            onPress={() => setKind('issue')}>
            <Text style={[styles.kindText, kind === 'issue' && styles.kindTextSelected]}>
              Problem
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Subject</Text>
        <TextInput
          style={styles.input}
          value={summary}
          onChangeText={setSummary}
          placeholder="Short summary of your request"
          placeholderTextColor={colors.gray400}
          maxLength={160}
          autoCapitalize="sentences"
        />

        <Text style={styles.sectionLabel}>Details</Text>
        <TextInput
          style={[styles.input, styles.messageInput]}
          value={message}
          onChangeText={setMessage}
          placeholder="Tell us what happened, including dates, amounts, or card last 4 if useful."
          placeholderTextColor={colors.gray400}
          maxLength={4000}
          multiline
          textAlignVertical="top"
          autoCapitalize="sentences"
        />

        {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

        <Pressable
          style={[styles.submitButton, !canSubmit && styles.submitDisabled]}
          onPress={() => void handleSubmit()}
          disabled={!canSubmit}>
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Send size={16} color={colors.white} />
              <Text style={styles.submitText}>Send request</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
    fontFamily: 'Inter_400Regular',
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.emerald50,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.emerald100,
  },
  successCopy: {
    flex: 1,
    gap: 4,
  },
  successTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.emerald900,
    fontFamily: 'Inter_700Bold',
  },
  successBody: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.emerald700,
    fontFamily: 'Inter_400Regular',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray700,
    marginTop: 4,
    fontFamily: 'Inter_600SemiBold',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  chipSelected: {
    backgroundColor: colors.emerald50,
    borderColor: colors.emerald600,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray700,
    fontFamily: 'Inter_500Medium',
  },
  chipTextSelected: {
    color: colors.emerald700,
  },
  kindRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kindOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  kindOptionSelected: {
    backgroundColor: colors.emerald50,
    borderColor: colors.emerald600,
  },
  kindText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray600,
    fontFamily: 'Inter_500Medium',
  },
  kindTextSelected: {
    color: colors.emerald700,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    fontSize: 15,
    color: colors.gray900,
    backgroundColor: colors.white,
    fontFamily: 'Inter_400Regular',
  },
  messageInput: {
    minHeight: 128,
    paddingTop: 12,
  },
  errorText: {
    fontSize: 14,
    color: colors.red500,
    fontFamily: 'Inter_400Regular',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.emerald600,
    borderRadius: radius.md,
    minHeight: 52,
    marginTop: 4,
  },
  submitDisabled: {
    opacity: 0.45,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
});
