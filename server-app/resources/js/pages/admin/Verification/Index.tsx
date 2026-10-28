import { Head, Link, router } from '@inertiajs/react';
import { Badge, Button, Group, Paper, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';

type Driver = { id: number; name: string; phone: string; status: string; documents_count: number };
export default function VerificationQueue({ drivers, filters }: {
    drivers: { data: Driver[]; current_page: number; last_page: number }; filters: { search?: string; status?: string };
}) {
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || '');
    const load = (page = 1) => router.get('/admin/verification', { search, status, page }, { preserveState: true });
    return <AdminLayout><Head title="Document verification" /><Stack gap="lg">
        <div><Title order={1}>Document verification</Title><Text c="dimmed">Review evidence and make a separate approval decision for each document.</Text></div>
        <Group><Button component={Link} href="/admin/verification/providers" variant="default">Provider settings</Button><Button component={Link} href="/admin/verification/requirements" variant="default">Document requirements</Button><Button component={Link} href="/admin/verification/analytics" variant="default">Compliance and costs</Button></Group>
        <form onSubmit={(e) => { e.preventDefault(); load(); }}><Group align="end">
            <TextInput label="Driver name" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
            <Select label="Document status" clearable value={status || null} onChange={(v) => setStatus(v || '')} data={['pending', 'under_review', 'manual_verification_pending', 'manually_verified', 'inconclusive', 'correction_required', 'flagged', 'approved', 'rejected', 'expired', 'suspended'].map((value) => ({ value, label: value.replaceAll('_', ' ') }))} />
            <Button type="submit">Filter queue</Button>
        </Group></form>
        {drivers.data.length === 0 && <Paper withBorder p="xl"><Text>No drivers match these filters.</Text></Paper>}
        {drivers.data.map((driver) => <Paper withBorder p="md" key={driver.id}><Group justify="space-between">
            <div><Text fw={600}>{driver.name}</Text><Text size="sm" c="dimmed">Driver #{driver.id} · {driver.phone} · {driver.documents_count} documents</Text></div>
            <Group><Badge variant="light">{driver.status}</Badge><Button component={Link} href={`/admin/verification/${driver.id}`} variant="light">Review documents</Button></Group>
        </Group></Paper>)}
        <Group><Button variant="default" disabled={drivers.current_page <= 1} onClick={() => load(drivers.current_page - 1)}>Previous</Button><Text size="sm">Page {drivers.current_page} of {drivers.last_page}</Text><Button variant="default" disabled={drivers.current_page >= drivers.last_page} onClick={() => load(drivers.current_page + 1)}>Next</Button></Group>
    </Stack></AdminLayout>;
}
