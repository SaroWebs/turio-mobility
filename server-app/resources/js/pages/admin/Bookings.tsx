import { Head, Link, router } from '@inertiajs/react';
import {
    ActionIcon,
    Avatar,
    Badge,
    Button,
    Group,
    Pagination,
    Paper,
    Select,
    Stack,
    Table,
    Tabs,
    Text,
    TextInput,
    Tooltip,
} from '@mantine/core';
import { CalendarDays, Car, Eye, MapPinned, Plus, Search, TicketCheck } from 'lucide-react';
import { useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';

type Tab = 'ride' | 'tour' | 'rental';

interface PageSet<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
}

interface RideBooking {
    id: number;
    booking_number: string;
    customer_name: string;
    customer_phone: string;
    pickup_location: string;
    dropoff_location?: string;
    scheduled_at: string;
    total_fare: number;
    status: string;
    payment_status: string;
    driver?: { name: string };
}

interface TourBooking {
    id: number;
    booking_number: string;
    total_price: number;
    status: string;
    payment_status: string;
    customer?: { name: string; phone: string };
    schedule?: { departure_date: string; tour?: { title: string } };
}

interface RentalBooking {
    id: number;
    booking_number: string;
    customer_name: string;
    customer_phone: string;
    start_date: string;
    end_date: string;
    pickup_location: string;
    total_price: number;
    status: string;
    payment_status: string;
    car_category?: { name: string };
    carCategory?: { name: string };
}

interface Props {
    rides: PageSet<RideBooking>;
    tours: PageSet<TourBooking>;
    rentals: PageSet<RentalBooking>;
    filters: { tab: Tab; search: string; status: string };
}

const statusColor = (status: string) => {
    const normalized = status.toLowerCase();

    if (['completed', 'paid'].includes(normalized)) return 'green';
    if (['cancelled', 'failed'].includes(normalized)) return 'red';
    if (['pending', 'payment_pending'].includes(normalized)) return 'yellow';
    if (['in_progress', 'in_transit', 'driver_assigned'].includes(normalized)) return 'cyan';
    return 'blue';
};

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const date = (value?: string) => (value ? new Date(value).toLocaleDateString() : 'Not scheduled');

