import React from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '../../../layouts/AdminLayout';
import {
    Table,
    Badge,
    Text,
    Group,
    ActionIcon,
    Button,
    Paper,
    Pagination,
    Avatar,
    Tooltip,
    Stack,
    Menu,
    TextInput,
} from '@mantine/core';
import {
    Search,
    Plus,
    Eye,
    Pencil,
    Trash,
    MoreVertical,
    User,
    Shield,
} from 'lucide-react';
import { AdminUser, UsersIndexProps } from '@/types';


const getRoleColor = (role: string) => {
    const r = role.toLowerCase();
    if (r === 'admin') return { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' };
    if (r === 'guide') return { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' };
    if (r === 'driver') return { bg: 'rgba(20,184,166,0.15)', text: '#14b8a6' };
    return { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.6)' };
};

export default function UsersIndex({ title, users, roles }: UsersIndexProps) {
    const { url } = usePage();

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this staff member?')) {
            router.delete(`/admin/users/${id}`);
        }
    };

    return (
        <AdminLayout title={title}>
            <Head title="Staff Management" />

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
                    <Group justify="space-between" mb="xl">
                        <Group gap="md" style={{ flex: 1 }}>
                            <TextInput
                                placeholder="Search by name, email, or phone..."
                                leftSection={<Search size={16} />}
                                radius="md"
                                style={{ flex: 1, maxWidth: 400 }}
                                styles={{
                                    input: {
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        color: 'rgba(255,255,255,0.85)',
                                    }
                                }}
                            />
                        </Group>
                        <Button
                            component={Link}
                            href="/admin/users/create"
                            leftSection={<Plus size={16} />}
                            radius="md"
                            style={{
                                background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                                border: 'none',
                                color: '#000',
                                fontWeight: 600,
                            }}
                        >
                            Add New Staff
                        </Button>
                    </Group>

                    <Table.ScrollContainer minWidth={800}>
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
                                    <Table.Th>Staff Member</Table.Th>
                                    <Table.Th>Contact Info</Table.Th>
                                    <Table.Th>Roles & Permissions</Table.Th>
                                    <Table.Th />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {users.data.map((user) => {
                                    const primaryRole = user.roles[0];
                                    const roleColor = primaryRole ? getRoleColor(primaryRole.name) : getRoleColor('user');
                                    return (
                                        <Table.Tr key={user.id}>
                                            <Table.Td>
                                                <Group gap="sm">
                                                    <Avatar
                                                        radius="xl"
                                                        size="md"
                                                        style={{
                                                            background: `${roleColor.text}20`,
                                                            border: `1px solid ${roleColor.text}40`,
                                                            color: roleColor.text,
                                                        }}
                                                    >
                                                        {user.name.charAt(0)}
                                                    </Avatar>
                                                    <Stack gap={0}>
                                                        <Text size="sm" fw={700} style={{ color: 'rgba(255,255,255,0.9)' }}>
                                                            {user.name}
                                                        </Text>
                                                        <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                                            ID: #USR-{user.id}
                                                        </Text>
                                                    </Stack>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Stack gap={4}>
                                                    <Group gap={6}>
                                                        <Text size="xs" fw={500} style={{ color: 'rgba(255,255,255,0.85)' }}>
                                                            {user.email}
                                                        </Text>
                                                    </Group>
                                                    <Group gap={6}>
                                                        <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                                            {user.phone}
                                                        </Text>
                                                    </Group>
                                                </Stack>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap={4}>
                                                    {user.roles.map((role) => {
                                                        const color = getRoleColor(role.name);
                                                        return (
                                                            <Badge
                                                                key={role.id}
                                                                size="xs"
                                                                variant="light"
                                                                style={{
                                                                    background: color.bg,
                                                                    color: color.text,
                                                                    border: `1px solid ${color.text}40`,
                                                                }}
                                                                leftSection={<Shield size={10} />}
                                                                radius="sm"
                                                            >
                                                                {role.name}
                                                            </Badge>
                                                        );
                                                    })}
                                                    {user.roles.length === 0 && (
                                                        <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                                            No roles assigned
                                                        </Text>
                                                    )}
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap={4} justify="flex-end">
                                                    <Tooltip label="View Details">
                                                        <ActionIcon
                                                            variant="light"
                                                            style={{
                                                                background: 'rgba(59,130,246,0.1)',
                                                                color: '#3b82f6',
                                                                border: '1px solid rgba(59,130,246,0.2)',
                                                            }}
                                                            component={Link}
                                                            href={`/admin/users/${user.id}`}
                                                        >
                                                            <Eye size={16} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                    <Tooltip label="Edit Staff">
                                                        <ActionIcon
                                                            variant="light"
                                                            style={{
                                                                background: 'rgba(251,191,36,0.1)',
                                                                color: '#fbbf24',
                                                                border: '1px solid rgba(251,191,36,0.2)',
                                                            }}
                                                            component={Link}
                                                            href={`/admin/users/${user.id}/edit`}
                                                        >
                                                            <Pencil size={16} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                    <Menu shadow="md" width={180} position="bottom-end" transitionProps={{ transition: 'pop-top-right' }}>
                                                        <Menu.Target>
                                                            <ActionIcon variant="subtle" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                                                <MoreVertical size={16} />
                                                            </ActionIcon>
                                                        </Menu.Target>
                                                        <Menu.Dropdown
                                                            style={{
                                                                background: '#111',
                                                                border: '1px solid rgba(255,255,255,0.08)',
                                                                borderRadius: 10,
                                                            }}
                                                        >
                                                            <Menu.Label style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: '0.08em' }}>
                                                                Danger Zone
                                                            </Menu.Label>
                                                            <Menu.Item
                                                                style={{ color: '#ef4444', borderRadius: 8 }}
                                                                leftSection={<Trash size={14} />}
                                                                onClick={() => handleDelete(user.id)}
                                                            >
                                                                Delete Staff
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

                    {users.data.length === 0 ? (
                        <Stack align="center" py={60}>
                            <User size={48} strokeWidth={1} style={{ color: 'rgba(255,255,255,0.2)' }} />
                            <Text mt="md" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                No staff members found.
                            </Text>
                        </Stack>
                    ) : (
                        <Group justify="space-between" mt="xl">
                            <Text size="sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                Showing {users.data.length} of {users.total} staff members
                            </Text>
                            <Pagination
                                total={users.last_page}
                                value={users.current_page}
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
