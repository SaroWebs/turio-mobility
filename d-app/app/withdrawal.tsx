import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import api, { apiErrorMessage } from '../src/lib/api';
import { useTheme } from '../src/constants/theme';

type Withdrawal = { id: number; amount: string | number; status: string };
type Balance = { withdrawal_policy_configured: boolean; withdrawable_minor: number; withdrawal_reserve_minor: number | null };
const fields = [
  ['amount', 'Amount (INR)'], ['bank_account_name', 'Account holder name'],
  ['bank_account_number', 'Bank account number'], ['bank_ifsc', 'IFSC'],
] as const;
type Form = Record<typeof fields[number][0], string>;

export default function WithdrawalScreen() {
  const { colors } = useTheme();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [form, setForm] = useState<Form>({ amount: '', bank_account_name: '', bank_account_number: '', bank_ifsc: '' });
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const intent = useRef<string | null>(null);
  const busy = useRef(false);
  const load = useCallback(async () => {
    try {
      const [wallet, requests] = await Promise.all([api.get('/wallet'), api.get('/withdrawals')]);
      setBalance(wallet.data.data);
      setHistory(requests.data.data.data);
    } catch (error) {
      setBalance(null);
      setMessage(apiErrorMessage(error, 'Unable to load withdrawal details.'));
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function submit() {
    if (busy.current) return;
    if (!uncertain && (!/^\d+(\.\d{1,2})?$/.test(form.amount) || Number(form.amount) < 100
      || !balance?.withdrawal_policy_configured || Math.round(Number(form.amount) * 100) > balance.withdrawable_minor)) {
      setMessage('Enter at least ₹100 and no more than your withdrawable balance.'); return;
    }
    busy.current = true;
    setSending(true);
    intent.current ??= `withdrawal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      await api.post('/withdrawals', form, { headers: { 'Idempotency-Key': intent.current } });
      intent.current = null;
      setUncertain(false);
      setForm({ amount: '', bank_account_name: '', bank_account_number: '', bank_ifsc: '' });
      setMessage('Request submitted. Funds are held while the payout is reviewed; this is not a completed bank transfer.');
      await load();
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } }).response?.status;
      const retrySame = !status || status >= 500 || status === 409;
      setUncertain(retrySame);
      if (!retrySame) intent.current = null;
      setMessage(retrySame ? 'The result is uncertain. Retry this same request to recover its status; do not create another withdrawal.' : apiErrorMessage(error));
    } finally { busy.current = false; setSending(false); }
  }

  return <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }} style={{ backgroundColor: colors.background }} keyboardShouldPersistTaps="handled">
    <Stack.Screen options={{ title: 'Withdraw earnings' }} />
    <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>Withdraw earnings</Text>
    <Text style={{ color: colors.text }}>Available to withdraw: ₹{((balance?.withdrawable_minor ?? 0) / 100).toFixed(2)}</Text>
    <Text style={{ color: colors.text }}>{balance?.withdrawal_policy_configured ? `Required retained balance: ₹${((balance.withdrawal_reserve_minor ?? 0) / 100).toFixed(2)}` : 'Withdrawals are unavailable until the retained balance policy is configured.'}</Text>
    {fields.map(([key, label]) => <View key={key} style={{ gap: 6 }}>
      <Text style={{ color: colors.text }}>{label}</Text>
      <TextInput accessibilityLabel={label} value={form[key]} editable={!sending && !uncertain}
        keyboardType={key === 'amount' ? 'decimal-pad' : key === 'bank_account_number' ? 'number-pad' : 'default'}
        autoCapitalize={key === 'bank_ifsc' ? 'characters' : 'words'} autoCorrect={false}
        onChangeText={(value) => setForm(previous => ({ ...previous, [key]: key === 'bank_ifsc' ? value.toUpperCase() : value }))}
        style={{ minHeight: 48, borderWidth: 1, borderColor: colors.text, borderRadius: 8, padding: 12, color: colors.text }} />
    </View>)}
    <TouchableOpacity accessibilityRole="button" disabled={sending || (!uncertain && !balance?.withdrawal_policy_configured)} onPress={() => void submit()} style={{ minHeight: 48, padding: 14, backgroundColor: colors.brand, borderRadius: 8 }}>
      {sending ? <ActivityIndicator color={colors.surface} /> : <Text style={{ color: colors.surface, fontWeight: '700' }}>{uncertain ? 'Retry same request' : 'Request withdrawal'}</Text>}
    </TouchableOpacity>
    {message ? <Text accessibilityRole="alert" style={{ color: colors.text }}>{message}</Text> : null}
    <TouchableOpacity accessibilityRole="button" onPress={() => void load()}><Text style={{ color: colors.brand }}>Refresh balance and requests</Text></TouchableOpacity>
    <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Recent withdrawal requests</Text>
    {history.map(request => <Text key={request.id} style={{ color: colors.text }}>#{request.id} · ₹{Number(request.amount).toFixed(2)} · {request.status}</Text>)}
  </ScrollView>;
}