export default function Bookings({ rides, tours, rentals, filters }: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const activeTab = filters.tab || 'ride';

    const navigate = (values: Record<string, string | number>) => {
        router.get('/admin/bookings', { tab: activeTab, search, status: filters.status, ...values }, { preserveState: true, replace: true });
    };

    const changeTab = (value: string | null) => {
        if (!value) return;
        router.get('/admin/bookings', { tab: value }, { preserveState: true, replace: true });
    };

    const submitSearch = () => navigate({ search, [`${activeTab}_page`]: 1 });
    const statusOptions = [
        { value: 'pending', label: 'Pending' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'driver_assigned', label: 'Driver assigned' },
        { value: 'in_progress', label: 'In progress' },
        { value: 'in_transit', label: 'In transit' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
    ];

    const pagination = (set: PageSet<unknown>, pageKey: string) => set.total > 0 && (
        <Group justify="space-between" mt="xl">
            <Text size="sm" c="dimmed">Showing {set.data.length} of {set.total}</Text>
            <Pagination total={set.last_page} value={set.current_page} onChange={(page) => navigate({ [pageKey]: page })} />
        </Group>
    );

    return (
        <AdminLayout title="Bookings">
            <Head title="Bookings" />
            <Stack gap="lg">
                <Paper p="lg" radius="md" withBorder>
                    <Group justify="space-between" align="flex-end" gap="md">
                        <Group align="flex-end" gap="sm" style={{ flex: 1 }}>
                            <TextInput
                                label="Search bookings"
                                placeholder="Reference, customer, or phone"
                                leftSection={<Search size={16} />}
                                value={search}
                                onChange={(event) => setSearch(event.currentTarget.value)}
                                onKeyDown={(event) => event.key === 'Enter' && submitSearch()}
                                style={{ flex: 1, maxWidth: 420 }}
                            />
                            <Button variant="light" onClick={submitSearch}>Search</Button>
                            <Select
                                label="Status"
                                placeholder="All statuses"
                                data={statusOptions}
                                value={filters.status || null}
                                onChange={(status) => navigate({ status: status || '', [`${activeTab}_page`]: 1 })}
                                clearable
                                w={190}
                            />
                        </Group>
                        {activeTab === 'rental' && (
                            <Button component={Link} href="/admin/car-rentals/create" leftSection={<Plus size={16} />}>New rental</Button>
                        )}
                    </Group>
                </Paper>

                <Paper radius="md" withBorder>
                    <Tabs value={activeTab} onChange={changeTab} keepMounted={false}>
                        <Tabs.List px="lg" pt="md">
                            <Tabs.Tab value="ride" leftSection={<Car size={16} />}>Ride bookings <Badge size="xs" variant="light">{rides.total}</Badge></Tabs.Tab>
                            <Tabs.Tab value="tour" leftSection={<MapPinned size={16} />}>Tour bookings <Badge size="xs" variant="light">{tours.total}</Badge></Tabs.Tab>
                            <Tabs.Tab value="rental" leftSection={<TicketCheck size={16} />}>Car rentals <Badge size="xs" variant="light">{rentals.total}</Badge></Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="ride" p="lg">
                            <Table.ScrollContainer minWidth={900}>
                                <Table verticalSpacing="md" highlightOnHover>
                                    <Table.Thead><Table.Tr><Table.Th>Booking</Table.Th><Table.Th>Customer</Table.Th><Table.Th>Route</Table.Th><Table.Th>Driver</Table.Th><Table.Th>Fare</Table.Th><Table.Th>Status</Table.Th><Table.Th /></Table.Tr></Table.Thead>
                                    <Table.Tbody>{rides.data.map((booking) => (
                                        <Table.Tr key={booking.id}>
                                            <Table.Td><Text fw={700} size="sm">{booking.booking_number}</Text><Text size="xs" c="dimmed">{date(booking.scheduled_at)}</Text></Table.Td>
                                            <Table.Td><Group gap="sm"><Avatar size="sm" radius="xl">{booking.customer_name?.charAt(0)}</Avatar><div><Text size="sm" fw={600}>{booking.customer_name}</Text><Text size="xs" c="dimmed">{booking.customer_phone}</Text></div></Group></Table.Td>
                                            <Table.Td><Text size="sm" lineClamp={1}>{booking.pickup_location}</Text><Text size="xs" c="dimmed" lineClamp={1}>to {booking.dropoff_location || 'destination'}</Text></Table.Td>
                                            <Table.Td><Text size="sm">{booking.driver?.name || 'Not assigned'}</Text></Table.Td>
                                            <Table.Td><Text fw={600} size="sm">{money(booking.total_fare)}</Text><Text size="xs" c="dimmed">{booking.payment_status}</Text></Table.Td>
                                            <Table.Td><Badge variant="light" color={statusColor(booking.status)}>{booking.status.replaceAll('_', ' ')}</Badge></Table.Td>
                                            <Table.Td><Tooltip label="View ride"><ActionIcon component={Link} href={`/admin/ride-bookings/${booking.id}`} variant="light"><Eye size={16} /></ActionIcon></Tooltip></Table.Td>
                                        </Table.Tr>
                                    ))}</Table.Tbody>
                                </Table>
                            </Table.ScrollContainer>
                            {rides.data.length === 0 && <Text ta="center" c="dimmed" py="xl">No ride bookings match these filters.</Text>}
                            {pagination(rides, 'ride_page')}
                        </Tabs.Panel>

                        <Tabs.Panel value="tour" p="lg">
                            <Table.ScrollContainer minWidth={820}>
                                <Table verticalSpacing="md" highlightOnHover>
                                    <Table.Thead><Table.Tr><Table.Th>Booking</Table.Th><Table.Th>Customer</Table.Th><Table.Th>Tour</Table.Th><Table.Th>Departure</Table.Th><Table.Th>Amount</Table.Th><Table.Th>Status</Table.Th><Table.Th /></Table.Tr></Table.Thead>
                                    <Table.Tbody>{tours.data.map((booking) => (
                                        <Table.Tr key={booking.id}>
                                            <Table.Td><Text fw={700} size="sm">{booking.booking_number}</Text></Table.Td>
                                            <Table.Td><Text size="sm" fw={600}>{booking.customer?.name || 'Customer'}</Text><Text size="xs" c="dimmed">{booking.customer?.phone}</Text></Table.Td>
                                            <Table.Td><Text size="sm">{booking.schedule?.tour?.title || 'Tour'}</Text></Table.Td>
                                            <Table.Td><Group gap={6}><CalendarDays size={14} /><Text size="sm">{date(booking.schedule?.departure_date)}</Text></Group></Table.Td>
                                            <Table.Td><Text fw={600} size="sm">{money(booking.total_price)}</Text><Text size="xs" c="dimmed">{booking.payment_status}</Text></Table.Td>
                                            <Table.Td><Badge variant="light" color={statusColor(booking.status)}>{booking.status.replaceAll('_', ' ')}</Badge></Table.Td>
                                            <Table.Td><Tooltip label="View tour booking"><ActionIcon component={Link} href={`/admin/tour-bookings/${booking.id}`} variant="light"><Eye size={16} /></ActionIcon></Tooltip></Table.Td>
                                        </Table.Tr>
                                    ))}</Table.Tbody>
                                </Table>
                            </Table.ScrollContainer>
                            {tours.data.length === 0 && <Text ta="center" c="dimmed" py="xl">No tour bookings match these filters.</Text>}
                            {pagination(tours, 'tour_page')}
                        </Tabs.Panel>

                        <Tabs.Panel value="rental" p="lg">
                            <Table.ScrollContainer minWidth={900}>
                                <Table verticalSpacing="md" highlightOnHover>
                                    <Table.Thead><Table.Tr><Table.Th>Booking</Table.Th><Table.Th>Customer</Table.Th><Table.Th>Vehicle</Table.Th><Table.Th>Pickup</Table.Th><Table.Th>Dates</Table.Th><Table.Th>Amount & status</Table.Th><Table.Th /></Table.Tr></Table.Thead>
                                    <Table.Tbody>{rentals.data.map((booking) => (
                                        <Table.Tr key={booking.id}>
                                            <Table.Td><Text fw={700} size="sm">{booking.booking_number}</Text></Table.Td>
                                            <Table.Td><Text size="sm" fw={600}>{booking.customer_name}</Text><Text size="xs" c="dimmed">{booking.customer_phone}</Text></Table.Td>
                                            <Table.Td><Text size="sm">{booking.car_category?.name || booking.carCategory?.name || 'Vehicle'}</Text></Table.Td>
                                            <Table.Td><Text size="sm" lineClamp={1}>{booking.pickup_location}</Text></Table.Td>
                                            <Table.Td><Text size="sm">{date(booking.start_date)}</Text><Text size="xs" c="dimmed">to {date(booking.end_date)}</Text></Table.Td>
                                            <Table.Td><Text fw={600} size="sm">{money(booking.total_price)}</Text><Badge mt={4} variant="light" color={statusColor(booking.status)}>{booking.status.replaceAll('_', ' ')}</Badge></Table.Td>
                                            <Table.Td><Tooltip label="View rental"><ActionIcon component={Link} href={`/admin/car-rentals/${booking.id}`} variant="light"><Eye size={16} /></ActionIcon></Tooltip></Table.Td>
                                        </Table.Tr>
                                    ))}</Table.Tbody>
                                </Table>
                            </Table.ScrollContainer>
                            {rentals.data.length === 0 && <Text ta="center" c="dimmed" py="xl">No car rentals match these filters.</Text>}
                            {pagination(rentals, 'rental_page')}
                        </Tabs.Panel>
                    </Tabs>
                </Paper>
            </Stack>
        </AdminLayout>
    );
}
