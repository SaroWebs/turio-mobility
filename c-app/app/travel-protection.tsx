import React, { useState } from 'react';
import { Linking, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { AccountPage, Action, Copy, Panel } from '../components/AccountPage';
import api, { apiErrorMessage } from '../src/lib/api';
import { BookingUpdate, getBookingUpdates, useAccountData } from '../src/lib/account';

type Plan = { code: string; name: string; service_type: string; premium: number; coverage_amount: number; available: boolean; provider_name: string | null; provider_policy_url: string | null; terms_version: string };
type Policy = { id: number; policy_number: string; provider_name: string; status: string; start_date: string; end_date: string; coverage_amount: number };
const fetchProtection = async () => {
  const [plans, policies, bookings] = await Promise.all([api.get('/insurance/plans'), api.get('/insurance/policies'), getBookingUpdates()]);
  return { plans: plans.data.data as Plan[], policies: policies.data.data as Policy[], disclosure: plans.data.disclosure as string, bookings };
};
export default function TravelProtectionScreen() {
  const { data, error, ...state } = useAccountData(fetchProtection);
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [booking, setBooking] = useState<BookingUpdate | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [message, setMessage] = useState('');
  const purchase = async () => {
    if (!plan || !booking || !accepted || busy) return;
    setBusy(true); setSubmitError('');
    try {
      await api.post('/insurance/policies', { plan_code: plan.code, service_type: booking.kind, booking_id: booking.id, terms_accepted: true, terms_version: plan.terms_version });
      setPlan(null); setBooking(null); setAccepted(false); setMessage('Protection request created. Review its status under Your policies.');
      await state.reload();
    } catch (err) { setSubmitError(apiErrorMessage(err)); }
    finally { setBusy(false); }
  };
  return <AccountPage title="Travel protection" {...state} error={error || submitError}>
    {!!data?.disclosure && <Copy>{data.disclosure}</Copy>}
    {!!message && <Copy>{message}</Copy>}
    {data?.plans.map(item => <Panel key={item.code} title={item.name}>
      <Copy>Premium ₹{item.premium} · Coverage up to ₹{item.coverage_amount.toLocaleString('en-IN')}</Copy>
      <Copy>{item.provider_name || 'Provider not yet available'}</Copy>
      {item.provider_policy_url && <Action label="Read provider policy and exclusions" onPress={() => { void Linking.openURL(item.provider_policy_url!).catch(err => setSubmitError(apiErrorMessage(err))); }} />}
      {item.available ? <Action label="Choose booking" onPress={() => { setPlan(item); setBooking(null); setAccepted(false); setMessage(''); }} /> : <Copy>This plan is not currently available to purchase.</Copy>}
      {plan?.code === item.code && <>
        <Copy>Select the journey to protect:</Copy>
        {data.bookings.filter(entry => entry.kind === item.service_type && !['completed', 'cancelled', 'rejected'].includes(entry.status)).map(entry => <Action key={entry.key} label={`${booking?.key === entry.key ? 'Selected · ' : ''}${entry.title} (#${entry.id})`} onPress={() => setBooking(entry)} />)}
        {!data.bookings.some(entry => entry.kind === item.service_type && !['completed', 'cancelled', 'rejected'].includes(entry.status)) && <Copy>No recent eligible bookings. Book a journey first.</Copy>}
        <Copy>I have read and accept the provider policy, exclusions, and terms (version {item.terms_version}).</Copy>
        <Switch accessibilityLabel="Accept protection terms" value={accepted} onValueChange={setAccepted} disabled={busy} />
        <Action label={busy ? 'Submitting…' : `Request protection · ₹${item.premium}`} disabled={!accepted || !booking || busy} onPress={() => void purchase()} />
        <Action label="Cancel" disabled={busy} onPress={() => setPlan(null)} />
      </>}
    </Panel>)}
    <Panel title="Your policies">
      {data?.policies.length === 0 && <Copy>No policies yet.</Copy>}
      {data?.policies.map(policy => <Panel key={policy.id} title={policy.policy_number}>
        <Copy>{policy.provider_name} · {policy.status}</Copy>
        <Copy>{policy.start_date} to {policy.end_date} · Coverage ₹{policy.coverage_amount.toLocaleString('en-IN')}</Copy>
        <Action label="Get help with this policy" onPress={() => router.push({ pathname: '/help-center', params: { category: 'insurance', subject: `Policy ${policy.policy_number}` } })} />
      </Panel>)}
    </Panel>
    <Action label="Insurance and assistance support" onPress={() => router.push({ pathname: '/help-center', params: { category: 'insurance' } })} />
  </AccountPage>;
}
