import React from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { Alert, Box, Button, Checkbox, Group, NumberInput, Paper, Select, SimpleGrid, Stack, Text, Textarea, TextInput, ThemeIcon } from '@mantine/core';
import { ArrowLeft, CircleAlert, MapPinned, Save, Sparkles, WalletCards } from 'lucide-react';
import AdminLayout from '../../../layouts/AdminLayout';

type Option = { id: number; name: string };
const lines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean);

export default function Create({ title, categories }: { title: string; categories: Option[] }) {
    const { data, setData, post, processing, errors, transform } = useForm({
        tour_category_id: '', title: '', short_description: '', description: '',
        highlights_text: '', inclusions_text: '', exclusions_text: '', cancellation_policy: '',
        min_group_size: 1, max_group_size: 20, price_per_person: 0, child_price: 0, discount: 0,
        start_location: '', end_location: '', region: '', difficulty: 'easy', cover_image: '',
        available_from: '', available_to: '', is_active: false as boolean, is_featured: false as boolean,
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
        post('/admin/tours');
    };

    const heading = (icon: React.ReactNode, step: string, name: string, help: string) => (
        <Group align="flex-start" gap="sm"><ThemeIcon variant="light" radius="xl" size="lg">{icon}</ThemeIcon><Box><Text size="xs" fw={800} c="blue" tt="uppercase" lts={0.8}>{step}</Text><Text fw={850} size="lg">{name}</Text><Text size="sm" c="dimmed">{help}</Text></Box></Group>
    );

    return (
        <AdminLayout title={title}>
            <Head title="Create tour package" />
            <form onSubmit={submit}>
                <Stack gap="lg" maw={1080} mx="auto">
                    <Group justify="space-between" align="flex-end"><Box><Text size="xs" fw={800} c="blue" tt="uppercase" lts={1}>Tour setup · Step 1</Text><Text size="xl" fw={900}>Create the package</Text><Text c="dimmed">Save the commercial shell first. You will add itinerary days one by one next.</Text></Box><Button component={Link} href="/admin/tours" variant="default" leftSection={<ArrowLeft size={16} />}>Tours</Button></Group>
                    {Object.keys(errors).length > 0 && <Alert color="red" icon={<CircleAlert size={18} />} title="Review the highlighted fields">The package could not be saved yet.</Alert>}

                    <Paper p="xl" radius="lg" withBorder><Stack gap="lg">
                        {heading(<Sparkles size={18} />, '1 · Identity', 'Describe the experience', 'Use customer-facing language; itinerary detail comes in the next step.')}
                        <SimpleGrid cols={{ base: 1, md: 2 }}><TextInput required label="Tour title" value={data.title} onChange={(e) => setData('title', e.currentTarget.value)} error={errors.title} /><Select clearable searchable label="Category" data={categories.map((item) => ({ value: String(item.id), label: item.name }))} value={data.tour_category_id} onChange={(value) => setData('tour_category_id', value ?? '')} error={errors.tour_category_id} /></SimpleGrid>
                        <Textarea required minRows={2} maxLength={500} label="Card summary" description="A concise promise shown in customer results." value={data.short_description} onChange={(e) => setData('short_description', e.currentTarget.value)} error={errors.short_description} />
                        <Textarea required minRows={5} label="Full description" value={data.description} onChange={(e) => setData('description', e.currentTarget.value)} error={errors.description} />
                        <SimpleGrid cols={{ base: 1, md: 3 }}><Textarea minRows={4} label="Highlights" description="One per line" value={data.highlights_text} onChange={(e) => setData('highlights_text', e.currentTarget.value)} /><Textarea minRows={4} label="Inclusions" description="One per line" value={data.inclusions_text} onChange={(e) => setData('inclusions_text', e.currentTarget.value)} /><Textarea minRows={4} label="Exclusions" description="One per line" value={data.exclusions_text} onChange={(e) => setData('exclusions_text', e.currentTarget.value)} /></SimpleGrid>
                        <Textarea minRows={3} label="Cancellation and change policy" description="Shown to customers before checkout." value={data.cancellation_policy} onChange={(e) => setData('cancellation_policy', e.currentTarget.value)} error={errors.cancellation_policy} />
                    </Stack></Paper>

                    <Paper p="xl" radius="lg" withBorder><Stack gap="lg">
                        {heading(<MapPinned size={18} />, '2 · Geography', 'Define the route boundary', 'Days and nights are deliberately absent—they will be calculated from itinerary days.')}
                        <SimpleGrid cols={{ base: 1, md: 3 }}><TextInput required label="Start location" value={data.start_location} onChange={(e) => setData('start_location', e.currentTarget.value)} error={errors.start_location} /><TextInput required label="End location" value={data.end_location} onChange={(e) => setData('end_location', e.currentTarget.value)} error={errors.end_location} /><TextInput required label="Region / destination" value={data.region} onChange={(e) => setData('region', e.currentTarget.value)} error={errors.region} /><Select required label="Difficulty" data={['easy', 'moderate', 'challenging', 'extreme']} value={data.difficulty} onChange={(value) => setData('difficulty', value ?? 'easy')} error={errors.difficulty} /><TextInput required type="date" label="Available from" value={data.available_from} onChange={(e) => setData('available_from', e.currentTarget.value)} error={errors.available_from} /><TextInput required type="date" label="Available to" value={data.available_to} onChange={(e) => setData('available_to', e.currentTarget.value)} error={errors.available_to} /><TextInput label="Cover image URL" placeholder="https://…" value={data.cover_image} onChange={(e) => setData('cover_image', e.currentTarget.value)} error={errors.cover_image} /></SimpleGrid>
                    </Stack></Paper>

                    <Paper p="xl" radius="lg" withBorder><Stack gap="lg">
                        {heading(<WalletCards size={18} />, '3 · Commercials', 'Set group and price rules', 'Departure inventory and driver assignment are configured after the itinerary.')}
                        <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }}><NumberInput required min={1} label="Minimum group" value={data.min_group_size} onChange={(value) => setData('min_group_size', Number(value))} error={errors.min_group_size} /><NumberInput required min={1} label="Maximum group" value={data.max_group_size} onChange={(value) => setData('max_group_size', Number(value))} error={errors.max_group_size} /><NumberInput required min={0} prefix="₹ " label="Adult price" value={data.price_per_person} onChange={(value) => setData('price_per_person', Number(value))} error={errors.price_per_person} /><NumberInput required min={0} prefix="₹ " label="Child price" value={data.child_price} onChange={(value) => setData('child_price', Number(value))} error={errors.child_price} /><NumberInput min={0} max={100} suffix="%" label="Discount" value={data.discount} onChange={(value) => setData('discount', Number(value))} error={errors.discount} /></SimpleGrid>
                    </Stack></Paper>

                    <Paper p="lg" radius="lg" withBorder><Group justify="space-between"><Group><Checkbox checked={data.is_active} onChange={(e) => setData('is_active', e.currentTarget.checked)} label="Publish after setup" /><Checkbox checked={data.is_featured} onChange={(e) => setData('is_featured', e.currentTarget.checked)} label="Featured" /></Group><Button type="submit" loading={processing} leftSection={<Save size={17} />}>Save and add Day 1</Button></Group></Paper>
                </Stack>
            </form>
        </AdminLayout>
    );
}
