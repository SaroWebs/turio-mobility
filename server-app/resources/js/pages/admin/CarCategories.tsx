import React from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '../../layouts/AdminLayout';
import { 
    SimpleGrid, 
    Card, 
    Image, 
    Text, 
    Badge, 
    Button, 
    Group, 
    Stack, 
    Paper, 
    Pagination, 
    ActionIcon, 
    Tooltip,
    Box,
    Select,
    Divider
} from '@mantine/core';
import { 
    Plus, 
    Car, 
    Users, 
    Zap, 
    Wind, 
    UserCheck, 
    Fuel, 
    Calendar, 
    IndianRupee, 
    Pencil, 
    Trash, 
    Eye,
    Filter,
    ArrowRight
} from 'lucide-react';

interface CarCategory {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    vehicle_type: string;
    seats: number;
    has_ac: boolean;
    has_driver: boolean;
    base_price_per_day: number;
    price_per_km: number;
    features: string[] | null;
    images: string[] | null;
    fuel_type: string | null;
    year: number | null;
    is_active: boolean;
    sort_order: number | null;
}

interface CarCategoriesProps {
    title: string;
    car_categories: {
        data: CarCategory[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}

export default function CarCategories({ title, car_categories }: CarCategoriesProps) {
    const { url } = usePage();

    const getVehicleTypeIcon = (type: string) => {
        // Fallback for visual representation
        return <Car size={40} color="var(--mantine-color-gray-4)" strokeWidth={1} />;
    };

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this car category?')) {
            router.delete(`/admin/car-categories/${id}`);
        }
    };

    const handleFilter = (key: string, value: string | null) => {
        const params = new URLSearchParams(window.location.search);
        if (value) params.set(key, value);
        else params.delete(key);
        router.get(`/admin/car-categories?${params.toString()}`);
    };

