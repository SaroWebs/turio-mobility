import React from 'react';
import { useRouter } from 'expo-router';
import { AccountPage, Action, Copy, Panel } from '../components/AccountPage';
import { usePreferences } from '../src/store/preferences';

export default function PaymentMethodsScreen() {
  const { payment, setPayment } = usePreferences();
  const router = useRouter();
  return <AccountPage title="Payment methods">
    <Copy>Choose the default payment method for new ride bookings on this device. You can change it before booking.</Copy>
    {(['cash', 'wallet', 'upi'] as const).map(method => <Panel key={method} title={method === 'upi' ? 'UPI' : method === 'wallet' ? 'Turiya Mobility wallet' : 'Cash'}>
      <Copy>{method === 'cash' ? 'Pay the driver at the end of your ride.' : method === 'wallet' ? 'Use your available wallet balance.' : 'Complete payment using the payment link for your booking.'}</Copy>
      <Action label={payment === method ? 'Selected default' : 'Set as default'} disabled={payment === method} onPress={() => setPayment(method)} />
      {method === 'wallet' && <Action label="Open wallet" onPress={() => router.push('/wallet')} />}
    </Panel>)}
    <Copy>Card and UPI details are entered at the payment gateway during checkout. This app does not store card numbers or UPI PINs.</Copy>
  </AccountPage>;
}
