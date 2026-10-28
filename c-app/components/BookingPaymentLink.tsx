import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import api from '../src/lib/api';
import { useTheme } from '../src/constants/theme';

type PaymentStatus = { can_pay: boolean; checkout_state: string; status_message: string; checkout_url: string | null; tour_payment?: { total_minor: number; online_paid_minor: number; remaining_cash_minor: number; refunded_minor: number; refund_pending_minor: number } | null };

export default function BookingPaymentLink({ kind, id }: { kind: 'ride' | 'tour' | 'rental'; id: string }) {
  const { colors } = useTheme();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [connected, setConnected] = useState(true);
  const generation = useRef(0);
  const sequence = useRef(0);
  const opening = useRef(false);
  const refresh = useCallback(async () => {
    const version = generation.current;
    const request = ++sequence.current;
    try {
      const result = await api.get(`/booking-payments/${kind}/${id}`);
      if (version !== generation.current || request !== sequence.current) return;
      setStatus(result.data.data);
      setConnected(true);
    } catch {
      if (version === generation.current && request === sequence.current) setConnected(false);
    }
  }, [kind, id]);

  useEffect(() => {
    generation.current += 1;
    const initial = setTimeout(() => { void refresh(); }, 0);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 10000);
    return () => { generation.current += 1; listener.remove(); clearTimeout(initial); clearInterval(timer); };
  }, [refresh]);

  const open = async () => {
    if (opening.current || !connected || !status?.can_pay || !status.checkout_url?.startsWith('https://')) return;
    const version = generation.current;
    opening.current = true;
    setBusy(true);
    setMessage('');
    try {
      // The website authenticates the customer; no API token or personal data is put in this URL.
      await WebBrowser.openBrowserAsync(status.checkout_url);
      if (version === generation.current) await refresh();
    } catch {
      if (version === generation.current) setMessage('Could not refresh checkout. If you paid, do not pay again; refresh payment status.');
    } finally {
      opening.current = false;
      if (version === generation.current) setBusy(false);
    }
  };

  if (!status || status.checkout_state === 'unavailable') return null;
  return <View style={{ gap: 8, paddingVertical: 12 }}>
    <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>{status.status_message}</Text>
    {status.tour_payment && <Text style={{ color: colors.text }}>Tour total: ₹{(status.tour_payment.total_minor / 100).toFixed(2)}{'\n'}Online paid: ₹{(status.tour_payment.online_paid_minor / 100).toFixed(2)}{'\n'}Cash due at tour start: ₹{(status.tour_payment.remaining_cash_minor / 100).toFixed(2)}{'\n'}Refunded: ₹{(status.tour_payment.refunded_minor / 100).toFixed(2)}{'\n'}Refund pending: ₹{(status.tour_payment.refund_pending_minor / 100).toFixed(2)}</Text>}
    {status.can_pay && status.checkout_url?.startsWith('https://') && <>
      <Text style={{ color: colors.textSecondary }}>Secure checkout opens in your browser. Sign in with the same customer account.</Text>
      <Pressable accessibilityRole="button" disabled={busy || !connected} onPress={() => void open()} style={{ padding: 14, borderRadius: 12, backgroundColor: colors.brand, opacity: busy || !connected ? 0.6 : 1 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>{busy ? 'Opening checkout...' : 'Pay online'}</Text>
      </Pressable>
    </>}
    {!connected && <Text style={{ color: colors.textSecondary }}>Payment status could not be refreshed. Check it before paying again.</Text>}
    <Pressable accessibilityRole="button" onPress={() => void refresh()} style={{ paddingVertical: 12 }}>
      <Text style={{ color: colors.brand }}>Refresh payment status</Text>
    </Pressable>
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>{message}</Text> : null}
  </View>;
}
