import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, CheckCircle2, Clock3, FileCheck2, ShieldAlert } from 'lucide-react-native';
import api, { apiErrorMessage } from '../src/lib/api';
import VerificationInbox from '../components/VerificationInbox';
import ExpiryDateInput from '../components/ExpiryDateInput';

type DocumentStatus = 'missing' | 'pending' | 'approved' | 'rejected' | 'expired' | 'under_review' | 'manual_verification_pending' | 'manually_verified' | 'api_verified' | 'inconclusive' | 'correction_required' | 'flagged' | 'suspended';
type Requirement = {
  type: string;
  label: string;
  number_label: string;
  required: boolean;
  has_expiry: boolean;
  status: DocumentStatus;
  rejection_reason: string | null;
  expires_at: string | null;
  remaining_attempts: number;
  can_submit: boolean;
  document_id: number | null;
};
type Verification = {
  status: 'complete' | 'in_review' | 'action_required';
  approved_count: number;
  required_count: number;
  next_document: string | null;
  message: string;
  requirements: Requirement[];
};
type DocumentRecord = { type: string; document_number: string | null; expires_at: string | null };
type Draft = { number: string; expiry: string; file?: DocumentPicker.DocumentPickerAsset };
const statusLabels: Record<DocumentStatus, string> = {
  missing: 'Not added', pending: 'In review', approved: 'Approved', rejected: 'Needs correction', expired: 'Expired',
  under_review: 'Under review', manual_verification_pending: 'External check pending', manually_verified: 'Evidence checked · awaiting approval', api_verified: 'API checked · awaiting approval', inconclusive: 'Additional evidence needed', correction_required: 'Correction required', flagged: 'Escalated for review', suspended: 'Suspended',
};

