import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/constants/theme';

const DEFAULT_DOB = new Date(2000, 0, 1);
const MIN_DOB = new Date(1920, 0, 1);

type DateOfBirthPickerProps = {
  value: string;
  onChange: (formatted: string) => void;
};

export function formatDob(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function parseDob(value: string): Date | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function DateOfBirthPicker({ value, onChange }: DateOfBirthPickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const selectedDate = useMemo(
    () => parseDob(value) ?? DEFAULT_DOB,
    [value],
  );

  const maxDate = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  }, []);

  const handleChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (date) {
      onChange(formatDob(date));
    }
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Date of birth</Text>

      <Pressable
        style={[styles.trigger, value ? styles.triggerFilled : null]}
        onPress={() => setShowPicker(true)}>
        <Calendar size={20} color={value ? colors.emerald600 : colors.gray400} />
        <Text style={[styles.triggerText, !value && styles.placeholder]}>
          {value || 'Select your date of birth'}
        </Text>
      </Pressable>

      {showPicker ? (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
            maximumDate={maxDate}
            minimumDate={MIN_DOB}
            themeVariant="light"
            textColor={colors.gray900}
          />
          {Platform.OS === 'ios' ? (
            <Pressable style={styles.doneButton} onPress={() => setShowPicker(false)}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
    fontFamily: 'Inter_600SemiBold',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  triggerFilled: {
    borderColor: colors.emerald600,
    backgroundColor: colors.emerald50,
  },
  triggerText: {
    flex: 1,
    fontSize: 16,
    color: colors.gray900,
    fontFamily: 'Inter_400Regular',
  },
  placeholder: {
    color: colors.gray400,
  },
  pickerWrap: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray100,
    overflow: 'hidden',
  },
  doneButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    backgroundColor: colors.gray50,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.emerald600,
    fontFamily: 'Inter_600SemiBold',
  },
});
