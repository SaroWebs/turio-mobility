import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronDown, X } from 'lucide-react-native';

export default function VehicleSelect({ label, value, options, onChange, disabled = false }: {
  label: string; value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const choices = [...new Set(options)].filter((option) => option.toLowerCase().includes(query.toLowerCase()));
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value || 'Choose'}`} accessibilityState={{ disabled, expanded: open }} disabled={disabled} onPress={() => { setQuery(''); setOpen(true); }} style={[styles.input, disabled && styles.disabled]}>
      <Text style={styles.value}>{value || `Choose ${label.toLowerCase()}`}</Text><ChevronDown size={18} color="#475569" />
    </Pressable>
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.header}><Text style={styles.heading}>Choose {label.toLowerCase()}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close selection" onPress={() => setOpen(false)} style={styles.close}><X size={24} color="#334155" /></Pressable></View>
        <TextInput accessibilityLabel={`Search ${label.toLowerCase()}`} placeholder="Search options" value={query} onChangeText={setQuery} style={styles.search} autoCorrect={false} />
        <FlatList keyboardShouldPersistTaps="handled" data={choices} keyExtractor={(item) => item} ListEmptyComponent={<Text style={styles.empty}>No matching options. Try another search.</Text>} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityState={{ selected: value === item }} onPress={() => { onChange(item); setOpen(false); }} style={styles.option}><Text style={styles.value}>{item}</Text>{value === item && <Check size={22} color="#0f766e" />}</Pressable>} />
      </SafeAreaView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 }, label: { marginBottom: 7, fontSize: 14, fontWeight: '700', color: '#475569' },
  input: { minHeight: 50, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc', flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { flex: 1, fontSize: 16, color: '#0f172a' }, disabled: { opacity: 0.5 }, modal: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heading: { fontSize: 22, fontWeight: '700', color: '#0f172a' }, close: { padding: 12 },
  search: { minHeight: 50, marginVertical: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#94a3b8', fontSize: 16 },
  option: { minHeight: 56, padding: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center' }, empty: { padding: 20, color: '#475569' },
});
