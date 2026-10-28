import React, { useState } from 'react';
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
    Select, 
    Avatar,
    Tooltip,
    Stack,
    Box,
    TextInput,
    Divider,
    Menu,
    rem
} from '@mantine/core';
import { 
    Search, 
    Filter, 
    Eye, 
    Car, 
    MapPin, 
    Calendar, 
    Clock, 
    IndianRupee,
    User,
    CheckCircle2,
    XCircle,
    MoreVertical,
    Navigation,
    Truck
} from 'lucide-react';

interface RideBooking {
    id: number;
    booking_number: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    pickup_location: string;
    dropoff_location?: string;
    scheduled_at: string;
    total_fare: number;
    status: string;
    payment_status: string;
    driver?: {
        id: number;
        name: string;
    };
    created_at: string;
}

interface RideBookingsProps {
    title: string;
    ride_bookings: {
        data: RideBooking[];
        current_page: number;
        last_page: number;
        total: number;
    };
}

export default function RideBookings({ title, ride_bookings }: RideBookingsProps) {
    const { url } = usePage();
    const [statusFilter, setStatusFilter] = useState('');

    const getStatusProps = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'pending') return { color: 'yellow', label: 'Pending' };
        if (s === 'confirmed') return { color: 'blue', label: 'Confirmed' };
        if (s === 'driver_assigned') return { color: 'cyan', label: 'Assigned' };
        if (s === 'driver_arriving') return { color: 'indigo', label: 'Arriving' };
        if (s === 'pickup') return { color: 'orange', label: 'Picked Up' };
        if (s === 'in_transit') return { color: 'teal', label: 'In Transit' };
        if (s === 'completed') return { color: 'green', label: 'Completed' };
        if (s === 'cancelled') return { color: 'red', label: 'Cancelled' };
        return { color: 'gray', label: status };
    };

    const handleStatusUpdate = (id: number, status: string) => {
        router.post(`/admin/ride-bookings/${id}/update-status`, { status }, {
            preserveScroll: true,
            onSuccess: () => {
                // Handled by Inertia flash/reload
            }
        });
    };

    const handleFilterChange = (val: string | null) => {
        setStatusFilter(val || '');
        router.get('/admin/ride-bookings', { status: val || '' }, { preserveState: true });
    };

    return (
        <AdminLayout title={title}>
            <Head title="Ride Bookings" />

            <Stack gap="lg">
                <Paper p="xl" radius="md" withBorder>
                    <Group justify="space-between" mb="xl">
                        <Group gap="md" style={{ flex: 1 }}>
                            <TextInput
                                placeholder="Search by booking #, customer, or phone..."
                                leftSection={<Search size={16} />}
                                radius="md"
                                style={{ flex: 1, maxWidth: 400 }}
                            />
                            <Select
                                placeholder="Filter Status"
                                data={[
                                    { value: 'pending', label: 'Pending' },
                                    { value: 'confirmed', label: 'Confirmed' },
                                    { value: 'driver_assigned', label: 'Driver Assigned' },
                                    { value: 'in_transit', label: 'In Transit' },
                                    { value: 'completed', label: 'Completed' },
                                    { value: 'cancelled', label: 'Cancelled' },
                                ]}
                                value={statusFilter}
                                onChange={handleFilterChange}
                                clearable
                                radius="md"
                                style={{ width: 200 }}
                            />
                        </Group>
                    </Group>

                    <Table.ScrollContainer minWidth={1000}>
                        <Table verticalSpacing="md" highlightOnHover>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Booking</Table.Th>
                                    <Table.Th>Customer</Table.Th>
                                    <Table.Th>Trip Path</Table.Th>
                                    <Table.Th>Assigned Driver</Table.Th>
                                    <Table.Th>Fare & Status</Table.Th>
                                    <Table.Th />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {ride_bookings.data.map((booking) => {
                                    const statusProps = getStatusProps(booking.status);
                                    return (
                                        <Table.Tr key={booking.id}>
                                            <Table.Td>
                                                <Stack gap={2}>
                                                    <Text size="sm" fw={700}>{booking.booking_number}</Text>
                                                    <Text size="xs" color="dimmed">
                                                        {new Date(booking.created_at).toLocaleDateString()}
                                                    </Text>
                                                </Stack>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap="sm">
                                                    <Avatar color="blue" radius="xl" size="sm">
                                                        {booking.customer_name?.charAt(0)}
                                                    </Avatar>
                                                    <Stack gap={0}>
                                                        <Text size="sm" fw={600}>{booking.customer_name}</Text>
                                                        <Text size="xs" color="dimmed">{booking.customer_phone}</Text>
                                                    </Stack>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Stack gap={4}>
                                                    <Group gap={6}>
                                                        <MapPin size={12} color="var(--mantine-color-blue-6)" />
                                                        <Text size="xs" fw={500} lineClamp={1} className='max-w-[200px]'>
                                                            {booking.pickup_location}
                                                        </Text>
                                                    </Group>
                                                    <Group gap={6}>
                                                        <Navigation size={12} color="var(--mantine-color-red-6)" />
                                                        <Text size="xs" color="dimmed" lineClamp={1} className='max-w-[200px]'>
                                                            {booking.dropoff_location || 'Point to Point'}
                                                        </Text>
                                                    </Group>
                                                </Stack>
                                            </Table.Td>
                                            <Table.Td>
                                                {booking.driver ? (
                                                    <Group gap="xs">
                                                        <ThemeIcon variant="light" color="teal" size="sm" radius="xl">
                                                            <Truck size={10} />
                                                        </ThemeIcon>
                                                        <Text size="sm" fw={500}>{booking.driver.name}</Text>
                                                    </Group>
                                                ) : (
                                                    <Badge variant="outline" color="gray" size="sm">Not Assigned</Badge>
                                                )}
                                            </Table.Td>
                                            <Table.Td>
                                                <Stack gap={4}>
                                                    <Group gap={4}>
                                                        <IndianRupee size={14} />
                                                        <Text size="sm" fw={700}>{booking.total_fare}</Text>
                                                    </Group>
                                                    <Badge variant="light" color={statusProps.color} size="xs" radius="sm">
                                                        {statusProps.label}
                                                    </Badge>
                                                </Stack>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap={4} justify="flex-end">
                                                    <Tooltip label="Manage Details">
                                                        <ActionIcon 
                                                            variant="light" 
                                                            color="blue" 
                                                            component={Link} 
                                                            href={`/admin/ride-bookings/${booking.id}`}
                                                        >
                                                            <Eye size={16} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                    
                                                    <Menu shadow="md" width={180} position="bottom-end">
                                                        <Menu.Target>
                                                            <ActionIcon variant="subtle" color="gray">
                                                                <MoreVertical size={16} />
                                                            </ActionIcon>
                                                        </Menu.Target>
                                                        <Menu.Dropdown>
                                                            <Menu.Label>Update Status</Menu.Label>
                                                            <Menu.Item onClick={() => handleStatusUpdate(booking.id, 'confirmed')}>Confirm</Menu.Item>
                                                            <Menu.Item onClick={() => handleStatusUpdate(booking.id, 'cancelled')} color="red">Cancel</Menu.Item>
                                                            {booking.status === 'in_transit' && (
                                                                <Menu.Item onClick={() => handleStatusUpdate(booking.id, 'completed')} color="green">Mark Completed</Menu.Item>
                                                            )}
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

                    {ride_bookings.data.length === 0 ? (
                        <Stack align="center" py="xl">
                             <Car size={48} strokeWidth={1} color="gray" />
                            <Text color="dimmed">No ride bookings found matching your search.</Text>
                        </Stack>
                    ) : (
                        <Group justify="space-between" mt="xl">
                            <Text size="sm" color="dimmed">
                                Showing {ride_bookings.data.length} of {ride_bookings.total} bookings
                            </Text>
                            <Pagination 
                                total={ride_bookings.last_page} 
                                value={ride_bookings.current_page} 
                                onChange={(page) => router.get(`${url}?page=${page}`)}
                                radius="md"
                            />
                        </Group>
                    )}
                </Paper>
            </Stack>
        </AdminLayout>
    );
}

// Helper to keep ThemeIcon available if needed
const ThemeIcon = ({ children, variant, color, size, radius }: any) => (
    <Box 
        style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: size === 'sm' ? '24px' : '32px',
            height: size === 'sm' ? '24px' : '32px',
            borderRadius: radius === 'xl' ? '999px' : '8px',
            backgroundColor: variant === 'light' ? `var(--mantine-color-${color}-1)` : `var(--mantine-color-${color}-filled)`,
            color: variant === 'light' ? `var(--mantine-color-${color}-7)` : 'white'
        }}
    >
        {children}
    </Box>
);
