import React from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { Button, Checkbox, Group, NumberInput, Paper, Select, SimpleGrid, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { ArrowLeft, Save } from 'lucide-react';
import AdminLayout from '../../../layouts/AdminLayout';
import TourBrochurePanel from '../../../components/TourBrochurePanel';

type Tour = {
    brochure_name?: string | null; brochure_uploaded_at?: string | null;
    id: number; tour_category_id?: number | null; title: string; short_description?: string | null; description: string;
    duration_days: number; duration_nights: number; min_group_size: number; max_group_size: number;
    price_per_person: number | string; child_price: number | string; discount: number | string;
    start_location?: string | null; end_location?: string | null; region?: string | null;
    difficulty: string; cover_image?: string | null; available_from?: string | null; available_to?: string | null;
    highlights?: string[]; inclusions?: string[]; exclusions?: string[]; cancellation_policy?: string | null;
    is_active: boolean; is_featured: boolean;
};

const lines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean);

export default function Edit({ title, tour, categories }: { title: string; tour: Tour; categories: Array<{ id: number; name: string }> }) {
    const date = (value?: string | null) => value ? value.slice(0, 10) : '';
    const { data, setData, put, processing, errors, transform } = useForm({
        tour_category_id: tour.tour_category_id ? String(tour.tour_category_id) : '',
        title: tour.title, short_description: tour.short_description ?? '', description: tour.description ?? '',
        highlights_text: (tour.highlights ?? []).join('\n'),
        inclusions_text: (tour.inclusions ?? []).join('\n'),
        exclusions_text: (tour.exclusions ?? []).join('\n'),
        cancellation_policy: tour.cancellation_policy ?? '',
        min_group_size: tour.min_group_size, max_group_size: tour.max_group_size,
        price_per_person: Number(tour.price_per_person), child_price: Number(tour.child_price), discount: Number(tour.discount),
        start_location: tour.start_location ?? '', end_location: tour.end_location ?? '', region: tour.region ?? '',
        difficulty: tour.difficulty ?? 'easy', cover_image: tour.cover_image ?? '',
        available_from: date(tour.available_from), available_to: date(tour.available_to),
        is_active: tour.is_active, is_featured: tour.is_featured,
    });

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        transform((values) => ({
            ...values,
            tour_category_id: values.tour_category_id || null,
            highlights: lines(values.highlights_text),
            inclusions: lines(values.inclusions_text),
            exclusions: lines(values.exclusions_text),
        }));
        put(`/admin/tours/${tour.id}`);
    };

    return (
        <AdminLayout title={title}>
            <Head title={`Edit ${tour.title}`} />
            <Stack gap="lg" maw={1040} mx="auto">
                <Group justify="space-between"><div><Text size="xl" fw={900}>Edit tour package</Text><Text c="dimmed">Update the package. Itinerary, departures, and driver assignment stay independently manageable.</Text></div><Button component={Link} href={`/admin/tours/${tour.id}`} variant="default" leftSection={<ArrowLeft size={16} />}>Tour details</Button></Group>
                <Paper p="xl" radius="lg" withBorder>
                    <form onSubmit={submit}><Stack gap="lg">
                        <SimpleGrid cols={{ base: 1, md: 2 }}>
                            <TextInput required label="Tour title" value={data.title} onChange={(e) => setData('title', e.currentTarget.value)} error={errors.title} />
                            <Select clearable label="Category" data={categories.map((item) => ({ value: String(item.id), label: item.name }))} value={data.tour_category_id} onChange={(value) => setData('tour_category_id', value ?? '')} error={errors.tour_category_id} />
                        </SimpleGrid>
                        <Textarea label="Card summary" minRows={2} value={data.short_description} onChange={(e) => setData('short_description', e.currentTarget.value)} error={errors.short_description} />
                        <Textarea required label="Full description" minRows={5} value={data.description} onChange={(e) => setData('description', e.currentTarget.value)} error={errors.description} />
                        <SimpleGrid cols={{ base: 1, md: 3 }}>
                            <Textarea minRows={4} label="Highlights" description="One per line" value={data.highlights_text} onChange={(e) => setData('highlights_text', e.currentTarget.value)} />
                            <Textarea minRows={4} label="Inclusions" description="One per line" value={data.inclusions_text} onChange={(e) => setData('inclusions_text', e.currentTarget.value)} />
                            <Textarea minRows={4} label="Exclusions" description="One per line" value={data.exclusions_text} onChange={(e) => setData('exclusions_text', e.currentTarget.value)} />
                        </SimpleGrid>
                        <Textarea minRows={3} label="Cancellation and change policy" description="Shown to customers before checkout." value={data.cancellation_policy} onChange={(e) => setData('cancellation_policy', e.currentTarget.value)} error={errors.cancellation_policy} />
                        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                            <TextInput label="Duration" readOnly value={`${tour.duration_days} days / ${tour.duration_nights} nights`} description="Calculated from itinerary days" />
                            <NumberInput required min={1} label="Minimum group" value={data.min_group_size} onChange={(v) => setData('min_group_size', Number(v))} error={errors.min_group_size} />
                            <NumberInput required min={1} label="Maximum group" value={data.max_group_size} onChange={(v) => setData('max_group_size', Number(v))} error={errors.max_group_size} />
                            <NumberInput required min={0} prefix="₹ " label="Adult price" value={data.price_per_person} onChange={(v) => setData('price_per_person', Number(v))} error={errors.price_per_person} />
                            <NumberInput required min={0} prefix="₹ " label="Child price" value={data.child_price} onChange={(v) => setData('child_price', Number(v))} error={errors.child_price} />
                            <NumberInput min={0} max={100} suffix="%" label="Discount" value={data.discount} onChange={(v) => setData('discount', Number(v))} error={errors.discount} />
                            <Select required label="Difficulty" data={['easy', 'moderate', 'challenging', 'extreme']} value={data.difficulty} onChange={(v) => setData('difficulty', v ?? 'easy')} error={errors.difficulty} />
                            <TextInput required label="Start location" value={data.start_location} onChange={(e) => setData('start_location', e.currentTarget.value)} error={errors.start_location} />
                            <TextInput required label="End location" value={data.end_location} onChange={(e) => setData('end_location', e.currentTarget.value)} error={errors.end_location} />
                            <TextInput required label="Region / destination" value={data.region} onChange={(e) => setData('region', e.currentTarget.value)} error={errors.region} />
                            <TextInput label="Cover image URL" value={data.cover_image} onChange={(e) => setData('cover_image', e.currentTarget.value)} error={errors.cover_image} />
                            <TextInput required type="date" label="Available from" value={data.available_from} onChange={(e) => setData('available_from', e.currentTarget.value)} error={errors.available_from} />
                            <TextInput required type="date" label="Available to" value={data.available_to} onChange={(e) => setData('available_to', e.currentTarget.value)} error={errors.available_to} />
                        </SimpleGrid>
                        <Group><Checkbox checked={data.is_active} onChange={(e) => setData('is_active', e.currentTarget.checked)} label="Published" /><Checkbox checked={data.is_featured} onChange={(e) => setData('is_featured', e.currentTarget.checked)} label="Featured" /></Group>
                        <Group justify="flex-end"><Button component={Link} href={`/admin/tours/${tour.id}`} variant="default">Cancel</Button><Button type="submit" loading={processing} leftSection={<Save size={17} />}>Save package</Button></Group>
                    </Stack></form>
                </Paper>
                <TourBrochurePanel tour={tour} />
            </Stack>
        </AdminLayout>
    );
}
