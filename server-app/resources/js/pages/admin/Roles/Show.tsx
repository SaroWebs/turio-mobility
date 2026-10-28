import React from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import {
    Paper, Stack, Group, Text, Badge, Button, Avatar,
    Divider, SimpleGrid,
} from '@mantine/core';
import { ArrowLeft, Pencil, Trash, Shield, Users, Lock } from 'lucide-react';
import { AdminPermission, AdminUser } from '@/types';

interface ShowRoleProps {
    title: string;
    target_role: {
        id: number;
        name: string;
        display_name: string;
        description?: string;
        permissions: AdminPermission[];
        users: AdminUser[];
    };
}

const MODULE_COLORS: Record<string, string> = {
    roles: '#ef4444', tours: '#3b82f6', places: '#14b8a6',
    bookings: '#f59e0b', drivers: '#a855f7', guides: '#10b981',
    reports: '#6366f1', settings: '#64748b', logs: '#78716c',
};
const moduleColor = (m: string) => MODULE_COLORS[m.toLowerCase()] ?? '#94a3b8';

const isProtected = (name: string) => ['admin', 'super_admin'].includes(name.toLowerCase());

export default function ShowRole({ title, target_role }: ShowRoleProps) {
    // Group permissions by their module/group
    const groupedPerms = target_role.permissions.reduce<Record<string, AdminPermission[]>>((acc, perm) => {
        const key = perm.group || 'general';
        if (!acc[key]) acc[key] = [];
        acc[key].push(perm);
        return acc;
    }, {});

    const handleDelete = () => {
        if (confirm(`Delete role "${target_role.display_name}"? This will detach all users and permissions.`)) {
            router.delete(`/admin/roles/${target_role.id}`);
        }
    };

    return (
        <AdminLayout title={title}>
            <Head title={`Role — ${target_role.display_name}`} />
            <Stack gap="xl" align="center" style={{ width: '100%' }}>
                <Paper p="xl" radius="md" style={{ background: '#11111199', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)', maxWidth: 720, width: '100%' }}>

                    {/* Top navigation */}
                    <Group justify="space-between" mb="xl">
                        <Text size="lg" fw={700} style={{ color: 'rgba(255,255,255,0.9)' }}>Role Details</Text>
                        <Button component={Link} href="/admin/roles" variant="subtle" leftSection={<ArrowLeft size={16} />} style={{ color: 'rgba(255,255,255,0.6)' }}>
                            Back to Roles
                        </Button>
                    </Group>

                    <Stack gap="xl">
                        {/* Role header */}
                        <Group gap="lg">
                            <div style={{
                                width: 72, height: 72, borderRadius: 16,
                                background: `${moduleColor('roles')}20`,
                                border: `1px solid ${moduleColor('roles')}40`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Shield size={30} style={{ color: moduleColor('roles') }} />
                            </div>
                            <Stack gap={4}>
                                <Group gap="sm">
                                    <Text size="xl" fw={700} style={{ color: 'rgba(255,255,255,0.95)' }}>
                                        {target_role.display_name}
                                    </Text>
                                    {isProtected(target_role.name) && (
                                        <Badge
                                            size="sm"
                                            leftSection={<Lock size={10} />}
                                            style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}
                                        >
                                            Protected
                                        </Badge>
                                    )}
                                </Group>
                                <Badge variant="outline" size="sm" style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace', width: 'fit-content' }}>
                                    {target_role.name}
                                </Badge>
                                {target_role.description && (
                                    <Text size="sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                                        {target_role.description}
                                    </Text>
                                )}
                                <Group gap="lg" mt={4}>
                                    <Group gap={5}>
                                        <Shield size={13} style={{ color: 'rgba(255,255,255,0.3)' }} />
                                        <Text size="xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                                            {target_role.permissions.length} permissions
                                        </Text>
                                    </Group>
                                    <Group gap={5}>
                                        <Users size={13} style={{ color: 'rgba(255,255,255,0.3)' }} />
                                        <Text size="xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                                            {target_role.users.length} users
                                        </Text>
                                    </Group>
                                </Group>
                            </Stack>
                        </Group>

                        <Divider style={{ borderColor: 'rgba(255,255,255,0.06)' }} />

                        {/* Permission matrix */}
                        {target_role.permissions.length > 0 ? (
                            <Stack gap="md">
                                <Text size="xs" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                    Permissions
                                </Text>
                                <Stack gap="sm">
                                    {Object.entries(groupedPerms).map(([module, perms]) => {
                                        const color = moduleColor(module);
                                        return (
                                            <Paper key={module} p="md" radius="md" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <Group gap="xs" mb="sm">
                                                    <Shield size={13} style={{ color }} />
                                                    <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.75)', textTransform: 'capitalize' }}>
                                                        {module.replace(/_/g, ' ')}
                                                    </Text>
                                                    <Badge size="xs" style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
                                                        {perms.length}
                                                    </Badge>
                                                </Group>
                                                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xs">
                                                    {perms.map((perm) => (
                                                        <Group key={perm.id} gap={6}>
                                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                                            <Text size="xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                                                                {perm.display_name}
                                                            </Text>
                                                        </Group>
                                                    ))}
                                                </SimpleGrid>
                                            </Paper>
                                        );
                                    })}
                                </Stack>
                            </Stack>
                        ) : (
                            <Text size="sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No permissions assigned to this role.</Text>
                        )}

                        {/* Assigned users */}
                        {target_role.users.length > 0 && (
                            <>
                                <Divider style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                                <Stack gap="sm">
                                    <Text size="xs" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                        Assigned Staff ({target_role.users.length})
                                    </Text>
                                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                                        {target_role.users.map((u) => (
                                            <Group key={u.id} gap="sm" style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <Avatar radius="xl" size="sm" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                                                    {u.name.charAt(0)}
                                                </Avatar>
                                                <Stack gap={0}>
                                                    <Text size="sm" fw={500} style={{ color: 'rgba(255,255,255,0.8)' }}>{u.name}</Text>
                                                    <Text size="xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{u.email}</Text>
                                                </Stack>
                                            </Group>
                                        ))}
                                    </SimpleGrid>
                                </Stack>
                            </>
                        )}

                        <Divider style={{ borderColor: 'rgba(255,255,255,0.06)' }} />

                        {/* Actions */}
                        <Group justify="flex-end" gap="sm">
                            {!isProtected(target_role.name) && (
                                <Button
                                    variant="subtle"
                                    color="red"
                                    leftSection={<Trash size={16} />}
                                    onClick={handleDelete}
                                >
                                    Delete Role
                                </Button>
                            )}
                            <Button
                                component={Link}
                                href={`/admin/roles/${target_role.id}/edit`}
                                leftSection={<Pencil size={16} />}
                                radius="md"
                                style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)', border: 'none', color: '#000', fontWeight: 600 }}
                            >
                                Edit Role
                            </Button>
                        </Group>
                    </Stack>
                </Paper>
            </Stack>
        </AdminLayout>
    );
}
