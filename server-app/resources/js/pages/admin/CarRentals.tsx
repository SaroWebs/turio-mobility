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
    Select,
    Avatar,
    Tooltip,
    Stack,
    TextInput,
    Menu
} from '@mantine/core';
import {
    Search,
    Eye,
    Car,
    MapPin,
    Calendar,
    IndianRupee,
    MoreVertical,
    Pencil,
    Trash,
    Navigation,
    MoveRight,
    Plus
} from 'lucide-react';

interface CarRental {
    id: number;
    booking_number: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    carCategory: {
        id: number;
        name: string;
        vehicle_type: string;
    };
    start_date: string;
    end_date: string;
    pickup_location: string;
    dropoff_location: string;
    distance_km: number;
    total_price: number;
    status: string;
    payment_status: string;
    created_at: string;
}

interface CarRentalsProps {
    title: string;
    car_rentals: {
        data: CarRental[];
        current_page: number;
        last_page: number;
        total: number;
    };
}

export default function CarRentals({ title, car_rentals }: CarRentalsProps) {
    const { url } = usePage();

    const getStatusProps = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'pending') return { color: '#fbbf24', label: 'Pending' };
        if (s === 'confirmed') return { color: '#3b82f6', label: 'Confirmed' };
        if (s === 'in_progress') return { color: '#6366f1', label: 'In Progress' };
        if (s === 'completed') return { color: '#22c55e', label: 'Completed' };
        if (s === 'cancelled') return { color: '#ef4444', label: 'Cancelled' };
        return { color: 'rgba(255,255,255,0.4)', label: status };
    };

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this car rental?')) {
            router.delete(`/admin/car-rentals/${id}`);
        }
    };

    const handleFilter = (val: string | null) => {
        router.get('/admin/car-rentals', { status: val || '' }, { preserveState: true });
    };

    return (
        <AdminLayout title={title}>
            <Head title="Car Rentals" />

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
                                placeholder="Search by booking # or guest name..."
                                leftSection={<Search size={16} />}
                                radius="md"
                                style={{ flex: 1, maxWidth: 400 }}
                            />
                            <Select
                                placeholder="Status"
                                data={[
                                    { value: 'pending', label: 'Pending' },
                                    { value: 'confirmed', label: 'Confirmed' },
                                    { value: 'in_progress', label: 'In Progress' },
                                    { value: 'completed', label: 'Completed' },
                                    { value: 'cancelled', label: 'Cancelled' },
                                ]}
                                value={new URLSearchParams(window.location.search).get('status')}
                                onChange={handleFilter}
                                clearable
                                radius="md"
                                style={{ width: 200 }}
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
                            href="/admin/car-rentals/create" 
                            leftSection={<Plus size={16} />}
                            radius="md"
                            style={{
                                background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                                border: 'none',
                                color: '#000',
                                fontWeight: 600,
                            }}
                        >
                            New Rental
                        </Button>
                    </Group>

                    <Table.ScrollContainer minWidth={1000}>
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
                                    <Table.Th>Booking & Car</Table.Th>
                                    <Table.Th>Customer</Table.Th>
                                    <Table.Th>Trip Logic</Table.Th>
                                    <Table.Th>Budget & Status</Table.Th>
                                    <Table.Th />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {car_rentals.data.map((rental) => {
                                    const statusProps = getStatusProps(rental.status);
                                    return (
                                        <Table.Tr key={rental.id}>
                                            <Table.Td>
                                                <Stack gap={2}>
                                                    <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.9)', letterSpacing: '0.02em' }}>
                                                        {rental.booking_number}
                                                    </Text>
                                                    <Group gap={6}>
                                                        <Car size={12} color="#fbbf24" />
                                                        <Text size="xs" fw={500} style={{ color: '#fbbf24' }}>
                                                            {rental.carCategory?.name}
                                                        </Text>
                                                    </Group>
                                                    <Text size="xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                                                        {new Date(rental.created_at).toLocaleDateString()}
                                                    </Text>
                                                </Stack>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap="sm">
                                                    <Avatar 
                                                        color="blue" 
                                                        radius="xl" 
                                                        size="sm"
                                                        style={{
                                                            background: 'rgba(59,130,246,0.15)',
                                                            border: '1px solid rgba(59,130,246,0.2)',
                                                            color: '#3b82f6',
                                                        }}
                                                    >
                                                        {rental.customer_name?.charAt(0)}
                                                    </Avatar>
                                                    <Stack gap={0}>
                                                        <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.9)' }}>
                                                            {rental.customer_name}
                                                        </Text>
                                                        <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                                            {rental.customer_phone}
                                                        </Text>
                                                    </Stack>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Stack gap={4}>
                                                    <Group gap={6}>
                                                        <MapPin size={12} color="rgba(255,255,255,0.3)" />
                                                        <Text size="xs" fw={500} lineClamp={1} style={{ color: 'rgba(255,255,255,0.7)' }}>
                                                            {rental.pickup_location}
                                                        </Text>
                                                        <MoveRight size={10} color="rgba(255,255,255,0.2)" />
                                                        <Text size="xs" fw={500} lineClamp={1} style={{ color: 'rgba(255,255,255,0.7)' }}>
                                                            {rental.dropoff_location || 'Return'}
                                                        </Text>
                                                    </Group>
                                                    <Group gap={12}>
                                                        <Group gap={4}>
                                                            <Calendar size={12} color="rgba(255,255,255,0.3)" />
                                                            <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                                                {new Date(rental.start_date).toLocaleDateString()} - {new Date(rental.end_date).toLocaleDateString()}
                                                            </Text>
                                                        </Group>
                                                        <Group gap={4}>
                                                            <Navigation size={12} color="rgba(255,255,255,0.3)" />
                                                            <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                                                {rental.distance_km} km
                                                            </Text>
                                                        </Group>
                                                    </Group>
                                                </Stack>
                                            </Table.Td>
                                            <Table.Td>
                                                <Stack gap={4}>
                                                    <Group gap={4}>
                                                        <IndianRupee size={14} color="#fbbf24" />
                                                        <Text size="sm" fw={700} style={{ color: 'rgba(255,255,255,0.9)' }}>
                                                            {parseFloat(rental.total_price.toString()).toLocaleString()}
                                                        </Text>
                                                    </Group>
                                                    <Group gap={4}>
                                                        <Badge 
                                                            variant="light" 
                                                            style={{ 
                                                                background: `${statusProps.color}20`,
                                                                color: statusProps.color,
                                                                border: `1px solid ${statusProps.color}40`,
                                                            }} 
                                                            size="xs" 
                                                            radius="sm"
                                                        >
                                                            {statusProps.label}
                                                        </Badge>
                                                        <Badge 
                                                            variant="outline" 
                                                            style={{
                                                                color: rental.payment_status === 'paid' ? '#22c55e' : 'rgba(255,255,255,0.4)',
                                                                borderColor: rental.payment_status === 'paid' ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.15)',
                                                            }} 
                                                            size="xs" 
                                                            radius="sm"
                                                        >
                                                            {rental.payment_status}
                                                        </Badge>
                                                    </Group>
                                                </Stack>
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
                                                            href={`/admin/car-rentals/${rental.id}`}
                                                        >
                                                            <Eye size={16} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                    <Tooltip label="Edit Rental">
                                                        <ActionIcon 
                                                            variant="light" 
                                                            style={{
                                                                background: 'rgba(251,191,36,0.1)',
                                                                color: '#fbbf24',
                                                                border: '1px solid rgba(251,191,36,0.2)',
                                                            }}
                                                            component={Link} 
                                                            href={`/admin/car-rentals/${rental.id}/edit`}
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
                                                                onClick={() => handleDelete(rental.id)}
                                                            >
                                                                Delete Rental
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

                    {car_rentals.data.length === 0 ? (
                        <Stack align="center" py={60}>
                            <Car size={48} strokeWidth={1} color="rgba(255,255,255,0.2)" />
                            <Text mt="md" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                No car rentals found. Expand your search or add a new booking.
                            </Text>
                        </Stack>
                    ) : (
                        <Group justify="space-between" mt="xl">
                            <Text size="sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                Showing {car_rentals.data.length} of {car_rentals.total} rentals
                            </Text>
                            <Pagination 
                                total={car_rentals.last_page} 
                                value={car_rentals.current_page} 
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