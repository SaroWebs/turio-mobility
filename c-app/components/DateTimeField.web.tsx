import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { DateTimeFieldProps } from './DateTimeField.types';
import { localDateValue, parseLocalDate, withinDateBounds } from '../src/lib/dates';
import { useTheme } from '../src/constants/theme';

export default function DateTimeField({ label, value, onChange, mode = 'date', minimumDate, minimumLeadMinutes, maximumDate, clearable, clearLabel = 'Clear' }: DateTimeFieldProps) {
  const { colors, isDark } = useTheme();
  const [error, setError] = useState('');
  const [dynamicMinimum, setDynamicMinimum] = useState<Date>();
  const getMinimum = () => minimumLeadMinutes !== undefined ? new Date(Date.now() + minimumLeadMinutes * 60000) : minimumDate;
  const format = (date?: Date | null) => date ? localDateValue(date) + (mode === 'datetime' ? `T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : '') : '';
  return <View style={{ gap: 6, flexShrink: 1 }}>
    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{label}</Text>
    <input aria-label={label} type={mode === 'datetime' ? 'datetime-local' : 'date'} value={format(value)} min={format(minimumLeadMinutes !== undefined ? dynamicMinimum : minimumDate)} max={format(maximumDate)} onFocus={() => setDynamicMinimum(getMinimum())}
      onChange={event => {
        if (!event.target.value) { if (clearable) onChange(null); return; }
        const selected = mode === 'date' ? parseLocalDate(event.target.value) : new Date(event.target.value);
        if (!selected || !withinDateBounds(selected, mode, getMinimum(), maximumDate)) { setError('Choose a date and time within the allowed range.'); return; }
        setError(''); onChange(selected);
      }}
      style={{ colorScheme: isDark ? 'dark' : 'light', boxSizing: 'border-box', minWidth: 0, width: '100%', minHeight: 48, padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, color: colors.text, backgroundColor: colors.surface, fontFamily: 'inherit', fontSize: 14 }} />
    {clearable && value && <Pressable accessibilityRole="button" onPress={() => { onChange(null); setError(''); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.brand }}>{clearLabel}</Text></Pressable>}
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text>}
  </View>;
}
