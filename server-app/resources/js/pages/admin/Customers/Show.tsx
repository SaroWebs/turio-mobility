import React from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import { 
    Grid, 
    Paper, 
    Text, 
    Group, 
    Stack, 
    Avatar, 
    Badge, 
    Tabs, 
    Table, 
    Button, 
    ActionIcon, 
    Divider,
    SimpleGrid,
    Box,
    Card,
    ThemeIcon,
    Tooltip
} from '@mantine/core';
import { 
    User, 
    Phone, 
    Mail, 
    Calendar, 
    Wallet, 
    Car, 
    Map, 
    ClipboardList, 
    ArrowLeft, 
    Clock, 
    CreditCard, 
    Ban, 
    Check,
    ChevronRight,
    MapPin,
    ExternalLink,
    IndianRupee
} from 'lucide-react';

interface Customer {
    id: number;
    name: string;
    email: string;
    phone: string;
    status: 'active' | 'suspended';
    date_of_birth?: string | null;
    gender?: 'male' | 'female' | 'other' | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
    created_at: string;
    ride_bookings: any[];
    car_rentals: any[];
    bookings: any[];
    wallet?: {
        balance: number;
    };
}

interface CustomerShowProps {
    title: string;
    customer: Customer;
    stats: {
        total_rides: number;
        total_rentals: number;
        total_tours: number;
        total_spent: number;
        wallet_balance: number;
    };
}

