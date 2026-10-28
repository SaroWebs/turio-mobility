import { useForm } from '@inertiajs/react';
import { Alert, Button, Paper, Stack, Text, Textarea, TextInput } from '@mantine/core';

export type FindingRecord = { id: number; driver_document_id: number; version: number; message: string; severity: string; blocking: boolean; non_overridable: boolean; resolved_at: string | null };
export default function Finding({ finding, canResolve }: { finding: FindingRecord; canResolve: boolean }) {
    const form = useForm({ source: '', reference: '', findings: '' });
    return <Paper withBorder p="md"><Stack><Alert color={finding.resolved_at ? 'teal' : finding.blocking ? 'red' : 'blue'}>{finding.message} · {finding.resolved_at ? 'Resolved' : finding.blocking ? 'Blocks approval' : 'Information'}</Alert>
        {finding.non_overridable && <Text size="sm">This result cannot be overridden. Obtain a corrected document for a fresh check.</Text>}
        {!finding.resolved_at && !finding.non_overridable && finding.blocking && canResolve && <form onSubmit={(e) => { e.preventDefault(); form.post(`/admin/verification/findings/${finding.id}/resolve`, { preserveScroll: true }); }}><Stack>
            <TextInput required label="Independent evidence source" value={form.data.source} onChange={(e) => form.setData('source', e.currentTarget.value)} />
            <TextInput required label="Evidence reference" value={form.data.reference} onChange={(e) => form.setData('reference', e.currentTarget.value)} />
            <Textarea required label="Findings supporting resolution" value={form.data.findings} onChange={(e) => form.setData('findings', e.currentTarget.value)} />
            {Object.values(form.errors).map((error) => <Text key={error} c="red" role="alert">{error}</Text>)}
            <Button type="submit" loading={form.processing}>Record supported resolution</Button>
        </Stack></form>}
    </Stack></Paper>;
}
