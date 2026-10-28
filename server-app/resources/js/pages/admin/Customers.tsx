import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '../../layouts/AdminLayout';
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
    Stack,
    Tooltip,
} from '@mantine/core';
import {
    Search,
    MoreVertical,
    Eye,
    MessageSquare,
    ExternalLink,
} from 'lucide-react';

interface Customer {
    id: number;
    name: string;
    email: string;
    phone: string;
    status: 'active' | 'suspended';
    ride_bookings_count: number;
    car_rentals_count: number;
    bookings_count: number;
    created_at: string;
}

interface CustomersProps {
    title: string;
    customers: {
        data: Customer[];
        current_page: number;
        last_page: number;
        total: number;
    };
    filters: {
        search: string;
        status: string;
    };
}

export default function Customers({ title, customers, filters }: CustomersProps) {
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || '');

    const handleSearch = (value: string) => {
        setSearch(value);
        router.get('/admin/customers', { search: value, status }, { preserveState: true, replace: true });
    };

    const handleStatusFilter = (value: string | null) => {
        setStatus(value || '');
        router.get('/admin/customers', { search, status: value }, { preserveState: true, replace: true });
    };

    const handlePageChange = (page: number) => {
        router.get('/admin/customers', { search, status, page }, { preserveState: true });
    };

    const toggleStatus = (customer: Customer) => {
        router.post(`/admin/customers/${customer.id}/toggle-status`, {}, {
            preserveScroll: true,
            onSuccess: () => {
            }
        });
    };

    return (
        <AdminLayout title={title}>
            <Head title="Customers" />

            <Stack gap="xl">
                <Paper
                    p="xl"
                    radius="md"
                    style={{
                        background: 'rgba(17,17,17,0.6)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        backdropFilter: 'blur(12px)',
                    }}
                >
                    <Group justify="space-between" mb="xl">
                        <Group gap="md" style={{ flex: 1 }}>
                            <TextInput
                                placeholder="Search customers by name, email or phone..."
                                leftSection={<Search size={16} />}
                                value={search}
                                onChange={(e) => handleSearch(e.currentTarget.value)}
                                style={{ flex: 1, maxWidth: 400 }}
                                radius="md"
                                styles={{
                                    input: {
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        color: 'rgba(255,255,255,0.85)',
                                    }
                                }}
                            />
                            <Select
                                placeholder="Status"
                                data={[
                                    { value: 'active', label: 'Active' },
                                    { value: 'suspended', label: 'Suspended' }
                                ]}
                                value={status}
                                onChange={handleStatusFilter}
                                clearable
                                radius="md"
                                style={{ width: 150 }}
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
                            color="blue"
                            radius="md"
                            leftSection={<ExternalLink size={16} />}
                        >
                            Add Customer
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
                                    <Table.Th>Customer</Table.Th>
                                    <Table.Th>Phone</Table.Th>
                                    <Table.Th>Activity</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Registered</Table.Th>
                                    <Table.Th />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {customers.data.map((customer) => (
                                    <Table.Tr key={customer.id}>
                                        <Table.Td>
                                            <Group gap="sm">
                                                <Avatar
                                                    radius="xl"
                                                    style={{
                                                        background: 'rgba(59,130,246,0.15)',
                                                        border: '1px solid rgba(59,130,246,0.2)',
                                                        color: '#3b82f6',
                                                    }}
                                                >
                                                    {customer.name.charAt(0)}
                                                </Avatar>
                                                <Stack gap={0}>
                                                    <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.9)' }}>
                                                        {customer.name}
                                                    </Text>
                                                    <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                                        {customer.email}
                                                    </Text>
                                                </Stack>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
                                                {customer.phone}
                                            </Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap={4}>
                                                <Badge variant="dot" color="blue" size="sm">
                                                    {customer.ride_bookings_count} Rides
                                                </Badge>
                                                <Badge variant="dot" color="teal" size="sm">
                                                    {customer.car_rentals_count} Rentals
                                                </Badge>
                                                <Badge variant="dot" color="grape" size="sm">
                                                    {customer.bookings_count} Tours
                                                </Badge>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge
                                                variant="light"
                                                radius="sm"
                                                style={{
                                                    background: customer.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                                                    color: customer.status === 'active' ? '#22c55e' : '#ef4444',
                                                    border: `1px solid ${customer.status === 'active' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
                                                }}
                                            >
                                                {customer.status}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                                {new Date(customer.created_at).toLocaleDateString()}
                                            </Text>
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
                                                        href={`/admin/customers/${customer.id}`}
                                                    >
                                                        <Eye size={16} />
                                                    </ActionIcon>
                                                </Tooltip>
                                                <Menu shadow="md" width={200} position="bottom-end" transitionProps={{ transition: 'pop-top-right' }}>
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
                                                            Actions
                                                        </Menu.Label>
                                                        <Menu.Item
                                                            leftSection={<MessageSquare size={14} />}
                                                            onClick={() => window.open(`https://wa.me/${customer.phone.replace(/\D/g,'')}`, '_blank')}
                                                        >
                                                            WhatsApp Contact
                                                        </Menu.Item>
                                                        {customer.status === 'suspended' ? (
                                                            <Menu.Item
                                                                color="green"
                                                                onClick={() => toggleStatus(customer)}
                                                            >
                                                                Activate Customer
                                                            </Menu.Item>
                                                        ) : (
                                                            <Menu.Item
                                                                color="red"
                                                                onClick={() => toggleStatus(customer)}
                                                            >
                                                                Suspend Customer
                                                            </Menu.Item>
                                                        )}
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
                        <Text size="sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            Showing {customers.data.length} of {customers.total} customers
                        </Text>
                        <Pagination
                            total={customers.last_page}
                            value={customers.current_page}
                            onChange={handlePageChange}
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
                </Paper>
            </Stack>
        </AdminLayout>
    );
}