    return (
        <AdminLayout title={title}>
            <Head title="Car Categories" />

            <Stack gap="lg">
                <Paper p="xl" radius="md" withBorder shadow="xs">
                    <Group justify="space-between" mb="xl">
                        <Group gap="md">
                            <Select
                                placeholder="Vehicle Type"
                                data={[
                                    { value: 'sedan', label: 'Sedan' },
                                    { value: 'suv', label: 'SUV' },
                                    { value: 'hatchback', label: 'Hatchback' },
                                    { value: 'convertible', label: 'Convertible' },
                                    { value: 'van', label: 'Van' },
                                    { value: 'truck', label: 'Truck' },
                                ]}
                                value={new URLSearchParams(window.location.search).get('type')}
                                onChange={(val) => handleFilter('type', val)}
                                clearable
                                radius="md"
                                leftSection={<Filter size={16} />}
                            />
                            <Select
                                placeholder="Status"
                                data={[
                                    { value: 'true', label: 'Active' },
                                    { value: 'false', label: 'Inactive' },
                                ]}
                                value={new URLSearchParams(window.location.search).get('active')}
                                onChange={(val) => handleFilter('active', val)}
                                clearable
                                radius="md"
                            />
                        </Group>
                        <Button 
                            component={Link} 
                            href="/admin/car-categories/create" 
                            leftSection={<Plus size={16} />}
                            radius="md"
                        >
                            New Category
                        </Button>
                    </Group>

                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xl">
                        {car_categories.data.map((category) => (
                            <Card key={category.id} shadow="sm" padding="xl" radius="md" withBorder>
                                <Card.Section>
                                    {category.images && category.images.length > 0 ? (
                                        <Image
                                            src={category.images[0]}
                                            height={180}
                                            alt={category.name}
                                            fallbackSrc="https://placehold.co/600x400?text=No+Image"
                                        />
                                    ) : (
                                        <Box 
                                            h={180} 
                                            bg="gray.1" 
                                            style={{ display: 'flex', alignItems: 'center', justify: 'center' }}
                                        >
                                            {getVehicleTypeIcon(category.vehicle_type)}
                                        </Box>
                                    )}
                                </Card.Section>

                                <Stack mt="md" gap="xs">
                                    <Group justify="space-between" align="flex-start">
                                        <Stack gap={0}>
                                            <Text fw={800} size="lg">{category.name}</Text>
                                            <Text size="xs" color="dimmed" tt="uppercase" fw={700}>{category.vehicle_type}</Text>
                                        </Stack>
                                        <Badge color={category.is_active ? 'green' : 'red'}>
                                            {category.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </Group>

                                    <Text size="sm" color="dimmed" lineClamp={2} style={{ height: '40px' }}>
                                        {category.description || 'No description provided.'}
                                    </Text>

                                    <Divider my="sm" />

                                    <SimpleGrid cols={2}>
                                        <Group gap={8}>
                                            <Users size={16} color="gray" />
                                            <Text size="sm" fw={600}>{category.seats} Seats</Text>
                                        </Group>
                                        {category.has_ac && (
                                            <Group gap={8}>
                                                <Wind size={16} color="var(--mantine-color-blue-6)" />
                                                <Text size="sm" fw={600}>Full AC</Text>
                                            </Group>
                                        )}
                                        <Group gap={8}>
                                            <Fuel size={16} color="var(--mantine-color-teal-6)" />
                                            <Text size="sm" fw={600} tt="capitalize">{category.fuel_type || 'Petrol'}</Text>
                                        </Group>
                                        {category.has_driver && (
                                            <Group gap={8}>
                                                <UserCheck size={16} color="var(--mantine-color-indigo-6)" />
                                                <Text size="sm" fw={600}>With Driver</Text>
                                            </Group>
                                        )}
                                    </SimpleGrid>

                                    <Paper bg="blue.0" p="sm" radius="sm" mt="md">
                                        <Group justify="space-between">
                                            <Stack gap={0}>
                                                <Text size="xs" color="blue.9" fw={700}>DAILY RATE</Text>
                                                <Text fw={800} size="md">₹{parseFloat(category.base_price_per_day.toString()).toLocaleString()}</Text>
                                            </Stack>
                                            <Stack gap={0} align="flex-end">
                                                <Text size="xs" color="blue.9" fw={700}>PER KM</Text>
                                                <Text fw={800} size="md">₹{category.price_per_km}</Text>
                                            </Stack>
                                        </Group>
                                    </Paper>
                                </Stack>

                                <Group mt="xl" gap="sm">
                                    <Button 
                                        component={Link} 
                                        href={`/admin/car-categories/${category.id}`} 
                                        variant="filled" 
                                        color="blue"
                                        style={{ flex: 1 }}
                                        rightSection={<ArrowRight size={14} />}
                                    >
                                        Manage
                                    </Button>
                                    <Tooltip label="Edit Details">
                                        <ActionIcon 
                                            component={Link} 
                                            href={`/admin/car-categories/${category.id}/edit`} 
                                            variant="light" 
                                            color="yellow" 
                                            size="lg"
                                        >
                                            <Pencil size={18} />
                                        </ActionIcon>
                                    </Tooltip>
                                    <Tooltip label="Remove Category">
                                        <ActionIcon 
                                            onClick={() => handleDelete(category.id)} 
                                            variant="light" 
                                            color="red" 
                                            size="lg"
                                        >
                                            <Trash size={18} />
                                        </ActionIcon>
                                    </Tooltip>
                                </Group>
                            </Card>
                        ))}
                    </SimpleGrid>

                    {car_categories.data.length === 0 ? (
                        <Stack align="center" py={60}>
                            <Car size={60} strokeWidth={1} color="gray" />
                            <Text color="dimmed" mt="md" fw={500}>No car categories found matching your criteria.</Text>
                            <Button variant="outline" mt="sm">Reset All Filters</Button>
                        </Stack>
                    ) : (
                        <Group justify="space-between" mt="xl">
                            <Text size="sm" color="dimmed">
                                Showing {car_categories.data.length} of {car_categories.total} categories
                            </Text>
                            <Pagination 
                                total={car_categories.last_page} 
                                value={car_categories.current_page} 
                                onChange={(page) => router.get(`${url}?page=${page}`)}
                                radius="md"
                                color="blue"
                            />
                        </Group>
                    )}
                </Paper>
            </Stack>
        </AdminLayout>
    );
}