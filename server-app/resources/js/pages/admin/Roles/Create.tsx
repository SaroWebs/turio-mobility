import React from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import {
    Paper, Stack, Group, Text, TextInput, Textarea, Button,
    Checkbox, Badge, Divider, SimpleGrid,
} from '@mantine/core';
import { ArrowLeft, Save, Shield } from 'lucide-react';
import { RoleFormProps, AdminPermission } from '@/types';

const MODULE_COLORS: Record<string, string> = {
    roles: '#ef4444', tours: '#3b82f6', places: '#14b8a6',
    bookings: '#f59e0b', drivers: '#a855f7', guides: '#10b981',
    reports: '#6366f1', settings: '#64748b', logs: '#78716c',
};
const moduleColor = (m: string) => MODULE_COLORS[m.toLowerCase()] ?? '#94a3b8';

export default function CreateRole({ title, grouped_permissions }: RoleFormProps) {
    const { data, setData, post, processing, errors } = useForm<{
        name: string;
        display_name: string;
        description: string;
        permissions: number[];
    }>({
        name: '',
        display_name: '',
        description: '',
        permissions: [],
    });

    const togglePermission = (id: number) => {
        setData('permissions', data.permissions.includes(id)
            ? data.permissions.filter((p) => p !== id)
            : [...data.permissions, id]
        );
    };

    const toggleModule = (perms: AdminPermission[]) => {
        const ids = perms.map((p) => p.id);
        const allChecked = ids.every((id) => data.permissions.includes(id));
        if (allChecked) {
            setData('permissions', data.permissions.filter((p) => !ids.includes(p)));
        } else {
            setData('permissions', [...new Set([...data.permissions, ...ids])]);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/roles');
    };

    const inputStyles = {
        input: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' },
        label: { color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
    };

    return (
        <AdminLayout title={title}>
            <Head title="Create Role" />
            <Stack gap="xl" align="center" style={{ width: '100%' }}>
                <Paper p="xl" radius="md" style={{ background: '#11111199', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)', maxWidth: 720, width: '100%' }}>
                    <Group justify="space-between" mb="xl">
                        <Text size="lg" fw={700} style={{ color: 'rgba(255,255,255,0.9)' }}>Create New Role</Text>
                        <Button component={Link} href="/admin/roles" variant="subtle" leftSection={<ArrowLeft size={16} />} style={{ color: 'rgba(255,255,255,0.6)' }}>
                            Back to Roles
                        </Button>
                    </Group>

                    <form onSubmit={handleSubmit}>
                        <Stack gap="md">
                            {/* Basic info */}
                            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                                <TextInput
                                    label="Display Name"
                                    placeholder="e.g. Tour Manager"
                                    required
                                    value={data.display_name}
                                    onChange={(e) => setData('display_name', e.currentTarget.value)}
                                    error={errors.display_name}
                                    radius="md"
                                    styles={inputStyles}
                                />
                                <TextInput
                                    label="Machine Name"
                                    placeholder="e.g. tour_manager (lowercase, underscores)"
                                    required
                                    value={data.name}
                                    onChange={(e) => setData('name', e.currentTarget.value.toLowerCase().replace(/[^a-z_]/g, ''))}
                                    error={errors.name}
                                    radius="md"
                                    styles={inputStyles}
                                    description={<span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Lowercase letters and underscores only</span>}
                                />
                            </SimpleGrid>

                            <Textarea
                                label="Description"
                                placeholder="Brief description of what this role can do..."
                                value={data.description}
                                onChange={(e) => setData('description', e.currentTarget.value)}
                                error={errors.description}
                                radius="md"
                                minRows={2}
                                styles={inputStyles}
                            />

                            <Divider label={<Text size="xs" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>PERMISSION MATRIX</Text>} labelPosition="left" style={{ borderColor: 'rgba(255,255,255,0.07)' }} />

                            {/* Permission matrix grouped by module */}
                            <Stack gap="lg">
                                {Object.entries(grouped_permissions).map(([module, perms]) => {
                                    const color = moduleColor(module);
                                    const ids = (perms as AdminPermission[]).map((p) => p.id);
                                    const allChecked = ids.every((id) => data.permissions.includes(id));
                                    const someChecked = ids.some((id) => data.permissions.includes(id));

                                    return (
                                        <Paper key={module} p="md" radius="md" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <Group justify="space-between" mb="sm">
                                                <Group gap="xs">
                                                    <Shield size={14} style={{ color }} />
                                                    <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.8)', textTransform: 'capitalize' }}>
                                                        {module.replace(/_/g, ' ')}
                                                    </Text>
                                                    <Badge size="xs" style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
                                                        {(perms as AdminPermission[]).length}
                                                    </Badge>
                                                </Group>
                                                <Checkbox
                                                    size="xs"
                                                    label="All"
                                                    checked={allChecked}
                                                    indeterminate={someChecked && !allChecked}
                                                    onChange={() => toggleModule(perms as AdminPermission[])}
                                                    styles={{ label: { color: 'rgba(255,255,255,0.4)', fontSize: 11 } }}
                                                    color="yellow"
                                                />
                                            </Group>
                                            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xs">
                                                {(perms as AdminPermission[]).map((perm) => (
                                                    <Checkbox
                                                        key={perm.id}
                                                        size="xs"
                                                        label={perm.display_name}
                                                        checked={data.permissions.includes(perm.id)}
                                                        onChange={() => togglePermission(perm.id)}
                                                        color="yellow"
                                                        styles={{ label: { color: 'rgba(255,255,255,0.65)', fontSize: 12 } }}
                                                    />
                                                ))}
                                            </SimpleGrid>
                                        </Paper>
                                    );
                                })}
                            </Stack>

                            <Group justify="space-between" mt="md" align="center">
                                <Text size="xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                    {data.permissions.length} permission{data.permissions.length !== 1 ? 's' : ''} selected
                                </Text>
                                <Button
                                    type="submit"
                                    radius="md"
                                    loading={processing}
                                    leftSection={<Save size={16} />}
                                    style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)', border: 'none', color: '#000', fontWeight: 600 }}
                                >
                                    Create Role
                                </Button>
                            </Group>
                        </Stack>
                    </form>
                </Paper>
            </Stack>
        </AdminLayout>
    );
}
