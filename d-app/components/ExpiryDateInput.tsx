import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

type Props = { label: string; value: string; onChange: (value: string) => void; disabled?: boolean };

export default function ExpiryDateInput({ label, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const parsed = value ? new Date(`${value}T12:00:00`) : new Date();
  return <View style={{ gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={() => setOpen(true)} style={{ minHeight: 48, padding: 12, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12 }}>
      <Text>{value || 'Select expiry date'}</Text>
    </Pressable>
    {open && !disabled && <>
      <DateTimePicker value={Number.isNaN(parsed.getTime()) ? new Date() : parsed} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(event, date) => {
        if (Platform.OS !== 'ios') setOpen(false);
        if (event.type === 'set' && date) onChange(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
      }} />
      {Platform.OS === 'ios' && <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={{ padding: 12 }}><Text>Done</Text></Pressable>}
    </>}
    {!!value && <Pressable accessibilityRole="button" disabled={disabled} onPress={() => { onChange(''); setOpen(false); }} style={{ padding: 12 }}><Text>Clear date</Text></Pressable>}
  </View>;
}
