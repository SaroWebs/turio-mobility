import React from 'react';
import { Head, useForm } from '@inertiajs/react';
import AdminLayout from '../../../layouts/AdminLayout';
import { Button, Group, NumberInput, Paper, Select, SimpleGrid, Stack, Switch, Tabs, Text, TextInput } from '@mantine/core';

type SettingValue = string | number | boolean | null;
type Definition = { group: string; label: string; description: string; type: string; default: SettingValue; unit?: string | null; min?: number; max?: number; scopes: string[] };
type Props = { title: string; catalog: Record<string, Definition>; groups: Record<string, string>; overrides: Array<{ key: string; value: SettingValue; scope_category_id?: number | null; scope_zone_id?: number | null }>; categories: Array<{ id: number; name: string }>; zones: Array<{ id: number; name: string }> };

export default function Index({ title, catalog, groups, overrides, categories, zones }: Props) {
    const globalValues = Object.fromEntries(Object.entries(catalog).map(([key, definition]) => {
        const row = overrides.find((item) => item.key === key && !item.scope_category_id && !item.scope_zone_id);
        const value = row?.value ?? definition.default;
        return [key, value];
    }));
    const { data, setData, post, processing, errors } = useForm({ values: globalValues, scope_category_id: '', scope_zone_id: '' });
    const fieldErrors: Record<string, string | undefined> = errors;
    const updateValue = (key: string, value: SettingValue) => setData('values', { ...data.values, [key]: catalog[key].type === 'percent' ? Number(value) / 100 : value });
    const submit = (event: React.FormEvent) => { event.preventDefault(); post('/admin/settings'); };

    return <AdminLayout title={title}><Head title={title} /><form onSubmit={submit}><Stack gap="lg">
        <Group justify="space-between"><Text size="xl" fw={700}>Operational Settings</Text><Button type="submit" loading={processing}>Save settings</Button></Group>
        <Group grow><Select label="Category scope" clearable data={categories.map((item) => ({ value: String(item.id), label: item.name }))} value={data.scope_category_id} onChange={(value) => setData('scope_category_id', value || '')} /><Select label="Zone scope" clearable data={zones.map((item) => ({ value: String(item.id), label: item.name }))} value={data.scope_zone_id} onChange={(value) => setData('scope_zone_id', value || '')} /></Group>
        <Tabs defaultValue={Object.keys(groups)[0]}><Tabs.List>{Object.entries(groups).map(([key, label]) => <Tabs.Tab key={key} value={key}>{label}</Tabs.Tab>)}</Tabs.List>
            {Object.entries(groups).map(([group, label]) => <Tabs.Panel key={group} value={group} pt="lg"><SimpleGrid cols={{ base: 1, md: 2 }}>{Object.entries(catalog).filter(([, definition]) => definition.group === group).map(([key, definition]) => <Paper key={key} p="md" withBorder><Stack gap="xs"><Text fw={600}>{definition.label}</Text><Text size="xs" c="dimmed">{definition.description}</Text>{definition.type === 'bool' ? <Switch checked={Boolean(data.values[key])} onChange={(event) => updateValue(key, event.currentTarget.checked)} /> : definition.type === 'string' ? <TextInput value={String(data.values[key] ?? '')} onChange={(event) => updateValue(key, event.currentTarget.value)} error={fieldErrors[`values.${key}`]} /> : <NumberInput value={Number(data.values[key] ?? 0) * (definition.type === 'percent' ? 100 : 1)} onChange={(value) => updateValue(key, value)} min={definition.type === 'percent' ? (definition.min ?? 0) * 100 : definition.min} max={definition.type === 'percent' ? (definition.max ?? 1) * 100 : definition.max} suffix={definition.type === 'percent' ? ' %' : definition.unit ? ` ${definition.unit}` : undefined} error={fieldErrors[`values.${key}`]} />}</Stack></Paper>)}</SimpleGrid></Tabs.Panel>)}
        </Tabs>
    </Stack></form></AdminLayout>;
}
