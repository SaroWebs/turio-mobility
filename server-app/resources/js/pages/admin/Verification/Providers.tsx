import { Head, Link, useForm } from '@inertiajs/react';
import { Alert, Badge, Button, Checkbox, Paper, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import AdminLayout from '@/layouts/AdminLayout';

export default function Providers({ setting, credentials_present, environment_enabled, production, recent }: {
    setting: { enabled: boolean; authorization_reference: string | null } | null;
    credentials_present: boolean; environment_enabled: boolean; production: boolean;
    recent: { id: number; status: string; error_code: string | null; duration_ms: number | null; created_at: string }[];
}) {
    const form = useForm({ enabled: Boolean(setting?.enabled), authorization_reference: setting?.authorization_reference || '', reason: '' });
    return <AdminLayout><Head title="Verification providers" /><Stack>
        <Text component={Link} href="/admin/verification">Back to verification</Text><Title order={1}>Verification providers</Title>
        <Paper withBorder p="lg"><Stack><Title order={2}>Eko — driving licence and vehicle RC</Title>
            <Badge>{production ? 'Production' : 'Sandbox'}</Badge>
            <Text>Credentials: {credentials_present ? 'Configured' : 'Missing'}. Environment switch: {environment_enabled ? 'Enabled' : 'Disabled'}.</Text>
            <Alert>No automatic retry or paid fallback is enabled. An unavailable or inconclusive check moves to manual review. These synchronous checks do not accept webhooks.</Alert>
            <Text size="sm">Health below reflects actual requests. Saving these settings does not make a paid test request. Credentials are managed in the server environment.</Text>
            <form onSubmit={(e) => { e.preventDefault(); form.post('/admin/verification/providers'); }}><Stack>
                <Checkbox label="Enable commercially authorized requests" checked={form.data.enabled} onChange={(e) => form.setData('enabled', e.currentTarget.checked)} />
                <TextInput label="Commercial authorization reference" required={form.data.enabled} value={form.data.authorization_reference} onChange={(e) => form.setData('authorization_reference', e.currentTarget.value)} />
                <Textarea label="Reason for this change" required value={form.data.reason} onChange={(e) => form.setData('reason', e.currentTarget.value)} />
                {Object.values(form.errors).map((error) => <Text key={error} c="red" role="alert">{error}</Text>)}
                <Button type="submit" loading={form.processing}>Save provider settings</Button>
            </Stack></form>
        </Stack></Paper>
        <Title order={2}>Recent request health</Title>{recent.length === 0 && <Text>No requests recorded. Connectivity is untested.</Text>}
        {recent.map((item) => <Paper key={item.id} withBorder p="md"><Text>{item.created_at}: {item.status} {item.error_code || ''} · {item.duration_ms ?? 'Unknown'} ms</Text></Paper>)}
    </Stack></AdminLayout>;
}