export default function CustomerShow({ title, customer, stats }: CustomerShowProps) {
    const toggleStatus = () => {
        router.post(`/admin/customers/${customer.id}/toggle-status`, {}, {
            preserveScroll: true
        });
    };

    return (
        <AdminLayout title={title}>
            <Head title={`Customer: ${customer.name}`} />

            <Stack gap="lg">
                <Group justify="space-between">
                    <Button 
                        variant="subtle" 
                        color="gray" 
                        leftSection={<ArrowLeft size={16} />}
                        component={Link}
                        href="/admin/customers"
                    >
                        Back to Customers
                    </Button>
                    <Group gap="sm">
                        <Button 
                            variant="outline" 
                            color={customer.status === 'active' ? 'red' : 'green'} 
                            leftSection={customer.status === 'active' ? <Ban size={16} /> : <Check size={16} />}
                            onClick={toggleStatus}
                        >
                            {customer.status === 'active' ? 'Suspend' : 'Activate'}
                        </Button>
                        <Button 
                            variant="filled" 
                            color="blue"
                            component={Link}
                            href={`/admin/customers/${customer.id}/edit`}
                        >
                            Edit Details
                        </Button>
                    </Group>
                </Group>

                <Grid gutter="lg">
                    {/* Customer Profile Sidebar */}
                    <Grid.Col span={{ base: 12, md: 4 }}>
                        <Stack gap="lg">
                            <Paper p="xl" radius="md" withBorder>
                                <Stack align="center" gap="md">
                                    <Avatar size={100} radius="xl" color="blue" src={null}>
                                        {customer.name.charAt(0)}
                                    </Avatar>
                                    <Stack align="center" gap={4}>
                                        <Text size="xl" fw={700}>{customer.name}</Text>
                                        <Badge 
                                            variant="light" 
                                            color={customer.status === 'active' ? 'green' : 'red'}
                                            size="lg"
                                        >
                                            {customer.status}
                                        </Badge>
                                    </Stack>
                                </Stack>

                                <Divider my="xl" />

                                <Stack gap="sm">
                                    <Group gap="md">
                                        <ThemeIcon variant="light" color="gray" radius="md">
                                            <Phone size={16} />
                                        </ThemeIcon>
                                        <div>
                                            <Text size="xs" color="dimmed">Phone Number</Text>
                                            <Text size="sm" fw={500}>{customer.phone}</Text>
                                        </div>
                                    </Group>
                                    <Group gap="md">
                                        <ThemeIcon variant="light" color="gray" radius="md">
                                            <Mail size={16} />
                                        </ThemeIcon>
                                        <div>
                                            <Text size="xs" color="dimmed">Email Address</Text>
                                            <Text size="sm" fw={500}>{customer.email}</Text>
                                        </div>
                                    </Group>
                                    <Group gap="md">
                                        <ThemeIcon variant="light" color="gray" radius="md">
                                            <Calendar size={16} />
                                        </ThemeIcon>
                                        <div>
                                            <Text size="xs" color="dimmed">Member Since</Text>
                                            <Text size="sm" fw={500}>{new Date(customer.created_at).toLocaleDateString()}</Text>
                                        </div>
                                    </Group>

                                    {customer.date_of_birth && (
                                        <Group gap="md">
                                            <ThemeIcon variant="light" color="gray" radius="md">
                                                <Calendar size={16} />
                                            </ThemeIcon>
                                            <div>
                                                <Text size="xs" color="dimmed">Date of Birth</Text>
                                                <Text size="sm" fw={500}>{new Date(customer.date_of_birth).toLocaleDateString()}</Text>
                                            </div>
                                        </Group>
                                    )}

                                    {customer.gender && (
                                        <Group gap="md">
                                            <ThemeIcon variant="light" color="gray" radius="md">
                                                <User size={16} />
                                            </ThemeIcon>
                                            <div>
                                                <Text size="xs" color="dimmed">Gender</Text>
                                                <Text size="sm" fw={500} style={{ textTransform: 'capitalize' }}>{customer.gender}</Text>
                                            </div>
                                        </Group>
                                    )}

                                    {customer.emergency_contact_name && (
                                        <Group gap="md">
                                            <ThemeIcon variant="light" color="gray" radius="md">
                                                <User size={16} />
                                            </ThemeIcon>
                                            <div>
                                                <Text size="xs" color="dimmed">Emergency Contact</Text>
                                                <Text size="sm" fw={500}>
                                                    {customer.emergency_contact_name} 
                                                    {customer.emergency_contact_phone && ` (${customer.emergency_contact_phone})`}
                                                </Text>
                                            </div>
                                        </Group>
                                    )}
                                </Stack>
                            </Paper>

                            <Paper p="xl" radius="md" withBorder bg="blue.9">
                                <Group justify="space-between" mb="xs">
                                     <Text color="blue.1" size="xs" fw={700} tt="uppercase">Wallet Balance</Text>
                                     <Wallet size={16} color="white" />
                                </Group>
                                <Text color="white" size="h1" fw={800}>₹{parseFloat(stats.wallet_balance.toString()).toLocaleString()}</Text>
                                <Button fullWidth variant="white" color="blue.9" mt="xl" size="sm">Add Credits</Button>
                            </Paper>
                        </Stack>
                    </Grid.Col>

                    {/* Customer Activity and Tabs */}
                    <Grid.Col span={{ base: 12, md: 8 }}>
                        <Stack gap="lg">
                            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
                                <Card padding="lg" radius="md" withBorder>
                                    <Stack gap={4}>
                                        <Text size="xs" color="dimmed" fw={700} tt="uppercase">Total Rides</Text>
                                        <Group gap="xs">
                                            <Car size={18} color="var(--mantine-color-blue-6)" />
                                            <Text size="xl" fw={700}>{stats.total_rides}</Text>
                                        </Group>
                                    </Stack>
                                </Card>
                                <Card padding="lg" radius="md" withBorder>
                                    <Stack gap={4}>
                                        <Text size="xs" color="dimmed" fw={700} tt="uppercase">Car Rentals</Text>
                                        <Group gap="xs">
                                            <MapPin size={18} color="var(--mantine-color-teal-6)" />
                                            <Text size="xl" fw={700}>{stats.total_rentals}</Text>
                                        </Group>
                                    </Stack>
                                </Card>
                                <Card padding="lg" radius="md" withBorder>
                                    <Stack gap={4}>
                                        <Text size="xs" color="dimmed" fw={700} tt="uppercase">Total Spent</Text>
                                        <Group gap="xs">
                                            <IndianRupee size={18} color="var(--mantine-color-green-6)" />
                                            <Text size="xl" fw={700}>₹{parseFloat(stats.total_spent.toString()).toLocaleString()}</Text>
                                        </Group>
                                    </Stack>
                                </Card>
                            </SimpleGrid>

                            <Paper radius="md" withBorder>
                                <Tabs defaultValue="rides" variant="outline">
                                    <Tabs.List px="md" pt="md">
                                        <Tabs.Tab value="rides" leftSection={<Car size={14} />}>Ride Activity</Tabs.Tab>
                                        <Tabs.Tab value="tours" leftSection={<Map size={14} />}>Tour Bookings</Tabs.Tab>
                                        <Tabs.Tab value="rentals" leftSection={<ClipboardList size={14} />}>Car Rentals</Tabs.Tab>
                                    </Tabs.List>

                                    <Tabs.Panel value="rides" p="md">
                                        <Table verticalSpacing="sm" highlightOnHover>
                                            <Table.Thead>
                                                <Table.Tr>
                                                    <Table.Th>Booking #</Table.Th>
                                                    <Table.Th>Date</Table.Th>
                                                    <Table.Th>Route</Table.Th>
                                                    <Table.Th>Status</Table.Th>
                                                    <Table.Th>Fare</Table.Th>
                                                    <Table.Th />
                                                </Table.Tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                                {customer.ride_bookings.length > 0 ? customer.ride_bookings.map((ride) => (
                                                    <Table.Tr key={ride.id}>
                                                        <Table.Td><Text size="sm" fw={500}>#{ride.booking_number}</Text></Table.Td>
                                                        <Table.Td><Text size="xs">{new Date(ride.scheduled_at).toLocaleDateString()}</Text></Table.Td>
                                                        <Table.Td>
                                                            <Text size="xs" lineClamp={1}>{ride.pickup_location} → {ride.dropoff_location}</Text>
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <Badge size="xs" variant="light" color={ride.status === 'completed' ? 'green' : 'blue'}>{ride.status}</Badge>
                                                        </Table.Td>
                                                        <Table.Td><Text size="sm" fw={600}>₹{ride.total_fare}</Text></Table.Td>
                                                        <Table.Td>
                                                            <ActionIcon variant="subtle" color="gray" component={Link} href={`/admin/ride-bookings/${ride.id}`}>
                                                                <ExternalLink size={14} />
                                                            </ActionIcon>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                )) : (
                                                    <Table.Tr><Table.Td colSpan={6} py="xl"><Text ta="center" color="dimmed">No ride history found</Text></Table.Td></Table.Tr>
                                                )}
                                            </Table.Tbody>
                                        </Table>
                                    </Tabs.Panel>

                                    <Tabs.Panel value="tours" p="md">
                                        <Table verticalSpacing="sm">
                                            {/* Similar table for tours */}
                                            <Table.Tbody>
                                                 {customer.bookings.length > 0 ? customer.bookings.map((tour) => (
                                                    <Table.Tr key={tour.id}>
                                                        <Table.Td><Text size="sm" fw={500}>{tour.tour?.title}</Text></Table.Td>
                                                        <Table.Td><Text size="xs">{new Date(tour.travel_date).toLocaleDateString()}</Text></Table.Td>
                                                        <Table.Td><Badge size="xs" variant="light">{tour.status}</Badge></Table.Td>
                                                        <Table.Td><Text size="sm" fw={600}>₹{tour.total_price}</Text></Table.Td>
                                                        <Table.Td>
                                                            <ActionIcon variant="subtle" color="gray" component={Link} href={`/admin/bookings/${tour.id}`}>
                                                                <ExternalLink size={14} />
                                                            </ActionIcon>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                )) : (
                                                    <Table.Tr><Table.Td colSpan={5} py="xl"><Text ta="center" color="dimmed">No tour bookings found</Text></Table.Td></Table.Tr>
                                                )}
                                            </Table.Tbody>
                                        </Table>
                                    </Tabs.Panel>

                                    <Tabs.Panel value="rentals" p="md">
                                         <Table verticalSpacing="sm">
                                            {/* Similar table for rentals */}
                                            <Table.Tbody>
                                                 {customer.car_rentals.length > 0 ? customer.car_rentals.map((rental) => (
                                                    <Table.Tr key={rental.id}>
                                                        <Table.Td><Text size="sm" fw={500}>#{rental.booking_number}</Text></Table.Td>
                                                        <Table.Td><Text size="xs">{new Date(rental.start_date).toLocaleDateString()}</Text></Table.Td>
                                                        <Table.Td><Badge size="xs" variant="light">{rental.status}</Badge></Table.Td>
                                                        <Table.Td><Text size="sm" fw={600}>₹{rental.total_price}</Text></Table.Td>
                                                        <Table.Td>
                                                            <ActionIcon variant="subtle" color="gray" component={Link} href={`/admin/car-rentals/${rental.id}`}>
                                                                <ExternalLink size={14} />
                                                            </ActionIcon>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                )) : (
                                                    <Table.Tr><Table.Td colSpan={5} py="xl"><Text ta="center" color="dimmed">No car rentals found</Text></Table.Td></Table.Tr>
                                                )}
                                            </Table.Tbody>
                                        </Table>
                                    </Tabs.Panel>
                                </Tabs>
                            </Paper>
                        </Stack>
                    </Grid.Col>
                </Grid>
            </Stack>
        </AdminLayout>
    );
}
