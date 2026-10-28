import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import {
    Table,
    Badge,
    Text,
    Group,
    ActionIcon,
    TextInput,
    Button,
    Paper,
    Pagination,
    Select,
    Avatar,
    Menu,
    Tooltip,
    Stack,
    Box
} from '@mantine/core';
import {
    Search,
    MoreVertical,
    Eye,
    Check,
    Ban,
    ShieldCheck,
    Phone,
    UserPlus,
    Star
} from 'lucide-react';

interface Guide {
    id: number;
    name: string;
    email: string;
    phone: string;
    status: 'pending' | 'active' | 'suspended';
    rating: number;
    languages: string[];
    created_at: string;
}

interface GuidesProps {
    title: string;
    guides: {
        data: Guide[];
        current_page: number;
        last_page: number;
        total: number;
    };
    filters: {
        search: string;
        status: string;
    };
}

export default function Guides({ title, guides, filters }: GuidesProps) {
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || '');

    const handleSearch = (value: string) => {
        setSearch(value);
        router.get('/admin/guides', { search: value, status }, { preserveState: true, replace: true });
    };

    const handleStatusFilter = (value: string | null) => {
        setStatus(value || '');
        router.get('/admin/guides', { search, status: value }, { preserveState: true, replace: true });
    };

    const handlePageChange = (page: number) => {
        router.get('/admin/guides', { search, status, page }, { preserveState: true });
    };

    const handleApprove = (guide: Guide) => {
        router.post(`/admin/guides/${guide.id}/approve`, {}, { preserveScroll: true });
    };

    const handleSuspend = (guide: Guide) => {
        router.post(`/admin/guides/${guide.id}/suspend`, {}, { preserveScroll: true });
    };

    const handleActivate = (guide: Guide) => {
        router.post(`/admin/guides/${guide.id}/activate`, {}, { preserveScroll: true });
    };

    return (
        <AdminLayout title={title}>
            <Head title="Guides" />

            <Stack gap="lg">
                <Paper p="xl" radius="md" withBorder shadow="sm">
                    <Group justify="space-between" mb="xl">
                        <Group gap="md" style={{ flex: 1 }}>
                            <TextInput
                                placeholder="Search by name, email, or phone..."
                                leftSection={<Search size={16} />}
                                value={search}
                                onChange={(e) => handleSearch(e.currentTarget.value)}
                                style={{ flex: 1, maxWidth: 400 }}
                                radius="md"
                            />
                            <Select
                                placeholder="Status"
                                data={[
                                    { value: 'pending', label: 'Pending Approval' },
                                    { value: 'active', label: 'Active' },
                                    { value: 'suspended', label: 'Suspended' }
                                ]}
                                value={status}
                                onChange={handleStatusFilter}
                                clearable
                                radius="md"
                                style={{ width: 180 }}
                            />
                        </Group>
                        <Button color="blue" radius="md" leftSection={<UserPlus size={16} />}>
                            Add Guide
                        </Button>
                    </Group>

                    <Table.ScrollContainer minWidth={800}>
                        <Table verticalSpacing="md" highlightOnHover>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Guide Profile</Table.Th>
                                    <Table.Th>Rating</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {guides.data.map((guide) => (
                                    <Table.Tr key={guide.id}>
                                        <Table.Td>
                                            <Group gap="sm">
                                                <Avatar color="blue" radius="xl">{guide.name.charAt(0)}</Avatar>
                                                <Stack gap={0}>
                                                    <Text size="sm" fw={600}>{guide.name}</Text>
                                                    <Text size="xs" color="dimmed">{guide.phone}</Text>
                                                </Stack>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap={4}>
                                                <Star size={14} color="#fcc419" fill="#fcc419" />
                                                <Text size="sm" fw={500}>{guide.rating || 'N/A'}</Text>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge
                                                variant="light"
                                                color={
                                                    guide.status === 'active' ? 'green' :
                                                        guide.status === 'pending' ? 'yellow' : 'red'
                                                }
                                                radius="sm"
                                            >
                                                {guide.status}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap={4} justify="flex-end">
                                                <Tooltip label="View Profile">
                                                    <ActionIcon
                                                        variant="light"
                                                        color="blue"
                                                        component={Link}
                                                        href={`/admin/guides/${guide.id}`}
                                                    >
                                                        <Eye size={16} />
                                                    </ActionIcon>
                                                </Tooltip>

                                                <Menu shadow="md" width={200} position="bottom-end">
                                                    <Menu.Target>
                                                        <ActionIcon variant="subtle" color="gray">
                                                            <MoreVertical size={16} />
                                                        </ActionIcon>
                                                    </Menu.Target>

                                                    <Menu.Dropdown>
                                                        <Menu.Label>Verification</Menu.Label>
                                                        {guide.status === 'pending' && (
                                                            <Menu.Item
                                                                color="green"
                                                                leftSection={<ShieldCheck size={14} />}
                                                                onClick={() => handleApprove(guide)}
                                                            >
                                                                Approve Guide
                                                            </Menu.Item>
                                                        )}

                                                        <Menu.Label>Status Actions</Menu.Label>
                                                        {guide.status === 'suspended' ? (
                                                            <Menu.Item
                                                                color="green"
                                                                leftSection={<Check size={14} />}
                                                                onClick={() => handleActivate(guide)}
                                                            >
                                                                Activate Guide
                                                            </Menu.Item>
                                                        ) : (
                                                            <Menu.Item
                                                                color="red"
                                                                leftSection={<Ban size={14} />}
                                                                onClick={() => handleSuspend(guide)}
                                                            >
                                                                Suspend Guide
                                                            </Menu.Item>
                                                        )}

                                                        <Menu.Divider />
                                                        <Menu.Item leftSection={<Phone size={14} />}>
                                                            Contact Guide
                                                        </Menu.Item>
                                                    </Menu.Dropdown>
                                                </Menu>
                                            </Group>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>

                    <Group justify="space-between" mt="xl">
                        <Text size="sm" color="dimmed">
                            Showing {guides.data.length} of {guides.total} guides
                        </Text>
                        <Pagination
                            total={guides.last_page}
                            value={guides.current_page}
                            onChange={handlePageChange}
                            color="blue"
                            radius="md"
                        />
                    </Group>
                </Paper>
            </Stack>
        </AdminLayout>
    );
}
