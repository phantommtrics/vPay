import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DOCUMENT_TYPES } from '@/lib/kyc';
import type { DocumentType } from '@/lib/types';
import { colors, radius } from '@/constants/theme';

type DocumentTypeSelectProps = {
  value: DocumentType | null;
  onChange: (value: DocumentType) => void;
  disabled?: boolean;
};

export function DocumentTypeSelect({ value, onChange, disabled }: DocumentTypeSelectProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        Document type<Text style={styles.required}> *</Text>
      </Text>
      <View style={styles.options}>
        {DOCUMENT_TYPES.map((type) => {
          const selected = value === type.value;
          return (
            <Pressable
              key={type.value}
              style={[
                styles.option,
                selected && styles.optionSelected,
                disabled && styles.optionDisabled,
              ]}
              onPress={() => onChange(type.value)}
              disabled={disabled}>
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {type.label}
              </Text>
              {selected ? <Check size={18} color={colors.emerald600} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
    fontFamily: 'Inter_600SemiBold',
  },
  required: {
    color: colors.red500,
  },
  options: {
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionSelected: {
    borderColor: colors.emerald600,
    backgroundColor: colors.emerald50,
  },
  optionDisabled: {
    opacity: 0.6,
  },
  optionText: {
    fontSize: 15,
    color: colors.gray700,
    fontFamily: 'Inter_500Medium',
  },
  optionTextSelected: {
    color: colors.emerald800,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});
