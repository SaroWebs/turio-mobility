import api from './api';
import SecureStore from './secure-store';

/** Preserve the original key and body after an uncertain response or restart. */
export async function postBooking(path: string, body: Record<string, unknown>) {
  const slot = `attempt_${path.replace(/[^a-z0-9]/gi, '_')}`;
  const fingerprint = JSON.stringify(body.request_mode === 'immediate' ? { ...body, scheduled_at: undefined } : body);
  const saved = await SecureStore.getItemAsync(slot);
  let attempt = saved ? JSON.parse(saved) : null;
  if (!attempt || attempt.fingerprint !== fingerprint) {
    attempt = { fingerprint, body, key: `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}` };
    await SecureStore.setItemAsync(slot, JSON.stringify(attempt));
  }
  try {
    const result = await api.post(path, attempt.body, { headers: { 'Idempotency-Key': attempt.key, 'X-Booking-Contract': '2' } });
    await SecureStore.deleteItemAsync(slot);
    return result;
  } catch (error: any) {
    if (error.response?.status >= 400 && error.response.status < 500 && ![408, 409, 429].includes(error.response.status)) await SecureStore.deleteItemAsync(slot);
    throw error;
  }
}
