import React from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import LocationInput from '@/components/ui/LocationInput';
import PlaceLocationMap, { type ResolvedMapLocation } from '@/components/places/PlaceLocationMap';
import {
    Button,
    Divider,
    Group,
    Paper,
    SimpleGrid,
    Stack,
    Switch,
    TagsInput,
    Text,
    Textarea,
    TextInput,
} from '@mantine/core';
import { ArrowLeft, Images, MapPin, Save, Star } from 'lucide-react';

interface Place {
    id: number;
    name: string;
    description: string | null;
    short_description: string | null;
    location: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    latitude: number | string | null;
    longitude: number | string | null;
    tags: string[] | null;
    google_place_id: string | null;
    google_rating: number | string | null;
    google_review_count: number | null;
    google_synced_at: string | null;
    is_active: boolean;
    is_featured: boolean;
}

interface EditPlaceProps {
    title: string;
    place: Place;
}

interface SearchResult {
    id: string;
    name: string;
    address: string;
    type: string;
    lat?: number;
    lng?: number;
    city?: string;
    state?: string;
    country?: string;
    rating?: number;
    reviewCount?: number;
}

export default function Edit({ title, place }: EditPlaceProps) {
    const { data, setData, put, processing, errors } = useForm({
        name: place.name,
        description: place.description ?? '',
        short_description: place.short_description ?? '',
        location: place.location ?? '',
        city: place.city ?? '',
        state: place.state ?? '',
        country: place.country ?? 'India',
        latitude: place.latitude?.toString() ?? '',
        longitude: place.longitude?.toString() ?? '',
        tags: place.tags ?? [],
        google_place_id: place.google_place_id ?? '',
        google_rating: place.google_rating?.toString() ?? '',
        google_review_count: place.google_review_count?.toString() ?? '0',
        is_active: Boolean(place.is_active),
        is_featured: Boolean(place.is_featured),
    });

    const handleLocationSelect = (location: SearchResult) => {
        setData('name', location.name);
        setData('location', location.address);
        setData('google_place_id', location.id);
        setData('latitude', location.lat?.toString() || '');
        setData('longitude', location.lng?.toString() || '');
        setData('city', location.city || '');
        setData('state', location.state || '');
        setData('country', location.country || 'India');
        setData('google_rating', location.rating?.toString() || '');
        setData('google_review_count', location.reviewCount?.toString() || '0');
    };

    const handleMapLocationChange = (location: ResolvedMapLocation) => {
        setData('latitude', location.latitude.toFixed(8));
        setData('longitude', location.longitude.toFixed(8));
        if (location.googlePlaceId) setData('google_place_id', location.googlePlaceId);
        if (location.address) setData('location', location.address);
        if (location.city) setData('city', location.city);
        if (location.state) setData('state', location.state);
        if (location.country) setData('country', location.country);
    };

    const latitude = Number(data.latitude);
    const longitude = Number(data.longitude);
    const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude) && data.latitude !== '' && data.longitude !== '';

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        put(`/admin/places/${place.id}`);
    };

    return (
        <AdminLayout title={title}>
            <Head title={`Edit ${place.name}`} />

            <Stack gap="lg" maw={1100} mx="auto">
                <Group justify="space-between">
                    <div>
                        <Text size="xl" fw={800}>Edit Place</Text>
                        <Text size="sm" color="dimmed">Update customer catalog, map, Google cache, and feature metadata.</Text>
                    </div>
                    <Group>
                        <Button component={Link} href={`/admin/places/${place.id}`} variant="light" leftSection={<Images size={16} />}>
                            Manage Media
                        </Button>
                        <Button component={Link} href="/admin/places" variant="subtle" color="gray" leftSection={<ArrowLeft size={16} />}>
                            Back to Places
                        </Button>
                    </Group>
                </Group>

                <Paper p="xl" radius="md" withBorder>
                    <form onSubmit={handleSubmit}>
                        <Stack gap="xl">
                            <Stack gap="md">
                                <Text fw={700}>Place Details</Text>
                                <LocationInput
                                    label="Search Location"
                                    placeholder="Search for a Google place or enter a name"
                                    value={data.name}
                                    onChange={(value) => setData('name', value)}
                                    onLocationSelect={handleLocationSelect}
                                    error={errors.name}
                                    required
                                />

                                <Textarea
                                    label="Description"
                                    rows={4}
                                    value={data.description}
                                    onChange={(event) => setData('description', event.currentTarget.value)}
                                    error={errors.description}
                                />

                                <TextInput
                                    label="Short Description"
                                    value={data.short_description}
                                    onChange={(event) => setData('short_description', event.currentTarget.value)}
                                    error={errors.short_description}
                                />
                            </Stack>

                            <Divider />

                            <Stack gap="md">
                                <Group gap="sm">
                                    <MapPin size={18} />
                                    <Text fw={700}>Location Metadata</Text>
                                </Group>
                                <TextInput
                                    label="Display Address"
                                    value={data.location}
                                    onChange={(event) => setData('location', event.currentTarget.value)}
                                    error={errors.location}
                                />
                                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                                    <TextInput label="City" value={data.city} onChange={(event) => setData('city', event.currentTarget.value)} error={errors.city} />
                                    <TextInput label="State" value={data.state} onChange={(event) => setData('state', event.currentTarget.value)} error={errors.state} />
                                    <TextInput label="Country" value={data.country} onChange={(event) => setData('country', event.currentTarget.value)} error={errors.country} />
                                </SimpleGrid>
                                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                                    <TextInput type="number" step="any" label="Latitude" value={data.latitude} onChange={(event) => setData('latitude', event.currentTarget.value)} error={errors.latitude} />
                                    <TextInput type="number" step="any" label="Longitude" value={data.longitude} onChange={(event) => setData('longitude', event.currentTarget.value)} error={errors.longitude} />
                                </SimpleGrid>
                                {hasCoordinates ? (
                                    <PlaceLocationMap latitude={latitude} longitude={longitude} editable onLocationChange={handleMapLocationChange} />
                                ) : (
                                    <Text size="sm" c="dimmed">Choose a Google place or enter coordinates to activate the map.</Text>
                                )}
                            </Stack>

                            <Divider />

                            <Stack gap="md">
                                <Group gap="sm">
                                    <Star size={18} />
                                    <Text fw={700}>Google And Catalog</Text>
                                </Group>
                                <TextInput
                                    label="Google Place ID"
                                    value={data.google_place_id}
                                    onChange={(event) => setData('google_place_id', event.currentTarget.value)}
                                    error={errors.google_place_id}
                                />
                                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                                    <TextInput type="number" step="0.01" label="Google Rating Cache" value={data.google_rating} onChange={(event) => setData('google_rating', event.currentTarget.value)} error={errors.google_rating} />
                                    <TextInput type="number" label="Google Review Count" value={data.google_review_count} onChange={(event) => setData('google_review_count', event.currentTarget.value)} error={errors.google_review_count} />
                                </SimpleGrid>
                                <Text size="xs" color="dimmed">
                                    Last Google sync: {place.google_synced_at ? new Date(place.google_synced_at).toLocaleString() : 'Never'}
                                </Text>
                                <Text size="xs" c="dimmed">
                                    Moving the map pin resolves a new Google Place ID when possible. Saving automatically refreshes the Google profile.
                                </Text>
                                <TagsInput
                                    label="Tags"
                                    placeholder="Add tag"
                                    value={data.tags}
                                    onChange={(value) => setData('tags', value)}
                                    error={errors.tags}
                                    splitChars={[',']}
                                />
                                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                                    <Switch label="Active in customer apps" checked={data.is_active} onChange={(event) => setData('is_active', event.currentTarget.checked)} />
                                    <Switch label="Featured place" checked={data.is_featured} onChange={(event) => setData('is_featured', event.currentTarget.checked)} />
                                </SimpleGrid>
                            </Stack>

                            <Divider />

                            <Group justify="flex-end">
                                <Button component={Link} href="/admin/places" variant="default">
                                    Cancel
                                </Button>
                                <Button type="submit" leftSection={<Save size={16} />} loading={processing}>
                                    Update Place
                                </Button>
                            </Group>
                        </Stack>
                    </form>
                </Paper>
            </Stack>
        </AdminLayout>
    );
}
