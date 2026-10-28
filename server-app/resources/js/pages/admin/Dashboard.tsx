import React from 'react';
import { Head, Link } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import {
    Grid,
    Paper,
    Text,
    Group,
    Stack,
    RingProgress,
    ThemeIcon,
    SimpleGrid,
    Table,
    Badge,
    Avatar,
    Button,
} from '@mantine/core';
import { Users, TruckIcon, Map, Calendar } from 'lucide-react';

interface DashboardProps {
    title: string;
    user: any;
    stats: {
        total_users: number;
        total_customers: number;
        total_drivers: number;
        total_tours: number;
        total_bookings: number;
        total_ride_bookings: number;
        total_places: number;
        active_tours: number;
        recent_bookings: any[];
    };
    recent_users: any[];
    upcoming_tours: any[];
}

const statColors = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];

export default function Dashboard({ title, user, stats, recent_users, upcoming_tours }: DashboardProps) {
    const statCards = [
        { title: 'Total Customers', value: stats.total_customers, icon: Users, diff: 12 },
        { title: 'Available Drivers', value: stats.total_drivers, icon: TruckIcon, diff: 5 },
        { title: 'Ride Bookings', value: stats.total_ride_bookings, icon: Map, diff: -3 },
        { title: 'Tour Bookings', value: stats.total_bookings, icon: Map, diff: 8 },
    ];

    return (
        <AdminLayout title={title}>
            <Head title="Dashboard" />

            <Stack gap="xl">
                {/* Stats Section */}
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
                    {statCards.map((stat, i) => (
                        <Paper
                            key={stat.title}
                            p="xl"
                            radius="md"
                            style={{
                                background: 'rgba(17,17,17,0.6)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                backdropFilter: 'blur(12px)',
                            }}
                        >
                            <Group justify="space-between" mb="xs">
                                <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                    {stat.title}
                                </Text>
                                <ThemeIcon
                                    variant="light"
                                    radius="md"
                                    size="lg"
                                    style={{
                                        background: `${statColors[i]}20`,
                                        color: statColors[i],
                                    }}
                                >
                                    <stat.icon size={20} strokeWidth={1.5} />
                                </ThemeIcon>
                            </Group>

                            <Group align="flex-end" gap="xs">
                                <Text size="h2" fw={700} style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1 }}>
                                    {stat.value}
                                </Text>
                                <Badge
                                    size="xs"
                                    radius="sm"
                                    variant="light"
                                    style={{
                                        background: stat.diff > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                                        color: stat.diff > 0 ? '#22c55e' : '#ef4444',
                                        border: `1px solid ${stat.diff > 0 ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
                                    }}
                                >
                                    {Math.abs(stat.diff)}%
                                </Badge>
                            </Group>

                            <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)', marginTop: 7 }}>
                                Compared to previous month
                            </Text>
                        </Paper>
                    ))}
                </SimpleGrid>

                <Grid gutter="lg">
                    {/* Recent Tour Bookings / Bookings Table */}
                    <Grid.Col span={{ base: 12, lg: 8 }}>
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
                                <Text fw={700} size="lg" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                    Recent Tour Bookings
                                </Text>
                                <Button
                                    component={Link}
                                    href="/admin/tour-bookings"
                                    size="compact-sm"
                                    variant="light"
                                    style={{
                                        background: 'rgba(251,191,36,0.1)',
                                        color: '#fbbf24',
                                        border: '1px solid rgba(251,191,36,0.2)',
                                    }}
                                >
                                    View All
                                </Button>
                            </Group>

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
                                        <Table.Th>Tour</Table.Th>
                                        <Table.Th>Date</Table.Th>
                                        <Table.Th>Amount</Table.Th>
                                        <Table.Th>Status</Table.Th>
                                        <Table.Th />
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {stats.recent_bookings.map((booking) => (
                                        <Table.Tr key={booking.id}>
                                            <Table.Td>
                                                <Group gap="sm">
                                                    <Avatar
                                                        radius="xl"
                                                        size="sm"
                                                        style={{
                                                            background: 'rgba(59,130,246,0.15)',
                                                            border: '1px solid rgba(59,130,246,0.2)',
                                                            color: '#3b82f6',
                                                        }}
                                                    >
                                                        {booking.customer?.name?.charAt(0)}
                                                    </Avatar>
                                                    <Stack gap={0}>
                                                        <Text size="sm" fw={500} style={{ color: 'rgba(255,255,255,0.9)' }}>
                                                            {booking.customer?.name}
                                                        </Text>
                                                        <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                                            {booking.customer?.phone}
                                                        </Text>
                                                    </Stack>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm" lineClamp={1} style={{ color: 'rgba(255,255,255,0.7)' }}>
                                                    {booking.tour?.title}
                                                </Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                                    {new Date(booking.travel_date).toLocaleDateString()}
                                                </Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap={4}>
                                                    <Text size="sm" fw={600} style={{ color: '#fbbf24' }}>
                                                        ₹{parseFloat(booking.total_price).toLocaleString()}
                                                    </Text>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge
                                                    size="xs"
                                                    radius="sm"
                                                    variant="light"
                                                    style={{
                                                        background: booking.status === 'confirmed' ? 'rgba(34,197,94,0.15)' : booking.status === 'pending' ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.08)',
                                                        color: booking.status === 'confirmed' ? '#22c55e' : booking.status === 'pending' ? '#fbbf24' : 'rgba(255,255,255,0.6)',
                                                        border: `1px solid ${booking.status === 'confirmed' ? 'rgba(34,197,94,0.4)' : booking.status === 'pending' ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.15)'}`,
                                                    }}
                                                >
                                                    {booking.status}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                <Button
                                                    component={Link}
                                                    href={`/admin/tour-bookings/${booking.id}`}
                                                    variant="subtle"
                                                    size="xs"
                                                    style={{ color: 'rgba(255,255,255,0.4)' }}
                                                >
                                                    Details
                                                </Button>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Paper>
                    </Grid.Col>

                    {/* Quick Stats / Mini Alerts */}
                    <Grid.Col span={{ base: 12, lg: 4 }}>
                        <Stack gap="lg">
                            <Paper
                                p="xl"
                                radius="md"
                                style={{
                                    background: 'rgba(17,17,17,0.6)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    backdropFilter: 'blur(12px)',
                                }}
                            >
                                <Text size="lg" fw={700} mb="md" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                    System Overview
                                </Text>
                                <Stack gap="sm">
                                    <Group justify="space-between">
                                        <Text size="sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Active Tours</Text>
                                        <Badge variant="filled" style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e' }}>
                                            {stats.active_tours}
                                        </Badge>
                                    </Group>
                                    <Group justify="space-between">
                                        <Text size="sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Registered Users</Text>
                                        <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.85)' }}>{stats.total_users}</Text>
                                    </Group>
                                    <Group justify="space-between">
                                        <Text size="sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Total Service Areas</Text>
                                        <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.85)' }}>{stats.total_places}</Text>
                                    </Group>
                                </Stack>

                                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '24px 0' }} />

                                <Text size="sm" fw={600} mb="xs" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                    Activity Index
                                </Text>
                                <Group gap="md">
                                    <RingProgress
                                        size={80}
                                        thickness={8}
                                        roundCaps
                                        sections={[{ value: 65, color: '#3b82f6' }]}
                                        label={
                                            <Text size="xs" ta="center" fw={700} style={{ color: 'rgba(255,255,255,0.9)' }}>
                                                65%
                                            </Text>
                                        }
                                    />
                                    <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)', flex: 1 }}>
                                        Booking conversion rate is currently healthy.
                                    </Text>
                                </Group>
                            </Paper>

                            <Paper
                                p="xl"
                                radius="md"
                                style={{
                                    background: 'rgba(59,130,246,0.1)',
                                    border: '1px solid rgba(59,130,246,0.2)',
                                }}
                            >
                                <Stack gap="xs">
                                    <Text fw={700} style={{ color: '#3b82f6' }}>
                                        Pro Tip
                                    </Text>
                                    <Text size="sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                        Check the Ride Bookings section to assign pending rides to your available drivers in real-time.
                                    </Text>
                                    <Button
                                        variant="light"
                                        size="compact-sm"
                                        mt="sm"
                                        component={Link}
                                        href="/admin/ride-bookings"
                                        style={{
                                            background: 'rgba(251,191,36,0.1)',
                                            color: '#fbbf24',
                                            border: '1px solid rgba(251,191,36,0.2)',
                                        }}
                                    >
                                        Manage Rides
                                    </Button>
                                </Stack>
                            </Paper>
                        </Stack>
                    </Grid.Col>
                </Grid>

                {/* Bottom Row */}
                <Grid gutter="lg">
                    <Grid.Col span={{ base: 12, md: 6 }}>
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
                                <Text fw={700} size="lg" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                    Recent Users
                                </Text>
                                <Button
                                    component={Link}
                                    href="/admin/users"
                                    variant="subtle"
                                    size="compact-sm"
                                    style={{ color: 'rgba(255,255,255,0.4)' }}
                                >
                                    View All
                                </Button>
                            </Group>
                            <Stack gap="md">
                                {recent_users.map((u) => (
                                    <Group key={u.id} justify="space-between">
                                        <Group gap="sm">
                                            <Avatar
                                                radius="xl"
                                                style={{
                                                    background: 'rgba(59,130,246,0.15)',
                                                    border: '1px solid rgba(59,130,246,0.2)',
                                                    color: '#3b82f6',
                                                }}
                                            >
                                                {u.name.charAt(0)}
                                            </Avatar>
                                            <Stack gap={0}>
                                                <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.9)' }}>
                                                    {u.name}
                                                </Text>
                                                <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                                    {u.email}
                                                </Text>
                                            </Stack>
                                        </Group>
                                        <Group gap={4}>
                                            {u.roles && u.roles.map((role: any) => (
                                                <Badge
                                                    key={role.id}
                                                    size="xs"
                                                    variant="outline"
                                                    style={{
                                                        color: '#a855f7',
                                                        borderColor: 'rgba(168,85,247,0.3)',
                                                    }}
                                                >
                                                    {role.name}
                                                </Badge>
                                            ))}
                                        </Group>
                                    </Group>
                                ))}
                            </Stack>
                        </Paper>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 6 }}>
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
                                <Text fw={700} size="lg" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                    Upcoming Tours
                                </Text>
                                <Button
                                    component={Link}
                                    href="/admin/tours"
                                    variant="subtle"
                                    size="compact-sm"
                                    style={{ color: 'rgba(255,255,255,0.4)' }}
                                >
                                    Manage Tours
                                </Button>
                            </Group>
                            <Stack gap="md">
                                {upcoming_tours.map((tour) => (
                                    <Stack
                                        key={tour.id}
                                        p="sm"
                                        style={{
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                        }}
                                        gap={4}
                                    >
                                        <Text size="sm" fw={700} style={{ color: 'rgba(255,255,255,0.9)' }}>
                                            {tour.title}
                                        </Text>
                                        <Group gap="xs">
                                            <Calendar size={14} color="rgba(255,255,255,0.3)" />
                                            <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                                {new Date(tour.available_from).toLocaleDateString()} - {new Date(tour.available_to).toLocaleDateString()}
                                            </Text>
                                        </Group>
                                    </Stack>
                                ))}
                            </Stack>
                        </Paper>
                    </Grid.Col>
                </Grid>
            </Stack>
        </AdminLayout>
    );
}
