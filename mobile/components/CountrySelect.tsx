import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { COUNTRIES, type CountryCode } from '@/lib/countries';
import { colors, radius } from '@/constants/theme';

type CountrySelectProps = {
  value: CountryCode | null;
  onChange: (code: CountryCode, name: string) => void;
};

export function CountrySelect({ value, onChange }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const selected = COUNTRIES.find((country) => country.code === value) ?? COUNTRIES[0];

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Country</Text>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={styles.triggerText}>{selected.name}</Text>
        <ChevronDown size={18} color={colors.gray500} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select country</Text>
            <ScrollView>
              {COUNTRIES.map((country) => {
                const active = country.code === selected.code;
                return (
                  <Pressable
                    key={country.code}
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => {
                      onChange(country.code, country.name);
                      setOpen(false);
                    }}>
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {country.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
    fontFamily: 'Inter_600SemiBold',
  },
  trigger: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerText: {
    fontSize: 16,
    color: colors.gray900,
    fontFamily: 'Inter_400Regular',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '60%',
    padding: 20,
    gap: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  option: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  optionActive: {
    backgroundColor: colors.emerald50,
  },
  optionText: {
    fontSize: 16,
    color: colors.gray900,
    fontFamily: 'Inter_400Regular',
  },
  optionTextActive: {
    color: colors.emerald700,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});
