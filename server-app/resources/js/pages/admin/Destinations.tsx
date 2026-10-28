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
    Divider,
    TextInput,
    rem
} from '@mantine/core';
import { 
    Plus, 
    Search, 
    MapPin, 
    Navigation, 
    Clock, 
    Compass, 
    Pencil, 
    Trash, 
    Eye,
    Filter,
    Mountain,
    Palmtree,
    Building2,
    History,
    Trees,
    Flame,
    Landmark,
    Info,
    ArrowRight
} from 'lucide-react';

interface Destination {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    state: string;
    region: string | null;
    type?: string | null;
    latitude: number | null;
    longitude: number | null;
    popular_routes: string[] | null;
    distance_from_guwahati: number | null;
    estimated_travel_time: number | null;
    best_time_to_visit: string[] | null;
    attractions: string[] | null;
    images: string[] | null;
    is_active: boolean;
    sort_order: number | null;
}

interface DestinationsProps {
    title: string;
    destinations: {
        data: Destination[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}

export default function Destinations({ title, destinations }: DestinationsProps) {
    const { url } = usePage();

    const getTypeConfig = (type: string) => {
        const configs: Record<string, { color: string; icon: React.ReactNode }> = {
            city: { color: 'blue', icon: <Building2 size={12} /> },
            hill_station: { color: 'green', icon: <Mountain size={12} /> },
            beach: { color: 'cyan', icon: <Palmtree size={12} /> },
            historical: { color: 'orange', icon: <History size={12} /> },
            cultural: { color: 'purple', icon: <History size={12} /> },
            nature: { color: 'teal', icon: <Trees size={12} /> },
            adventure: { color: 'red', icon: <Flame size={12} /> },
            religious: { color: 'indigo', icon: <Landmark size={12} /> }
        };
        return configs[type && type.toLowerCase()] || { color: 'gray', icon: <MapPin size={12} /> };
    };

    const handleFilter = (key: string, value: string | null) => {
        const params = new URLSearchParams(window.location.search);
        if (value) params.set(key, value);
        else params.delete(key);
        router.get(`/admin/destinations?${params.toString()}`);
    };

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this destination?')) {
            router.delete(`/admin/destinations/${id}`);
        }
    };

