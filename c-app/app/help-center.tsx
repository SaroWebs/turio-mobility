import React, { useState } from 'react';
import { TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AccountPage, Action, Copy, Panel, accountStyles } from '../components/AccountPage';
import api, { apiErrorMessage } from '../src/lib/api';
import { useAccountData } from '../src/lib/account';
import { useTheme } from '../src/constants/theme';

type Ticket = { id: number; subject: string; status: string; ticket_number: string; messages: { id: number; body: string; created_at: string }[] };
const fetchTickets = async () => (await api.get('/support/tickets')).data.data as Ticket[];
export default function HelpCenterScreen() {
  const params = useLocalSearchParams<{ category?: string; subject?: string }>();
  const { colors } = useTheme();
  const { data, error, ...state } = useAccountData(fetchTickets);
  const [subject, setSubject] = useState(params.subject || '');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [submitError, setSubmitError] = useState('');
  const inputStyle = [accountStyles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }];
  const send = async (ticket?: Ticket) => {
    if (busy) return;
    setSubmitError(''); setFeedback(''); setBusy(true);
    try {
      if (ticket) {
        await api.post(`/support/tickets/${ticket.id}/messages`, { message: reply[ticket.id]?.trim() });
        setReply(previous => ({ ...previous, [ticket.id]: '' }));
        setFeedback('Reply sent.');
      } else {
        const category = ['general', 'account', 'payment', 'insurance', 'safety', 'accessibility', 'feedback', 'booking'].includes(params.category || '') ? params.category : 'general';
        await api.post('/support/tickets', { subject: subject.trim(), message: message.trim(), category });
        setSubject(''); setMessage(''); setFeedback('Support request sent. You can follow the conversation below.');
      }
      await state.reload();
    } catch (err) { setSubmitError(apiErrorMessage(err, 'Could not send your message.')); }
    finally { setBusy(false); }
  };
  return <AccountPage title="Help and support" {...state} error={error || submitError}>
    <Panel title="Contact support">
      <Copy>Tell us what happened. Include the booking number if your request concerns a journey.</Copy>
      <TextInput accessibilityLabel="Subject" placeholder="Subject" placeholderTextColor={colors.textMuted} style={inputStyle} value={subject} onChangeText={setSubject} maxLength={160} />
      <TextInput accessibilityLabel="Message" placeholder="How can we help?" placeholderTextColor={colors.textMuted} style={[...inputStyle, { minHeight: 100, textAlignVertical: 'top' }]} multiline value={message} onChangeText={setMessage} maxLength={4000} />
      <Action label={busy ? 'Sending…' : 'Send support request'} disabled={busy || !subject.trim() || !message.trim()} onPress={() => void send()} />
      {!!feedback && <Copy>{feedback}</Copy>}
    </Panel>
    {data?.length === 0 && <Copy>No support requests yet.</Copy>}
    {data?.map(ticket => <Panel key={ticket.id} title={ticket.subject}>
      <Copy>{ticket.ticket_number} · {ticket.status.replaceAll('_', ' ')}</Copy>
      <Action label={selected === ticket.id ? 'Hide conversation' : 'View conversation'} onPress={() => setSelected(selected === ticket.id ? null : ticket.id)} />
      {selected === ticket.id && <>
        {ticket.messages.map(item => <Panel key={item.id} title={new Date(item.created_at).toLocaleString()}><Copy>{item.body}</Copy></Panel>)}
        {!['resolved', 'closed'].includes(ticket.status) && <>
          <TextInput accessibilityLabel="Reply" placeholder="Write a reply" placeholderTextColor={colors.textMuted} style={inputStyle} multiline value={reply[ticket.id] || ''} onChangeText={value => setReply(previous => ({ ...previous, [ticket.id]: value }))} maxLength={4000} />
          <Action label="Send reply" disabled={busy || !reply[ticket.id]?.trim()} onPress={() => void send(ticket)} />
        </>}
      </>}
    </Panel>)}
  </AccountPage>;
}
