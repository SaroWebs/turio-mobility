import React from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '../../../layouts/AdminLayout';
import { resolveMediaUrl } from '@/lib/utils';
import { 
    Paper, 
    Stack, 
    Group, 
    Text, 
    Button, 
    Badge, 
    Timeline, 
    ThemeIcon, 
    Image, 
    Box, 
    SimpleGrid,
    ActionIcon,
    Tooltip,
} from '@mantine/core';
import { 
    Plus, 
    Clock, 
    ArrowLeft, 
    Pencil, 
    Eye, 
    Info, 
    Calendar,
    Navigation,
    Camera,
    Mountain,
    Trash2
} from 'lucide-react';

interface Place {
    id: number;
    name: string;
    description: string;
    media: Array<{
        id: number;
        file_path: string;
        url?: string;
        file_type: string;
    }>;
}

interface Itinerary {
    id: number;
    day_index: number;
    stop_order: number;
    time: string | null;
    details: string;
    title?: string | null;
    place: Place | null;
}

interface Tour {
    id: number;
    title: string;
    description: string;
    duration_days: number;
    duration_nights: number;
}

interface TourItinerariesProps {
    title: string;
    tour: Tour;
    itineraries: Itinerary[];
}

export default function TourItineraries({ title, tour, itineraries }: TourItinerariesProps) {
    const deleteDay = (itinerary: Itinerary) => {
        if (confirm(`Delete this visit from Day ${itinerary.day_index}? If it is the day's last visit, later days will be renumbered.`)) {
            router.delete(`/admin/tours/${tour.id}/itineraries/${itinerary.id}`);
        }
    };
    // Group itineraries by day
    const groupedItineraries = itineraries.reduce((groups: Record<number, Itinerary[]>, itinerary) => {
        const day = itinerary.day_index;
        if (!groups[day]) {
            groups[day] = [];
        }
        groups[day].push(itinerary);
        return groups;
    }, {});

    const sortedDays = Object.keys(groupedItineraries)
        .map(Number)
        .sort((a, b) => a - b);
    const nextDay = (sortedDays.at(-1) ?? 0) + 1;

    return (
        <AdminLayout title={title}>
            <Head title={`Itinerary: ${tour.title}`} />

            <Stack gap="xl">
                <Group justify="space-between" align="flex-end">
                    <Stack gap={2}>
                        <Group gap="xs">
                            <ThemeIcon variant="light" color="blue" size="sm">
                                <Navigation size={14} />
                            </ThemeIcon>
                            <Text size="xs" fw={700} color="dimmed" tt="uppercase">Tour Journey Map</Text>
                        </Group>
                        <Text size="h3" fw={800}>{tour.title}</Text>
                        <Text size="sm" fw={700} c="blue">{tour.duration_days} days / {tour.duration_nights} nights · {itineraries.length} place visits</Text>
                        <Text size="sm" color="dimmed" lineClamp={1}>{tour.description}</Text>
                    </Stack>
                    <Group gap="sm">
                        <Button 
                            component={Link} 
                            href={`/admin/tours/${tour.id}`} 
                            variant="light" 
                            color="gray" 
                            leftSection={<ArrowLeft size={16} />}
                            radius="md"
                        >
                            Back to Details
                        </Button>
                        <Button 
                            component={Link} 
                            href={`/admin/tours/${tour.id}/itineraries/create`} 
                            color="blue" 
                            leftSection={<Plus size={16} />}
                            radius="md"
                        >
                            Add Day {nextDay}
                        </Button>
                    </Group>
                </Group>

                {itineraries.length === 0 ? (
                    <Paper p={60} radius="md" withBorder shadow="sm" style={{ textAlign: 'center' }}>
                        <Stack align="center" gap="md">
                            <Mountain size={64} strokeWidth={1} color="var(--mantine-color-gray-4)" />
                            <Text fw={700} size="lg">No locations mapped yet</Text>
                            <Text color="dimmed" maw={400}>Start building the travel experience by adding destinations and daily activities to this tour.</Text>
                            <Button 
                                component={Link} 
                                href={`/admin/tours/${tour.id}/itineraries/create`} 
                                mt="md"
                                radius="md"
                                size="md"
                            >
                                Define First Stop
                            </Button>
                        </Stack>
                    </Paper>
                ) : (
                    <SimpleGrid cols={{ base: 1, lg: 1 }} spacing="xl">
                        {sortedDays.map((day) => (
                            <Paper key={day} p="xl" radius="md" withBorder shadow="sm">
                                <Group justify="space-between" mb="xl">
                                    <Group gap="md">
                                        <ThemeIcon color="blue" variant="filled" size="xl" radius="md">
                                            <Calendar size={20} />
                                        </ThemeIcon>
                                        <Stack gap={0}>
                                            <Text size="xl" fw={800}>Day {day}</Text>
                                            <Text size="xs" color="dimmed" fw={700} tt="uppercase">Daily Schedule</Text>
                                        </Stack>
                                    </Group>
                                    <Group gap="sm">
                                        <Button component={Link} href={`/admin/tours/${tour.id}/itineraries/create?day=${day}`} variant="light" size="xs" leftSection={<Plus size={14} />}>Add place</Button>
                                        <Badge variant="light" size="lg" radius="sm">{groupedItineraries[day].length} visit{groupedItineraries[day].length === 1 ? '' : 's'}</Badge>
                                    </Group>
                                </Group>

                                <Timeline bulletSize={32} lineWidth={2}>
                                    {groupedItineraries[day]
                                        .sort((a, b) => {
                                            if (a.stop_order !== b.stop_order) return a.stop_order - b.stop_order;
                                            if (!a.time && !b.time) return 0;
                                            if (!a.time) return 1;
                                            if (!b.time) return -1;
                                            return a.time.localeCompare(b.time);
                                        })
                                        .map((itinerary) => (
                                            <Timeline.Item 
                                                key={itinerary.id} 
                                                bullet={<Clock size={16} />}
                                                title={
                                                    <Group justify="space-between" align="flex-start">
                                                        <Box>
                                                            <Group gap={8}>
                                                                <Text fw={800} size="lg">{itinerary.place?.name ?? itinerary.title ?? `Day ${itinerary.day_index}`}</Text>
                                                                {itinerary.time && (
                                                                    <Badge variant="dot" size="sm" color="blue">{itinerary.time}</Badge>
                                                                )}
                                                            </Group>
                                                            <Text size="sm" color="dimmed" mt={4} lineClamp={2}>
                                                                {itinerary.place?.description ?? 'The linked place is no longer available. Edit this day to choose another point of interest.'}
                                                            </Text>
                                                        </Box>
                                                        <Group gap={4}>
                                                            <Tooltip label="Edit Connection">
                                                                <ActionIcon 
                                                                    component={Link} 
                                                                    href={`/admin/tours/${tour.id}/itineraries/${itinerary.id}/edit`} 
                                                                    variant="light" 
                                                                    color="yellow"
                                                                >
                                                                    <Pencil size={14} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                            <Tooltip label="Full Profile">
                                                                <ActionIcon 
                                                                    component={Link} 
                                                                    href={`/admin/tours/${tour.id}/itineraries/${itinerary.id}`} 
                                                                    variant="light" 
                                                                    color="blue"
                                                                >
                                                                    <Eye size={14} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                            <Tooltip label="Delete place visit">
                                                                <ActionIcon onClick={() => deleteDay(itinerary)} variant="light" color="red" aria-label={`Delete visit ${itinerary.stop_order} from Day ${itinerary.day_index}`}>
                                                                    <Trash2 size={14} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                        </Group>
                                                    </Group>
                                                }
                                            >
                                                <Stack gap="md" mt="sm">
                                                    {itinerary.details && (
                                                        <Paper p="sm" bg="gray.0" radius="sm" withBorder>
                                                            <Group gap={8} align="flex-start">
                                                                <Info size={14} color="var(--mantine-color-blue-6)" style={{ marginTop: '4px' }} />
                                                                <Text size="sm" color="gray.7" fw={500}>{itinerary.details}</Text>
                                                            </Group>
                                                        </Paper>
                                                    )}

                                                    {itinerary.place?.media && itinerary.place.media.length > 0 && (
                                                        <Group gap="xs">
                                                            {itinerary.place.media.slice(0, 4).map((media) => (
                                                                <Box key={media.id} pos="relative">
                                                                    <Image
                                                                        src={resolveMediaUrl(media.url || media.file_path)}
                                                                        radius="sm"
                                                                        w={80}
                                                                        h={60}
                                                                        fallbackSrc="https://placehold.co/100x75?text=No+Img"
                                                                    />
                                                                    {media.file_type === 'video' && (
                                                                        <Box 
                                                                            pos="absolute" 
                                                                            top={0} 
                                                                            left={0} 
                                                                            w="100%" 
                                                                            h="100%" 
                                                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}
                                                                        >
                                                                            <Camera size={14} color="white" />
                                                                        </Box>
                                                                    )}
                                                                </Box>
                                                            ))}
                                                            {itinerary.place.media.length > 4 && (
                                                                <Paper withBorder radius="sm" w={80} h={60} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <Text size="xs" fw={700} color="dimmed">+{itinerary.place.media.length - 4}</Text>
                                                                </Paper>
                                                            )}
                                                        </Group>
                                                    )}
                                                </Stack>
                                            </Timeline.Item>
                                        ))}
                                </Timeline>
                            </Paper>
                        ))}
                    </SimpleGrid>
                )}
            </Stack>
        </AdminLayout>
    );
}
