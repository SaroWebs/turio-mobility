import React from 'react';
import { Head, Link, usePage, router } from '@inertiajs/react';
import AdminLayout from '../../layouts/AdminLayout';
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
    Box,
    SimpleGrid,
    Card,
    Image,
    Divider,
    Avatar
} from '@mantine/core';
import { 
    Plus, 
    Eye, 
    Pencil, 
    Calendar, 
    Users, 
    MapPin, 
    Clock, 
    IndianRupee,
    ChevronRight,
    Search,
    Filter,
    MapIcon,
    CarIcon
} from 'lucide-react';

interface Tour {
    id: number;
    title: string;
    description: string;
    price?: number;
    price_per_person?: number;
    available_from: string;
    available_to: string;
    itineraries_count?: number;
    guides?: Array<{
        id: number;
    }>;
    drivers?: Array<{
        id: number;
    }>;
    schedules?: Array<{
        id: number;
        driver_assignments?: Array<{
            id: number;
        }>;
    }>;
    is_active?: boolean;
}

interface ToursProps {
    title: string;
    tours: {
        data: Tour[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}

export default function Tours({ title, tours }: ToursProps) {
    const { url } = usePage();
    const getTourPrice = (tour: Tour) => Number(tour.price_per_person ?? tour.price ?? 0);
    const getDriverCount = (tour: Tour) => {
        if (Array.isArray(tour.drivers)) {
            return tour.drivers.length;
        }

        return (tour.schedules ?? []).reduce((count, schedule) => (
            count + (schedule.driver_assignments?.length ?? 0)
        ), 0);
    };
    const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString() : 'Not scheduled';

    return (
        <AdminLayout title={title}>
            <Head title="Tour Management" />

            <Stack gap="lg">
                <Paper p="md" radius="md" withBorder>
                    <Group justify="space-between">
                        <Group>
                             <Text fw={700}>Filter & Search</Text>
                             <Divider orientation="vertical" />
                             <Group gap="xs">
                                <Button variant="light" size="compact-sm" leftSection={<Filter size={14} />}>Status</Button>
                                <Button variant="light" size="compact-sm" leftSection={<Calendar size={14} />}>Date Range</Button>
                             </Group>
                        </Group>
                        <Button 
                            component={Link} 
                            href="/admin/tours/create" 
                            leftSection={<Plus size={16} />}
                            radius="md"
                        >
                            Add New Tour
                        </Button>
                    </Group>
                </Paper>

                <Paper p="xl" radius="md" withBorder>
                    <Table.ScrollContainer minWidth={800}>
                        <Table verticalSpacing="md" highlightOnHover>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Tour Details</Table.Th>
                                    <Table.Th>Pricing</Table.Th>
                                    <Table.Th>Schedule</Table.Th>
                                    <Table.Th>Inventory/Staff</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {tours.data.map((tour) => (
                                    <Table.Tr key={tour.id}>
                                        <Table.Td>
                                            <Group gap="sm">
                                                <Box 
                                                    w={50} h={50} 
                                                    bg="gray.1" 
                                                    style={{ borderRadius: '8px', display: 'flex', alignItems: 'center', justify: 'center' }}
                                                >
                                                    <MapIcon size={24} color="var(--mantine-color-blue-4)" />
                                                </Box>
                                                <Stack gap={0}>
                                                    <Text size="sm" fw={700}>{tour.title}</Text>
                                                    <Text size="xs" color="dimmed" lineClamp={1}>
                                                        {tour.description}
                                                    </Text>
                                                </Stack>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap={4}>
                                                <IndianRupee size={14} />
                                                <Text size="sm" fw={700}>{getTourPrice(tour).toLocaleString()}</Text>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            <Stack gap={4}>
                                                <Group gap={6}>
                                                    <Clock size={12} color="gray" />
                                                    <Text size="xs" fw={500}>{tour.itineraries_count || 0} Day(s)</Text>
                                                </Group>
                                                <Text size="xs" color="dimmed">
                                                    {formatDate(tour.available_from)} - {formatDate(tour.available_to)}
                                                </Text>
                                            </Stack>
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap="xs">
                                                <Tooltip label="Assigned Guides">
                                                    <Badge variant="light" leftSection={<Users size={12} />}>{tour.guides?.length ?? 0}</Badge>
                                                </Tooltip>
                                                <Tooltip label="Assigned Drivers">
                                                    <Badge variant="light" color="teal" leftSection={<CarIcon size={12} />}>{getDriverCount(tour)}</Badge>
                                                </Tooltip>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge color={tour.is_active === false ? 'gray' : 'green'} variant="dot">
                                                {tour.is_active === false ? 'Inactive' : 'Active'}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap={4} justify="flex-end">
                                                <Tooltip label="View Details">
                                                    <ActionIcon 
                                                        variant="light" 
                                                        color="blue" 
                                                        component={Link} 
                                                        href={`/admin/tours/${tour.id}`}
                                                    >
                                                        <Eye size={16} />
                                                    </ActionIcon>
                                                </Tooltip>
                                                <Tooltip label="Edit Tour">
                                                    <ActionIcon 
                                                        variant="light" 
                                                        color="yellow" 
                                                        component={Link} 
                                                        href={`/admin/tours/${tour.id}/edit`}
                                                    >
                                                        <Pencil size={16} />
                                                    </ActionIcon>
                                                </Tooltip>
                                            </Group>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>

                    {tours.data.length === 0 ? (
                        <Stack align="center" py="xl">
                            <Text color="dimmed">No tours available. Create your first tour package.</Text>
                            <Button variant="outline" component={Link} href="/admin/tours/create">Establish First Tour</Button>
                        </Stack>
                    ) : (
                        <Group justify="space-between" mt="xl">
                            <Text size="sm" color="dimmed">
                                Showing {tours.data.length} of {tours.total} tours
                            </Text>
                            <Pagination 
                                total={tours.last_page} 
                                value={tours.current_page} 
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
