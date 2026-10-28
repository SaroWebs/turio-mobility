import React from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '../../layouts/AdminLayout';
import { resolveMediaUrl } from '@/lib/utils';
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
    TextInput
} from '@mantine/core';
import { 
    Plus, 
    Search, 
    MapPin, 
    Pencil, 
    Image as ImageIcon,
    Map as MapIcon,
    Camera,
    Info
} from 'lucide-react';

interface Place {
    id: number;
    name: string;
    description: string;
    longitude: number | string | null;
    latitude: number | string | null;
    is_active: boolean;
    is_featured: boolean;
    media: Array<{
        id: number;
        path: string;
        type: string;
        caption: string | null;
    }>;
}

interface PlacesProps {
    title: string;
    places: {
        data: Place[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}

export default function Places({ title, places }: PlacesProps) {
    const { url } = usePage();

    return (
        <AdminLayout title={title}>
            <Head title="Places Management" />

            <Stack gap="lg">
                <Paper p="md" radius="md" withBorder>
                    <Group justify="space-between">
                        <TextInput
                            placeholder="Search places by name..."
                            leftSection={<Search size={16} />}
                            radius="md"
                            style={{ flex: 1, maxWidth: 350 }}
                        />
                        <Button 
                            component={Link} 
                            href="/admin/places/create" 
                            leftSection={<Plus size={16} />}
                            radius="md"
                        >
                            Add New Place
                        </Button>
                    </Group>
                </Paper>

                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                    {places.data.map((place) => (
                        <Card key={place.id} shadow="sm" padding="xl" radius="md" withBorder>
                            <Card.Section>
                                {place.media && place.media.length > 0 ? (
                                    <Image
                                        src={resolveMediaUrl(place.media[0].path)}
                                        height={180}
                                        alt={place.name}
                                        fallbackSrc="https://placehold.co/600x400?text=No+Image"
                                    />
                                ) : (
                                    <Box 
                                        h={180} 
                                        bg="gray.1" 
                                        style={{ display: 'flex', alignItems: 'center', justify: 'center', flexDirection: 'column' }}
                                    >
                                        <ImageIcon size={40} color="var(--mantine-color-gray-4)" />
                                        <Text size="xs" color="dimmed" mt="xs">No Media Uploaded</Text>
                                    </Box>
                                )}
                            </Card.Section>

                            <Stack mt="md" gap="xs">
                                <Group justify="space-between">
                                    <Text fw={700} size="lg" lineClamp={1}>{place.name}</Text>
                                    <Badge color={place.is_active ? 'green' : 'gray'}>
                                        {place.is_active ? 'active' : 'inactive'}
                                    </Badge>
                                </Group>
                                {place.is_featured && <Badge variant="light" color="yellow">Featured</Badge>}

                                <Text size="sm" color="dimmed" lineClamp={2} style={{ height: '40px' }}>
                                    {place.description}
                                </Text>

                                <Group gap="lg" mt="md">
                                    <Group gap={4}>
                                        <MapPin size={14} color="gray" />
                                        <Text size="xs" color="dimmed">
                                            {place.latitude ? `${parseFloat(place.latitude.toString()).toFixed(4)}, ${parseFloat(place.longitude?.toString() || '0').toFixed(4)}` : 'No Coordinates'}
                                        </Text>
                                    </Group>
                                    <Group gap={4}>
                                        <Camera size={14} color="gray" />
                                        <Text size="xs" color="dimmed">{place.media.length} Media</Text>
                                    </Group>
                                </Group>
                            </Stack>

                            <Group mt="xl" gap="sm">
                                <Button 
                                    component={Link} 
                                    href={`/admin/places/${place.id}`} 
                                    variant="light" 
                                    style={{ flex: 1 }}
                                    leftSection={<Info size={14} />}
                                >
                                    Details
                                </Button>
                                <Tooltip label="Edit Place">
                                    <ActionIcon 
                                        component={Link} 
                                        href={`/admin/places/${place.id}/edit`} 
                                        variant="light" 
                                        color="yellow" 
                                        size="lg"
                                    >
                                        <Pencil size={16} />
                                    </ActionIcon>
                                </Tooltip>
                                <Tooltip label="Manage Gallery">
                                    <ActionIcon 
                                        component={Link} 
                                        href={`/admin/places/${place.id}`} 
                                        variant="light" 
                                        color="blue" 
                                        size="lg"
                                    >
                                        <ImageIcon size={16} />
                                    </ActionIcon>
                                </Tooltip>
                            </Group>
                        </Card>
                    ))}
                </SimpleGrid>

                {places.data.length === 0 ? (
                    <Paper p="xl" radius="md" withBorder style={{ textAlign: 'center' }}>
                        <MapIcon size={48} strokeWidth={1} color="gray" />
                        <Text color="dimmed" mt="md">No places found. Start by adding a new point of interest.</Text>
                    </Paper>
                ) : (
                    <Group justify="space-between" mt="xl">
                        <Text size="sm" color="dimmed">
                            Showing {places.data.length} of {places.total} places
                        </Text>
                        <Pagination 
                            total={places.last_page} 
                            value={places.current_page} 
                            onChange={(page) => router.get(`${url}?page=${page}`)}
                            radius="md"
                        />
                    </Group>
                )}
            </Stack>
        </AdminLayout>
    );
}
