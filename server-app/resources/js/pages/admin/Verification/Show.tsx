import { Head, Link, useForm } from '@inertiajs/react';
import { Alert, Badge, Button, Grid, Group, Modal, Paper, Select, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';

import Finding, { type FindingRecord } from './Finding';
import RetentionHold from './RetentionHold';

type Document = { id: number; type: string; status: string; version: number; verification_outcome: string; masked_number: string | null; expires_at: string | null; versions: { id: number; version: number; url: string | null; created_at: string; legal_hold: boolean; purged_at: string | null }[] };
type Provider = { value: string; label: string; simulated: boolean };
function ProviderCheck({ document, providers }: { document: Document; providers: Provider[] }) {
    const form = useForm({ provider: providers[0]?.value || '', version: document.version });
    const [confirm, setConfirm] = useState(false);
    return <Paper withBorder p="md"><Stack><Title order={3}>Provider evidence</Title>
        {providers.length === 0 ? <Text>No authorized live provider is configured for this document. Use an authorized external manual check.</Text> : <>
            <Select label="Provider" data={providers.map(({ value, label }) => ({ value, label }))} value={form.data.provider} onChange={(v) => form.setData('provider', v || '')} />
            {providers.find((provider) => provider.value === form.data.provider)?.simulated && <Alert color="yellow">Simulation only. No registry is contacted and this result cannot qualify a document for approval.</Alert>}
            {Object.values(form.errors).map((error) => <Text key={error} c="red" role="alert">{error}</Text>)}
            <Button disabled={!form.data.provider || document.status === 'approved'} onClick={() => setConfirm(true)}>Request verification</Button>
            <Modal opened={confirm} onClose={() => setConfirm(false)} title="Confirm provider request"><Stack><Text>Request a check for version {document.version}? Live providers may charge per check. Failed requests are not automatically retried.</Text><Button loading={form.processing} onClick={() => form.post(`/admin/verification/documents/${document.id}/verify`, { preserveScroll: true, onSuccess: () => setConfirm(false) })}>Confirm request</Button></Stack></Modal>
        </>}
    </Stack></Paper>;
}
const actions = [
    ['under_review', 'Start review', 'review'], ['manual_verification_pending', 'Request external check', 'manual_check'],
    ['manually_verified', 'Record verified evidence', 'manual_check'], ['inconclusive', 'Record inconclusive check', 'manual_check'],
    ['approved', 'Approve document', 'approve_document'], ['correction_required', 'Request correction', 'request_correction'],
    ['rejected', 'Reject document', 'reject_document'], ['flagged', 'Escalate', 'escalate'], ['suspended', 'Suspend', 'escalate'], ['reopen', 'Authorize another submission', 'escalate'],
];
function Review({ document, permissions }: { document: Document; permissions: string[] }) {
    const [confirm, setConfirm] = useState(false);
    const form = useForm({ version: document.version, action: '', reason: '', evidence: { method: '', source: '', checked_at: '', findings: '', reference: '' } });
    const approvalBlocked = document.verification_outcome !== 'verified' || !['manually_verified', 'api_verified'].includes(document.status) || Boolean(document.expires_at && document.expires_at.slice(0, 10) < new Date().toISOString().slice(0, 10));
    return <Stack>
        <Title order={3}>Review decision</Title>
        <Text size="sm">Evidence and approval are separate. Record the source and findings of an authorized check before approving.</Text>
        {approvalBlocked && <Alert color="yellow">Approval requires current verified evidence and an unexpired document.</Alert>}
        <Select label="Action" data={actions.filter(([, , permission]) => permissions.includes(`verification.${permission}`)).map(([value, label]) => ({ value, label, disabled: value === 'approved' && approvalBlocked }))} value={form.data.action || null} onChange={(value) => form.setData('action', value || '')} />
        <Textarea required label="Reason / correction instructions" value={form.data.reason} onChange={(e) => form.setData('reason', e.currentTarget.value)} />
        {form.data.action === 'manually_verified' && Object.keys(form.data.evidence).map((key) => <TextInput key={key} required type={key === 'checked_at' ? 'datetime-local' : 'text'} label={key.replaceAll('_', ' ')} value={form.data.evidence[key as keyof typeof form.data.evidence]} onChange={(e) => form.setData('evidence', { ...form.data.evidence, [key]: e.currentTarget.value })} />)}
        {Object.entries(form.errors).map(([key, error]) => <Text role="alert" key={key} c="red" size="sm">{error}</Text>)}
        <Button disabled={!form.data.action || !form.data.reason.trim()} loading={form.processing} onClick={() => setConfirm(true)}>Review and confirm</Button>
        <Modal opened={confirm} onClose={() => setConfirm(false)} title="Confirm document decision" centered><Stack>
            <Text>Record “{form.data.action.replaceAll('_', ' ')}” for version {document.version} of {document.type.replaceAll('_', ' ')}?</Text>
            <Text size="sm">{form.data.reason}</Text>
            <Button loading={form.processing} onClick={() => { form.transform((data) => data.action === 'manually_verified' ? data : { ...data, evidence: null }); form.post(`/admin/verification/documents/${document.id}/decision`, { preserveScroll: true, onSuccess: () => { setConfirm(false); form.reset(); } }); }}>Confirm decision</Button>
        </Stack></Modal>
    </Stack>;
}
function Appeal({ appeal }: { appeal: { id: number; reason: string; status: string } }) {
    const form = useForm({ decision: 'upheld', resolution: '' });
    const [confirm, setConfirm] = useState(false);
    return <Paper withBorder p="md"><Stack><Text>{appeal.reason}</Text><Badge>{appeal.status}</Badge>{appeal.status === 'pending' && <>
        <Select label="Appeal decision" data={[{ value: 'upheld', label: 'Uphold original decision' }, { value: 'reopen', label: 'Authorize another submission' }]} value={form.data.decision} onChange={(v) => form.setData('decision', v || 'upheld')} />
        <Textarea label="Resolution reason" value={form.data.resolution} onChange={(e) => form.setData('resolution', e.currentTarget.value)} required />
        {Object.values(form.errors).map((error) => <Text key={error} c="red" role="alert">{error}</Text>)}
        <Button disabled={!form.data.resolution.trim()} onClick={() => setConfirm(true)}>Review appeal decision</Button>
        <Modal opened={confirm} onClose={() => setConfirm(false)} title="Confirm appeal resolution"><Stack><Text>{form.data.resolution}</Text><Button loading={form.processing} onClick={() => form.post(`/admin/verification/appeals/${appeal.id}/resolve`, { preserveScroll: true, onSuccess: () => setConfirm(false) })}>Confirm resolution</Button></Stack></Modal>
    </>}</Stack></Paper>;
}
function ServiceDecision({ driverId }: { driverId: number }) {
    const [confirm, setConfirm] = useState(false);
    const form = useForm({ service: 'short_ride', status: 'under_review', reason: '' });
    return <Paper withBorder p="md"><Stack><Title order={3}>Service eligibility decision</Title><Text size="sm">Enroll a driver only after reviewing the service requirements. Enrollment immediately enforces that policy on supported operation boundaries.</Text>
        <Select label="Service" data={['short_ride', 'long_ride', 'carpool', 'rental', 'tour']} value={form.data.service} onChange={(v) => form.setData('service', v || 'short_ride')} />
        <Select label="Decision" data={['under_review', 'approved', 'rejected', 'suspended', 'reverification_required']} value={form.data.status} onChange={(v) => form.setData('status', v || 'under_review')} />
        <Textarea label="Decision reason" required value={form.data.reason} onChange={(e) => form.setData('reason', e.currentTarget.value)} />
        {Object.values(form.errors).map((error) => <Text key={error} c="red" role="alert">{error}</Text>)}
        <Button disabled={!form.data.reason.trim()} onClick={() => setConfirm(true)}>Review service decision</Button>
        <Modal opened={confirm} onClose={() => setConfirm(false)} title="Confirm service eligibility"><Stack><Text>Set {form.data.service} eligibility to {form.data.status.replaceAll('_', ' ')}? This can prevent new operations for this service.</Text><Button loading={form.processing} onClick={() => form.post(`/admin/verification/${driverId}/service`, { preserveScroll: true, onSuccess: () => setConfirm(false) })}>Confirm decision</Button></Stack></Modal>
    </Stack></Paper>;
}
export default function VerificationDetail({ driver, documents, reviews, permissions, appeals, service_cases, providers, attempts, findings }: {
    findings: FindingRecord[];
    driver: { id: number; name: string; status: string }; documents: Document[]; permissions: string[];
    reviews: { id: number; version: number; action: string; reason: string; created_at: string; actor_id: number | null }[];
    appeals: { id: number; reason: string; status: string }[];
    service_cases: { id: number; service_category: string; status: string }[];
    providers: Record<string, Provider[]>;
    attempts: { id: number; driver_document_id: number; provider: string; simulated: boolean; status: string; message: string | null; checked_attributes: string[]; completed_at: string | null }[];
}) {
    const [selected, setSelected] = useState(documents[0]?.id);
    const document = documents.find((item) => item.id === selected);
    return <AdminLayout><Head title={`Verification · ${driver.name}`} /><Stack gap="lg">
        <Group justify="space-between"><div><Text component={Link} href="/admin/verification">Back to queue</Text><Title order={1}>{driver.name}</Title><Text c="dimmed">Driver #{driver.id} · {driver.status}</Text></div><Button component={Link} href={`/admin/drivers/${driver.id}`} variant="default">Driver profile</Button></Group>
        <Grid><Grid.Col span={{ base: 12, md: 3 }}><Stack>{documents.map((item) => <Button key={item.id} variant={selected === item.id ? 'filled' : 'light'} h="auto" py="sm" onClick={() => setSelected(item.id)}>{item.type.replaceAll('_', ' ')} · v{item.version}</Button>)}</Stack></Grid.Col>
            <Grid.Col span={{ base: 12, md: 5 }}><Paper withBorder p="lg"><Stack>
                {document ? <><Group><Badge>{document.status.replaceAll('_', ' ')}</Badge><Text size="sm">Evidence: {document.verification_outcome}</Text></Group><Title order={2}>{document.type.replaceAll('_', ' ')}</Title><Text>{document.masked_number || 'No identifier retained'}</Text><Text size="sm">Expiry: {document.expires_at?.slice(0, 10) || 'Not recorded'}</Text>
                    <Title order={3}>Secure document history</Title><Text size="sm" c="dimmed">Preview links expire after five minutes. Reload this page to renew them.</Text>
                    {document.versions.map((version) => <Group key={version.id} justify="space-between"><Text>Version {version.version}</Text>{version.url ? <Button component="a" href={version.url} target="_blank" rel="noopener noreferrer" variant="light">Open private preview</Button> : <Text size="sm" c="orange">{version.purged_at ? 'Purged under retention policy' : 'Private migration required'}</Text>}</Group>)}
                    {document.version === 0 && <Alert color="yellow">Legacy file: private migration and verification evidence are required before a new approval.</Alert>}
                </> : <Text>No documents submitted.</Text>}
            </Stack></Paper></Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}><Paper withBorder p="lg">{document && <Review key={`${document.id}:${document.version}:${document.status}`} document={document} permissions={permissions} />}</Paper></Grid.Col>
        </Grid>
        {document && findings.filter((finding) => finding.driver_document_id === document.id && finding.version === document.version).map((finding) => <Finding key={finding.id} finding={finding} canResolve={permissions.includes('verification.resolve_finding')} />)}
        {document && permissions.includes('verification.manage_retention') && document.versions.filter((version) => !version.purged_at).map((version) => <RetentionHold key={version.id} version={version} />)}
        {document && permissions.includes('verification.run_api') && <ProviderCheck key={`${document.id}:${document.version}`} document={document} providers={providers[document.type] || []} />}
        {document && attempts.filter((attempt) => attempt.driver_document_id === document.id).map((attempt) => <Paper withBorder p="md" key={attempt.id}><Text fw={600}>{attempt.provider} · {attempt.simulated ? 'Simulation' : 'Provider evidence'} · {attempt.status}</Text><Text size="sm">{attempt.message}</Text><Text size="sm">Attributes received: {attempt.checked_attributes.join(', ') || 'None'}. Completed: {attempt.completed_at || 'Pending'}.</Text></Paper>)}
        {permissions.includes('verification.approve_driver') && <><Title order={2}>Service eligibility</Title>{service_cases.map((item) => <Text key={item.id}>{item.service_category}: {item.status.replaceAll('_', ' ')}</Text>)}<ServiceDecision driverId={driver.id} /></>}
        {permissions.includes('verification.resolve_appeal') && appeals.length > 0 && <><Title order={2}>Appeals</Title>{appeals.map((appeal) => <Appeal key={appeal.id} appeal={appeal} />)}</>}
        {permissions.includes('verification.view_audit_logs') && <><Title order={2}>Review history</Title>{reviews.map((review) => <Paper withBorder p="md" key={review.id}><Text fw={600}>{review.action.replaceAll('_', ' ')} · v{review.version}</Text><Text size="sm">{review.reason}</Text><Text size="xs" c="dimmed">{review.created_at} · {review.actor_id ? `Reviewer #${review.actor_id}` : 'Driver / system'}</Text></Paper>)}</>}
    </Stack></AdminLayout>;
}
