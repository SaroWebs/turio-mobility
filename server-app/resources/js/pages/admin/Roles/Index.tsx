import React from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import {
    Table,
    Badge,
    Text,
    Group,
    ActionIcon,
    Button,
    Paper,
    Pagination,
    Tooltip,
    Stack,
    Menu,
    Avatar,
} from '@mantine/core';
import { Plus, Eye, Pencil, Trash, MoreVertical, Shield, Users } from 'lucide-react';
import { RolesIndexProps, AdminRole } from '@/types';

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
    admin:       { bg: 'rgba(239,68,68,0.15)',   text: '#ef4444' },
    super_admin: { bg: 'rgba(239,68,68,0.15)',   text: '#ef4444' },
    guide:       { bg: 'rgba(59,130,246,0.15)',  text: '#3b82f6' },
    driver:      { bg: 'rgba(20,184,166,0.15)',  text: '#14b8a6' },
    customer:    { bg: 'rgba(168,85,247,0.15)',  text: '#a855f7' },
};

const roleColor = (name: string) =>
    ROLE_COLORS[name.toLowerCase()] ?? { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.5)' };

const isProtected = (name: string) => ['admin', 'super_admin'].includes(name.toLowerCase());

export default function RolesIndex({ title, roles }: RolesIndexProps) {
    const { url } = usePage();

    const handleDelete = (role: AdminRole) => {
        if (confirm(`Delete role "${role.display_name}"? This will detach all users and permissions.`)) {
            router.delete(`/admin/roles/${role.id}`);
        }
    };

    return (
        <AdminLayout title={title}>
            <Head title="Roles & Permissions" />

            <Stack gap="xl">
                <Paper
                    p="xl"
                    radius="md"
                    style={{
                        background: '#11111199',
                        border: '1px solid rgba(255,255,255,0.06)',
                        backdropFilter: 'blur(12px)',
                    }}
                >
                    {/* Header */}
                    <Group justify="space-between" mb="xl">
                        <Stack gap={2}>
                            <Text size="lg" fw={700} style={{ color: 'rgba(255,255,255,0.9)' }}>
                                All Roles
                            </Text>
                            <Text size="xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                                {roles.total} role{roles.total !== 1 ? 's' : ''} configured
                            </Text>
                        </Stack>
                        <Button
                            component={Link}
                            href="/admin/roles/create"
                            leftSection={<Plus size={16} />}
                            radius="md"
                            style={{
                                background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                                border: 'none',
                                color: '#000',
                                fontWeight: 600,
                            }}
                        >
                            New Role
                        </Button>
                    </Group>

                    {/* Table */}
                    <Table.ScrollContainer minWidth={700}>
                        <Table
                            verticalSpacing="md"
                            highlightOnHover
                            styles={{
                                table: { background: 'transparent' },
                                th: {
                                    color: 'rgba(255,255,255,0.4)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    fontSize: 11,
                                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                                },
                            }}
                        >
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Role</Table.Th>
                                    <Table.Th>Machine Name</Table.Th>
                                    <Table.Th>Permissions</Table.Th>
                                    <Table.Th>Users</Table.Th>
                                    <Table.Th />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {roles.data.map((role) => {
                                    const color = roleColor(role.name);
                                    return (
                                        <Table.Tr key={role.id}>
                                            {/* Role info */}
                                            <Table.Td>
                                                <Group gap="sm">
                                                    <Avatar
                                                        radius="md"
                                                        size="md"
                                                        style={{
                                                            background: color.bg,
                                                            border: `1px solid ${color.text}40`,
                                                            color: color.text,
                                                        }}
                                                    >
                                                        <Shield size={16} />
                                                    </Avatar>
                                                    <Stack gap={0}>
                                                        <Text size="sm" fw={700} style={{ color: 'rgba(255,255,255,0.9)' }}>
                                                            {role.display_name}
                                                        </Text>
                                                        {role.description && (
                                                            <Text size="xs" style={{ color: 'rgba(255,255,255,0.35)' }} lineClamp={1}>
                                                                {role.description}
                                                            </Text>
                                                        )}
                                                    </Stack>
                                                </Group>
                                            </Table.Td>

                                            {/* Machine name */}
                                            <Table.Td>
                                                <Badge
                                                    size="xs"
                                                    variant="outline"
                                                    style={{
                                                        borderColor: 'rgba(255,255,255,0.15)',
                                                        color: 'rgba(255,255,255,0.5)',
                                                        fontFamily: 'monospace',
                                                    }}
                                                >
                                                    {role.name}
                                                </Badge>
                                                {isProtected(role.name) && (
                                                    <Badge
                                                        size="xs"
                                                        ml={4}
                                                        style={{
                                                            background: 'rgba(251,191,36,0.12)',
                                                            color: '#fbbf24',
                                                            border: '1px solid rgba(251,191,36,0.25)',
                                                        }}
                                                    >
                                                        Protected
                                                    </Badge>
                                                )}
                                            </Table.Td>

                                            {/* Permission count */}
                                            <Table.Td>
                                                <Group gap={4}>
                                                    <Shield size={13} style={{ color: 'rgba(255,255,255,0.3)' }} />
                                                    <Text size="sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                                        {role.permissions_count ?? role.permissions?.length ?? 0}
                                                    </Text>
                                                </Group>
                                            </Table.Td>

                                            {/* User count */}
                                            <Table.Td>
                                                <Group gap={4}>
                                                    <Users size={13} style={{ color: 'rgba(255,255,255,0.3)' }} />
                                                    <Text size="sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                                        {role.users_count ?? 0}
                                                    </Text>
                                                </Group>
                                            </Table.Td>

                                            {/* Actions */}
                                            <Table.Td>
                                                <Group gap={4} justify="flex-end">
                                                    <Tooltip label="View Details">
                                                        <ActionIcon
                                                            variant="light"
                                                            component={Link}
                                                            href={`/admin/roles/${role.id}`}
                                                            style={{
                                                                background: 'rgba(59,130,246,0.1)',
                                                                color: '#3b82f6',
                                                                border: '1px solid rgba(59,130,246,0.2)',
                                                            }}
                                                        >
                                                            <Eye size={16} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                    <Tooltip label="Edit Role">
                                                        <ActionIcon
                                                            variant="light"
                                                            component={Link}
                                                            href={`/admin/roles/${role.id}/edit`}
                                                            style={{
                                                                background: 'rgba(251,191,36,0.1)',
                                                                color: '#fbbf24',
                                                                border: '1px solid rgba(251,191,36,0.2)',
                                                            }}
                                                        >
                                                            <Pencil size={16} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                    <Menu shadow="md" width={180} position="bottom-end">
                                                        <Menu.Target>
                                                            <ActionIcon variant="subtle" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                                                <MoreVertical size={16} />
                                                            </ActionIcon>
                                                        </Menu.Target>
                                                        <Menu.Dropdown style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
                                                            <Menu.Label style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Danger Zone</Menu.Label>
                                                            <Menu.Item
                                                                style={{ color: isProtected(role.name) ? 'rgba(239,68,68,0.35)' : '#ef4444', borderRadius: 8 }}
                                                                leftSection={<Trash size={14} />}
                                                                disabled={isProtected(role.name)}
                                                                onClick={() => handleDelete(role)}
                                                            >
                                                                Delete Role
                                                            </Menu.Item>
                                                        </Menu.Dropdown>
                                                    </Menu>
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>

                    {/* Empty */}
                    {roles.data.length === 0 && (
                        <Stack align="center" py={60}>
                            <Shield size={48} strokeWidth={1} style={{ color: 'rgba(255,255,255,0.2)' }} />
                            <Text mt="md" style={{ color: 'rgba(255,255,255,0.4)' }}>No roles found.</Text>
                        </Stack>
                    )}

                    {/* Pagination */}
                    {roles.data.length > 0 && (
                        <Group justify="space-between" mt="xl">
                            <Text size="sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                Showing {roles.data.length} of {roles.total} roles
                            </Text>
                            <Pagination
                                total={roles.last_page}
                                value={roles.current_page}
                                onChange={(page) => router.get(`${url}?page=${page}`)}
                                radius="md"
                                color="yellow"
                                styles={{
                                    control: {
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        color: 'rgba(255,255,255,0.7)',
                                    }
                                }}
                            />
                        </Group>
                    )}
                </Paper>
            </Stack>
        </AdminLayout>
    );
}
