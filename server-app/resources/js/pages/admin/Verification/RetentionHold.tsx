import { useForm } from '@inertiajs/react';
import { Button, Checkbox, Stack, Text, TextInput } from '@mantine/core';

export default function RetentionHold({ version }: { version: { id: number; version: number; legal_hold: boolean } }) {
    const form = useForm({ legal_hold: version.legal_hold, reason: '' });
    return <form onSubmit={(e) => { e.preventDefault(); form.post(`/admin/verification/versions/${version.id}/hold`, { preserveScroll: true }); }}><Stack gap="xs">
        <Checkbox label={`Retain version ${version.version} under legal hold`} checked={form.data.legal_hold} onChange={(e) => form.setData('legal_hold', e.currentTarget.checked)} />
        <TextInput required label="Hold change reason" value={form.data.reason} onChange={(e) => form.setData('reason', e.currentTarget.value)} />
        {Object.values(form.errors).map((error) => <Text key={error} c="red">{error}</Text>)}<Button type="submit" variant="default" loading={form.processing}>Save hold</Button>
    </Stack></form>;
}