    return (
        <AdminLayout title={title}>
            <Head title="Destinations Management" />

            <Stack gap="lg">
                <Paper p="xl" radius="md" withBorder shadow="xs">
                    <Group justify="space-between" mb="xl">
                        <Group gap="md" style={{ flex: 1 }}>
                            <TextInput
                                placeholder="Search destinations..."
                                leftSection={<Search size={16} />}
                                radius="md"
                                style={{ flex: 1, maxWidth: 300 }}
                            />
                            <Select
                                placeholder="Type"
                                data={[
                                    { value: 'city', label: 'City' },
                                    { value: 'hill_station', label: 'Hill Station' },
                                    { value: 'beach', label: 'Beach' },
                                    { value: 'historical', label: 'Historical' },
                                    { value: 'nature', label: 'Nature' },
                                    { value: 'adventure', label: 'Adventure' },
                                ]}
                                value={new URLSearchParams(window.location.search).get('type')}
                                onChange={(val) => handleFilter('type', val)}
                                clearable
                                radius="md"
                                style={{ width: 140 }}
                            />
                            <Select
                                placeholder="State"
                                data={[
                                    { value: 'assam', label: 'Assam' },
                                    { value: 'meghalaya', label: 'Meghalaya' },
                                    { value: 'arunachal_pradesh', label: 'Arunachal' },
                                    { value: 'sikkim', label: 'Sikkim' },
                                ]}
                                value={new URLSearchParams(window.location.search).get('state')}
                                onChange={(val) => handleFilter('state', val)}
                                clearable
                                radius="md"
                                style={{ width: 140 }}
                            />
                        </Group>
                        <Button 
                            component={Link} 
                            href="/admin/destinations/create" 
                            leftSection={<Plus size={16} />}
                            radius="md"
                        >
                            Add Destination
                        </Button>
                    </Group>

                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xl">
                        {destinations.data.map((dest ) => {
                            const destinationType = dest.type || 'destination';
                            const typeConfig = getTypeConfig(destinationType);
                            return (
                                <Card key={dest.id} shadow="sm" padding="xl" radius="md" withBorder>
                                    <Card.Section>
                                        {dest.images && dest.images.length > 0 ? (
                                            <Image
                                                src={dest.images[0]}
                                                height={180}
                                                alt={dest.name}
                                                fallbackSrc="https://placehold.co/600x400?text=No+Image"
                                            />
                                        ) : (
                                            <Box h={180} bg="gray.1" style={{ display: 'flex', alignItems: 'center', justify: 'center' }}>
                                                <Compass size={40} color="var(--mantine-color-gray-3)" strokeWidth={1} />
                                            </Box>
                                        )}
                                    </Card.Section>

                                    <Stack mt="md" gap="xs">
                                        <Group justify="space-between" align="flex-start">
                                            <Stack gap={2}>
                                                <Text fw={800} size="lg" lineClamp={1}>{dest.name}</Text>
                                                <Group gap={4}>
                                                    <MapPin size={12} color="gray" />
                                                    <Text size="xs" color="dimmed" tt="uppercase" fw={700}>{dest.state}</Text>
                                                </Group>
                                            </Stack>
                                            <Badge color={dest.is_active ? 'green' : 'red'}>
                                                {dest.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </Group>

                                        <Group gap={6} mt={4}>
                                            <Badge 
                                                variant="light" 
                                                color={typeConfig.color} 
                                                leftSection={typeConfig.icon}
                                                size="sm"
                                            >
                                                {destinationType.replace(/_/g, ' ')}
                                            </Badge>
                                            {dest.region && (
                                                <Badge variant="outline" color="gray" size="sm">
                                                    {dest.region.replace('_', ' ')}
                                                </Badge>
                                            )}
                                        </Group>

                                        <Text size="sm" color="dimmed" lineClamp={2} mt="xs" style={{ height: '40px' }}>
                                            {dest.description || 'Discover the beauty and culture of this destination.'}
                                        </Text>

                                        <Divider my="sm" />

                                        <SimpleGrid cols={2} spacing="xs">
                                            <Box>
                                                <Text size="xs" color="dimmed" fw={700}>DISTANCE</Text>
                                                <Group gap={4}>
                                                    <Navigation size={12} color="var(--mantine-color-blue-6)" />
                                                    <Text size="sm" fw={600}>{dest.distance_from_guwahati || 'N/A'} km</Text>
                                                </Group>
                                            </Box>
                                            <Box>
                                                <Text size="xs" color="dimmed" fw={700}>TRAVEL TIME</Text>
                                                <Group gap={4}>
                                                    <Clock size={12} color="var(--mantine-color-blue-6)" />
                                                    <Text size="sm" fw={600}>{dest.estimated_travel_time || 'N/A'} hrs</Text>
                                                </Group>
                                            </Box>
                                        </SimpleGrid>

                                        {dest.attractions && dest.attractions.length > 0 && (
                                            <Box mt="sm">
                                                <Text size="xs" color="dimmed" fw={700} mb={4}>TOP ATTRACTIONS</Text>
                                                <Group gap={4}>
                                                    {dest.attractions.slice(0, 2).map((attr, i) => (
                                                        <Badge key={i} variant="dot" color="blue" size="xs">{attr}</Badge>
                                                    ))}
                                                    {dest.attractions.length > 2 && (
                                                        <Text size="xs" color="dimmed">+{dest.attractions.length - 2}</Text>
                                                    )}
                                                </Group>
                                            </Box>
                                        )}
                                    </Stack>

                                    <Group mt="xl" gap="sm">
                                        <Button 
                                            component={Link} 
                                            href={`/admin/destinations/${dest.id}`} 
                                            variant="filled" 
                                            color="blue"
                                            style={{ flex: 1 }}
                                            rightSection={<ArrowRight size={14} />}
                                        >
                                            Manage
                                        </Button>
                                        <Tooltip label="Edit Destination">
                                            <ActionIcon 
                                                component={Link} 
                                                href={`/admin/destinations/${dest.id}/edit`} 
                                                variant="light" 
                                                color="yellow" 
                                                size="lg"
                                            >
                                                <Pencil size={18} />
                                            </ActionIcon>
                                        </Tooltip>
                                        <Tooltip label="Remove Destination">
                                            <ActionIcon 
                                                onClick={() => handleDelete(dest.id)} 
                                                variant="light" 
                                                color="red" 
                                                size="lg"
                                            >
                                                <Trash size={18} />
                                            </ActionIcon>
                                        </Tooltip>
                                    </Group>
                                </Card>
                            );
                        })}
                    </SimpleGrid>

                    {destinations.data.length === 0 ? (
                        <Stack align="center" py={60}>
                            <Compass size={60} strokeWidth={1} color="gray" />
                            <Text color="dimmed" mt="md" fw={500}>No destinations found. Expand your search or add a new one.</Text>
                        </Stack>
                    ) : (
                        <Group justify="space-between" mt="xl">
                            <Text size="sm" color="dimmed">
                                Showing {destinations.data.length} of {destinations.total} destinations
                            </Text>
                            <Pagination 
                                total={destinations.last_page} 
                                value={destinations.current_page} 
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
