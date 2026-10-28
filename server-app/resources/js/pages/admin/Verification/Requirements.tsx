import { Head, Link, useForm } from '@inertiajs/react';
import { Alert, Badge, Button, Checkbox, Group, Modal, NumberInput, Paper, Select, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';

export default function Requirements({ requirements, services, categories }: {
    categories: { id: number; name: string }[];
    requirements: { id: number; type: string; label: string; service_category: string; enabled: boolean; level: string }[]; services: string[];
}) {
    const [confirm, setConfirm] = useState(false);
    const form = useForm<{ type: string; label: string; service_category: string; level: string; mandatory: boolean; blocks_activation: boolean; requires_expiry: boolean; verification_method: string; max_submissions: number; vehicle_category_id: number | null; alternative_types: string[]; licence_class: string; licence_scope: string; second_review: boolean; enabled: boolean; reason: string }>({ type: '', label: '', service_category: services[0], level: 'identity', mandatory: true, blocks_activation: true, requires_expiry: false, verification_method: 'manual_or_api', max_submissions: 3, vehicle_category_id: null, alternative_types: [], licence_class: '', licence_scope: '', second_review: false, enabled: false, reason: '' });
    return <AdminLayout><Head title="Document requirements" /><Stack gap="lg">
        <Text component={Link} href="/admin/verification">Back to verification</Text><Title order={1}>Document requirements</Title>
        <Alert color="yellow">Publish only a reviewed policy for the applicable service and jurisdiction. Published requirements are locked; weakening them requires a separate compliance migration.</Alert>
        {requirements.map((requirement) => <Paper withBorder p="md" key={requirement.id}><Group justify="space-between"><div><Text fw={600}>{requirement.label}</Text><Text size="sm">{requirement.service_category} · {requirement.level} · {requirement.type}</Text></div><Badge color={requirement.enabled ? 'teal' : 'gray'}>{requirement.enabled ? 'Published' : 'Draft'}</Badge></Group></Paper>)}
        <Paper withBorder p="lg"><form onSubmit={(e) => { e.preventDefault(); setConfirm(true); }}><Stack>
            <Title order={2}>Create or update a draft requirement</Title>
            <Group grow><TextInput required label="Document type key" description="Use the existing key to reuse a driver document, for example driving_license or vehicle_rc." value={form.data.type} onChange={(e) => form.setData('type', e.currentTarget.value)} /><TextInput required label="Display label" value={form.data.label} onChange={(e) => form.setData('label', e.currentTarget.value)} /></Group>
            <Group grow><Select label="Service" data={services} value={form.data.service_category} onChange={(v) => form.setData('service_category', v || services[0])} /><Select label="Verification level" data={['identity', 'driving', 'vehicle']} value={form.data.level} onChange={(v) => form.setData('level', v || 'identity')} /></Group>
            <Select label="Verification method" data={[{ value: 'manual_or_api', label: 'Authorized manual or API evidence' }, { value: 'manual', label: 'Authorized manual evidence required' }]} value={form.data.verification_method} onChange={(v) => form.setData('verification_method', v || 'manual')} />
            <Select clearable label="Vehicle category (blank applies to all)" data={categories.map((category) => ({ value: String(category.id), label: category.name }))} value={form.data.vehicle_category_id ? String(form.data.vehicle_category_id) : null} onChange={(value) => form.setData('vehicle_category_id', value ? Number(value) : null)} />
            <TextInput label="Accepted alternative type keys" description="Comma-separated, for example passport,tax_id. Any one satisfies this requirement." value={form.data.alternative_types.join(',')} onChange={(e) => form.setData('alternative_types', e.currentTarget.value.split(','))} />
            <Group grow><TextInput label="Required licence class" value={form.data.licence_class} onChange={(e) => form.setData('licence_class', e.currentTarget.value)} /><Select clearable label="Required licence scope" data={['transport', 'non_transport']} value={form.data.licence_scope || null} onChange={(value) => form.setData('licence_scope', value || '')} /></Group>
            <Checkbox label="Require a second independent approval" checked={form.data.second_review} onChange={(e) => form.setData('second_review', e.currentTarget.checked)} />
            <NumberInput label="Maximum submissions" min={1} max={10} value={form.data.max_submissions} onChange={(value) => form.setData('max_submissions', Number(value))} />
            <Checkbox label="Mandatory document" checked={form.data.mandatory} onChange={(e) => form.setData('mandatory', e.currentTarget.checked)} /><Checkbox label="Blocks service activation" checked={form.data.blocks_activation} onChange={(e) => form.setData('blocks_activation', e.currentTarget.checked)} /><Checkbox label="Expiry date is required" checked={form.data.requires_expiry} onChange={(e) => form.setData('requires_expiry', e.currentTarget.checked)} />
            <Textarea required label="Policy justification and compliance review reference" value={form.data.reason} onChange={(e) => form.setData('reason', e.currentTarget.value)} />
            <Checkbox label="Publish this reviewed requirement" checked={form.data.enabled} onChange={(e) => form.setData('enabled', e.currentTarget.checked)} />
            {Object.values(form.errors).map((error) => <Text key={error} c="red" role="alert">{error}</Text>)}<Button type="submit">Review requirement</Button>
        </Stack></form></Paper>
        <Modal opened={confirm} onClose={() => setConfirm(false)} title="Confirm requirement"><Stack><Text>{form.data.enabled ? 'Publish and lock' : 'Save draft'}: {form.data.label} for {form.data.service_category}?</Text><Text size="sm">{form.data.reason}</Text><Button loading={form.processing} onClick={() => form.post('/admin/verification/requirements', { preserveScroll: true, onSuccess: () => setConfirm(false) })}>Confirm</Button></Stack></Modal>
    </Stack></AdminLayout>;
}
