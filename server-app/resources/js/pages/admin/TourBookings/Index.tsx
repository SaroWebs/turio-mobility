import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import {
    ActionIcon,
    Badge,
    Group,
    Pagination,
    Paper,
    Stack,
    Table,
    Text,
    TextInput,
    Tooltip,
} from '@mantine/core';
import { Eye, Search } from 'lucide-react';

interface TourBooking {
    id: number;
    booking_number: string;
    total_price: string;
    status: string;
    payment_status: string;
    customer?: {
        name: string;
        phone: string;
    };
    schedule?: {
        departure_date: string;
        tour?: {
            title: string;
        };
    };
}

interface TourBookingsProps {
    title: string;
    bookings: {
        data: TourBooking[];
        current_page: number;
        last_page: number;
        total: number;
    };
    filters?: {
        search?: string;
    };
}

export default function TourBookings({ title, bookings, filters }: TourBookingsProps) {
    const [search, setSearch] = useState(filters?.search || '');

    const handleSearch = (value: string) => {
        setSearch(value);
        router.get('/admin/tour-bookings', { search: value }, { preserveState: true, replace: true });
    };

    const handlePageChange = (page: number) => {
        router.get('/admin/tour-bookings', { search, page }, { preserveState: true });
    };

    return (
        <AdminLayout title={title}>
            <Head title="Tour Bookings" />

            <Stack gap="lg">
                <Paper p="xl" radius="md" withBorder shadow="sm">
                    <Group justify="space-between" mb="xl">
                        <TextInput
                            placeholder="Search reference, customer name..."
                            leftSection={<Search size={16} />}
                            value={search}
                            onChange={(event) => handleSearch(event.currentTarget.value)}
                            style={{ flex: 1, maxWidth: 400 }}
                            radius="md"
                        />
                    </Group>

                    <Table.ScrollContainer minWidth={800}>
                        <Table verticalSpacing="md" highlightOnHover>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Reference</Table.Th>
                                    <Table.Th>Customer</Table.Th>
                                    <Table.Th>Tour & Date</Table.Th>
                                    <Table.Th>Amount</Table.Th>
                                    <Table.Th>Payment</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {bookings.data.map((booking) => (
                                    <Table.Tr key={booking.id}>
                                        <Table.Td>
                                            <Text fw={600} size="sm">{booking.booking_number}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="sm">{booking.customer?.name}</Text>
                                            <Text size="xs" color="dimmed">{booking.customer?.phone}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="sm">{booking.schedule?.tour?.title}</Text>
                                            <Text size="xs" color="dimmed">Departure: {booking.schedule?.departure_date}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="sm" fw={500}>₹{booking.total_price}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge color={booking.payment_status === 'paid' ? 'green' : 'orange'}>
                                                {booking.payment_status}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge
                                                variant="light"
                                                color={booking.status === 'confirmed' ? 'green' : booking.status === 'cancelled' ? 'red' : 'blue'}
                                            >
                                                {booking.status}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap={8} justify="flex-end">
                                                <Tooltip label="View Details">
                                                    <ActionIcon color="blue" variant="light" component={Link} href={`/admin/tour-bookings/${booking.id}`}>
                                                        <Eye size={16} />
                                                    </ActionIcon>
                                                </Tooltip>
                                            </Group>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>

                    <Group justify="space-between" mt="xl">
                        <Text size="sm" color="dimmed">
                            Showing {bookings.data.length} of {bookings.total} bookings
                        </Text>
                        <Pagination
                            total={bookings.last_page}
                            value={bookings.current_page}
                            onChange={handlePageChange}
                        />
                    </Group>
                </Paper>
            </Stack>
        </AdminLayout>
    );
}