export default function DocumentsScreen() {
  const router = useRouter();
  const [verification, setVerification] = useState<Verification | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [consent, setConsent] = useState(false);
  const [appealReason, setAppealReason] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const { data } = await api.get('/documents');
      const summary = data.verification as Verification;
      if (!Array.isArray(summary?.requirements)) throw new Error('Verification checklist is unavailable.');
      setVerification(summary);
      setExpanded((current) => current ?? summary.next_document);
      setDrafts((current) => {
        const next = { ...current };
        for (const item of data.data as DocumentRecord[]) {
          next[item.type] ??= { number: item.document_number || '', expiry: item.expires_at?.slice(0, 10) || '' };
        }
        return next;
      });
      setLoadError('');
    } catch (error) {
      setLoadError(apiErrorMessage(error, 'Could not load your documents. Check your connection and try again.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const updateDraft = (type: string, patch: Partial<Draft>) => {
    setDrafts((current) => ({ ...current, [type]: { ...(current[type] ?? { number: '', expiry: '' }), ...patch } }));
    setFieldError('');
  };

  const chooseFile = async (type: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(type);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], copyToCacheDirectory: true, base64: false });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        setFieldError('Choose a JPG, PNG, or PDF no larger than 10 MB.');
        return;
      }
      updateDraft(type, { file: asset });
    } catch (error) {
      Alert.alert('Could not choose file', apiErrorMessage(error, 'Please try again.'));
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const upload = async (requirement: Requirement) => {
    const draft = drafts[requirement.type];
    if (!draft?.file || busyRef.current || !consent || !requirement.can_submit || requirement.remaining_attempts <= 0) return;
    const expiry = draft.expiry.trim();
    if (requirement.has_expiry && expiry) {
      const parsed = new Date(`${expiry}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== expiry) {
        setFieldError('Enter a valid expiry date as YYYY-MM-DD.');
        return;
      }
    }
    busyRef.current = true;
    setBusy(requirement.type);
    setFieldError('');
    try {
      const form = new FormData();
      form.append('type', requirement.type);
      form.append('consent', '1');
      if (draft.number.trim()) form.append('document_number', draft.number.trim());
      if (requirement.has_expiry && expiry) form.append('expires_at', expiry);
      const asset = draft.file;
      if (Platform.OS === 'web') {
        let file: Blob;
        if (asset.file) {
          file = asset.file;
        } else {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          if (!blob) throw new Error('Could not read the selected file.');
          file = blob;
        }
        form.append('file', file, asset.name);
      } else {
        form.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' } as unknown as Blob);
      }
      // Allow time to transfer up to 10 MB and complete the server's security scan.
      const { data } = await api.post('/documents', form, { timeout: 120000 });
      setVerification(data.verification);
      updateDraft(requirement.type, { file: undefined });
      setExpanded(data.verification.next_document);
      setNotice(`${requirement.label} submitted for review. You can continue with the next item.`);
    } catch (error) {
      setFieldError(apiErrorMessage(error, 'Upload failed. Your details are still here. Try again.'));
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const capture = async (type: string) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(type);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) { setFieldError('Camera permission is required. You can also choose an existing file.'); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: false });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        updateDraft(type, { file: { uri: asset.uri, name: asset.fileName || 'document.jpg', mimeType: asset.mimeType || 'image/jpeg', size: asset.fileSize, file: asset.file, lastModified: Date.now() } });
      }
    } catch (error) { setFieldError(apiErrorMessage(error, 'Camera unavailable. Choose an existing file.')); }
    finally { busyRef.current = false; setBusy(null); }
  };

  if (loading) return <SafeAreaView style={styles.centered}><ActivityIndicator color="#0f766e" /><Text>Loading your checklist…</Text></SafeAreaView>;

  return <SafeAreaView edges={['bottom']} style={styles.root}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.back}><ArrowLeft size={22} color="#0f172a" /></Pressable>
      <Text style={styles.title}>Driver documents</Text>
    </View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />} contentContainerStyle={styles.content}>
        {loadError ? <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{loadError}</Text><Pressable accessibilityRole="button" onPress={() => void load(true)} style={styles.secondary}><Text style={styles.secondaryText}>Try again</Text></Pressable></View> : null}
        {verification && <>
          <View style={styles.summary}>
            <Text style={styles.heading}>{verification.status === 'complete' ? 'Driver documents approved' : verification.status === 'in_review' ? 'Your documents are in review' : 'Complete your document checklist'}</Text>
            <Text style={styles.body}>{verification.message}</Text>
            <Text style={styles.progress}>{verification.approved_count} of {verification.required_count} required documents approved</Text>
          </View>
          {notice ? <Text accessibilityLiveRegion="polite" style={styles.body}>{notice}</Text> : null}
          {verification.requirements.map((requirement) => {
            const open = expanded === requirement.type;
            const draft = drafts[requirement.type] || { number: '', expiry: '' };
            const needsFix = ['rejected', 'expired', 'correction_required', 'suspended', 'flagged'].includes(requirement.status);
            const Icon = requirement.status === 'approved' ? CheckCircle2 : requirement.status === 'pending' ? Clock3 : needsFix ? ShieldAlert : FileCheck2;
            return <View key={requirement.type} style={styles.card}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: open, disabled: busy !== null }} disabled={busy !== null} onPress={() => { setExpanded(open ? null : requirement.type); setFieldError(''); }} style={styles.cardTop}>
                <Icon size={24} color={needsFix ? '#be123c' : '#0f766e'} />
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>{requirement.label}</Text>
                  <Text style={styles.caption}>{requirement.required ? 'Required' : 'Optional · does not block approval'}</Text>
                  <Text style={[styles.status, needsFix && styles.error]}>{statusLabels[requirement.status]}</Text>
                </View>
                <Text style={styles.secondaryText}>{open ? 'Close' : needsFix ? 'Fix' : requirement.status === 'missing' ? 'Add' : 'View'}</Text>
              </Pressable>
              {open && <View style={styles.editor}>
                {requirement.rejection_reason ? <Text style={styles.error}>{requirement.rejection_reason}</Text> : null}
                {requirement.status === 'expired' ? <Text style={styles.error}>Expired {requirement.expires_at}. Upload a current document.</Text> : null}
                {!requirement.can_submit && <Text style={styles.body}>Uploads are locked while this document is approved or being reviewed. A reviewer can request a correction.</Text>}
                <Text style={styles.caption}>Remaining submissions: {requirement.remaining_attempts}. Previous versions remain in your review history.</Text>
                {requirement.can_submit && requirement.remaining_attempts > 0 && <>
                {!['government_id', 'aadhaar'].includes(requirement.type) && <><Text style={styles.label}>{requirement.number_label} (optional)</Text>
                <TextInput accessibilityLabel={requirement.number_label} editable={busy === null} value={draft.number} onChangeText={(number) => updateDraft(requirement.type, { number })} style={styles.input} maxLength={120} /></>}
                {requirement.has_expiry && <>
                  <Text style={styles.label}>Expiry date, if shown on the document</Text>
                  <ExpiryDateInput label={`${requirement.label} expiry date`} disabled={busy !== null} value={draft.expiry} onChange={(expiry) => updateDraft(requirement.type, { expiry })} />
                </>}
                <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void chooseFile(requirement.type)} style={styles.secondary}><Text style={styles.secondaryText}>{draft.file ? 'Choose a different file' : 'Choose JPG, PNG, WebP or PDF'}</Text></Pressable>
                <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void capture(requirement.type)} style={styles.secondary}><Text style={styles.secondaryText}>Capture with camera</Text></Pressable>
                {draft.file && <><Text style={styles.body}>Selected: {draft.file.name}</Text><Text style={styles.caption}>Check the selected file and details before submitting. Maximum file size: 10 MB.</Text></>}
                {fieldError ? <Text accessibilityRole="alert" style={styles.error}>{fieldError}</Text> : null}
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(!consent)} style={styles.secondary}><Text style={styles.body}>{consent ? '✓ ' : ''}I consent to this document being stored privately and reviewed for driver eligibility.</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: !draft.file || busy !== null || !consent }} disabled={!draft.file || busy !== null || !consent} onPress={() => void upload(requirement)} style={[styles.primary, (!draft.file || busy !== null || !consent) && styles.disabled]}>
                  {busy === requirement.type ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Submit for review</Text>}
                </Pressable>
                </>}
                {needsFix && requirement.document_id && <>
                  <TextInput accessibilityLabel="Appeal reason" placeholder="Explain why this decision should be reviewed" value={appealReason} onChangeText={setAppealReason} multiline style={styles.input} maxLength={2000} />
                  <Pressable accessibilityRole="button" disabled={!appealReason.trim() || busy !== null} style={styles.secondary} onPress={async () => {
                    if (busyRef.current) return;
                    busyRef.current = true; setBusy(requirement.type);
                    try { await api.post(`/documents/${requirement.document_id}/appeal`, { reason: appealReason }); setNotice('Appeal submitted for review.'); setAppealReason(''); }
                    catch (error) { setFieldError(apiErrorMessage(error, 'Could not submit appeal.')); }
                    finally { busyRef.current = false; setBusy(null); }
                  }}><Text style={styles.secondaryText}>Submit appeal</Text></Pressable>
                </>}
              </View>}
            </View>;
          })}
          <Text style={styles.body}>You can add your car while documents are reviewed. Vehicle approval is a separate step.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/my-car')} style={styles.secondary}><Text style={styles.secondaryText}>Continue to my car</Text></Pressable>
        </>}
        <VerificationInbox />
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, root: { flex: 1, backgroundColor: '#f8fafc' }, centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  header: { minHeight: 72, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff' },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, title: { flex: 1, fontSize: 22, fontWeight: '700', color: '#0f172a' },
  content: { padding: 16, paddingBottom: 32, gap: 16 }, summary: { gap: 8, paddingVertical: 8 }, heading: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  body: { fontSize: 16, lineHeight: 24, color: '#475569' }, progress: { fontSize: 14, fontWeight: '600', color: '#0f766e' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 16 }, cardTop: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' }, caption: { fontSize: 14, lineHeight: 20, color: '#475569', marginTop: 4 }, status: { fontSize: 14, fontWeight: '600', color: '#0f766e', marginTop: 6 },
  editor: { gap: 12, marginTop: 16 }, label: { fontSize: 14, color: '#334155', fontWeight: '600' }, input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: '#94a3b8', borderRadius: 8, fontSize: 16, color: '#0f172a' },
  error: { fontSize: 14, lineHeight: 21, color: '#be123c' }, primary: { minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#0f766e' }, primaryText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  secondary: { minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8 }, secondaryText: { fontSize: 14, fontWeight: '600', color: '#0f766e' }, disabled: { opacity: 0.5 },
});
