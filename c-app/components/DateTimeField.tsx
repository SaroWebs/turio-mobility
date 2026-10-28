import React, { useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Platform, Pressable, Text, TurboModuleRegistry, View } from 'react-native';
import { Calendar } from 'lucide-react-native';
import type { DateTimeFieldProps } from './DateTimeField.types';
import type { IOSNativeProps } from '@react-native-community/datetimepicker';
import { useTheme } from '../src/constants/theme';
import { withinDateBounds } from '../src/lib/dates';

export default function DateTimeField({ label, value, onChange, mode = 'date', minimumDate, minimumLeadMinutes, maximumDate, placeholder = 'Select date', clearable = false, clearLabel = 'Clear' }: DateTimeFieldProps) {
  const { colors, isDark } = useTheme();
  const [Picker, setPicker] = useState<React.ComponentType<IOSNativeProps> | null>(null);
  const [draft, setDraft] = useState(new Date());
  const [visible, setVisible] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const [pickerMinimum, setPickerMinimum] = useState(minimumDate);
  const getMinimum = () => minimumLeadMinutes !== undefined
    ? new Date(Date.now() + minimumLeadMinutes * 60000) : minimumDate;
  const commit = (date: Date) => {
    if (!withinDateBounds(date, mode, getMinimum(), maximumDate)) {
      setError('Choose a date and time within the allowed range.');
      return;
    }
    setError(''); onChange(date); setVisible(false);
  };
  const open = async () => {
    if (opening) return;
    setOpening(true); setError('');
    try {
      Keyboard.dismiss();
      if (Platform.OS === 'android' && ['RNCDatePicker', 'RNCTimePicker', 'RNCMaterialDatePicker', 'RNCMaterialTimePicker'].some(name => !TurboModuleRegistry.get(name))) {
        throw new Error('Native date picker is missing');
      }
      const picker = await import('@react-native-community/datetimepicker');
      const minimum = getMinimum();
      setPickerMinimum(minimum);
      let initial = value || new Date();
      if (minimum && initial < minimum) initial = new Date(Math.ceil(minimum.getTime() / 60000) * 60000);
      if (maximumDate && initial > maximumDate) initial = maximumDate;
      if (Platform.OS === 'android') {
        picker.DateTimePickerAndroid.open({ value: initial, mode: 'date', minimumDate: minimum, maximumDate,
          onChange: (event, date) => {
            if (event.type !== 'set' || !date) return;
            if (mode === 'date') { commit(date); return; }
            picker.DateTimePickerAndroid.open({ value: date, mode: 'time',
              onChange: (timeEvent, time) => {
                if (timeEvent.type !== 'set' || !time) return;
                const selected = new Date(date);
                selected.setHours(time.getHours(), time.getMinutes(), 0, 0);
                commit(selected);
              },
            });
          },
        });
      } else {
        setDraft(initial); setPicker(() => picker.default as React.ComponentType<IOSNativeProps>); setVisible(true);
      }
    } catch {
      setError('The date picker is unavailable in this app build. Please update the app.');
    } finally { setOpening(false); }
  };
  return <View style={{ gap: 6, flexShrink: 1 }}>
    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={opening} onPress={() => void open()} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface }}>
      {opening ? <ActivityIndicator color={colors.brand} /> : <Calendar size={18} color={colors.brand} />}
      <Text style={{ color: colors.text, flexShrink: 1 }}>{value ? (mode === 'datetime' ? value.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : value.toLocaleDateString()) : placeholder}</Text>
    </Pressable>
    {clearable && value && <Pressable accessibilityRole="button" accessibilityLabel={`${clearLabel}: ${label}`} onPress={() => { onChange(null); setError(''); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.brand }}>{clearLabel}</Text></Pressable>}
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text>}
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, padding: 20, paddingBottom: 36, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
          {Picker && <Picker value={draft} mode={mode} display="spinner" minimumDate={pickerMinimum} maximumDate={maximumDate} themeVariant={isDark ? 'dark' : 'light'} onChange={(_, date) => { if (date) setDraft(date); }} />}
          {!!error && <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text>}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Pressable accessibilityRole="button" onPress={() => setVisible(false)} style={{ padding: 12 }}><Text style={{ color: colors.textSecondary }}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => commit(draft)} style={{ padding: 12 }}><Text style={{ color: colors.brand, fontWeight: '700' }}>Done</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}
