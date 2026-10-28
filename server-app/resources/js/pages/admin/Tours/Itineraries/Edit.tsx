import React from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { Alert, Button, Checkbox, Group, Paper, Select, SimpleGrid, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { ArrowLeft, Save } from 'lucide-react';
import AdminLayout from '../../../../layouts/AdminLayout';

type Place = { id: number; name: string; city?: string | null; state?: string | null };
type Itinerary = { id: number; day_index: number; stop_order?: number; time?: string | null; title?: string | null; start_location?: string | null; end_location?: string | null; details?: string | null; description?: string | null; activities?: string[]; accommodation?: string | null; meals_included?: string[]; distance_km?: string | null; travel_time?: string | null; key_stops?: Array<{ name: string; description?: string | null }>; inclusions?: string[]; exclusions?: string[]; place?: Place };
const lines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean);
const keyStops = (value: string) => lines(value).map((item) => {
    const [name, ...description] = item.split('|');
    return { name: name.trim(), description: description.join('|').trim() };
}).filter((item) => item.name);

export default function EditItinerary({ title, tour, itinerary, places, maxDay }: { title: string; tour: { id: number; title: string }; itinerary: Itinerary; places: Place[]; maxDay: number }) {
    const { data, setData, put, processing, errors, transform } = useForm({
        day_number: String(itinerary.day_index), time: itinerary.time?.slice(0, 5) ?? '', place_id: itinerary.place ? String(itinerary.place.id) : '', title: itinerary.title ?? '',
        start_location: itinerary.start_location ?? '', end_location: itinerary.end_location ?? '',
        details: itinerary.details ?? itinerary.description ?? '', activities_text: (itinerary.activities ?? []).join('\n'), accommodation: itinerary.accommodation ?? '',
        meals_included: itinerary.meals_included ?? [] as string[], distance_km: itinerary.distance_km ?? '', travel_time: itinerary.travel_time ?? '',
        key_stops_text: (itinerary.key_stops ?? []).map((stop) => [stop.name, stop.description].filter(Boolean).join(' | ')).join('\n'),
        inclusions_text: (itinerary.inclusions ?? []).join('\n'), exclusions_text: (itinerary.exclusions ?? []).join('\n'),
    });
    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        transform((values) => ({
            ...values,
            activities: lines(values.activities_text),
            key_stops: keyStops(values.key_stops_text),
            inclusions: lines(values.inclusions_text),
            exclusions: lines(values.exclusions_text),
        }));
        put(`/admin/tours/${tour.id}/itineraries/${itinerary.id}`);
    };
    const error = (key: string) => (errors as Record<string, string>)[key];

    return <AdminLayout title={title}><Head title={`Edit Day ${itinerary.day_index} visit ${itinerary.stop_order ?? 1} · ${tour.title}`} /><form onSubmit={submit}><Stack gap="lg" maw={920} mx="auto">
        <Group justify="space-between"><div><Text size="xs" fw={800} c="blue" tt="uppercase">Itinerary place visit</Text><Text size="xl" fw={900}>Edit Day {itinerary.day_index} · Visit {itinerary.stop_order ?? 1}</Text><Text c="dimmed">Update this stop without affecting the other places planned for the same day.</Text></div><Button component={Link} href={`/admin/tours/${tour.id}/itineraries`} variant="default" leftSection={<ArrowLeft size={16} />}>Itinerary</Button></Group>
        <Paper p="xl" radius="lg" withBorder><Stack gap="lg">
            <SimpleGrid cols={{ base: 1, md: 3 }}><Select required label="Visit day" description="Moving a visit appends it after existing places." data={Array.from({ length: maxDay + 1 }, (_, index) => ({ value: String(index + 1), label: index < maxDay ? `Day ${index + 1}` : `Day ${index + 1} · New day` }))} value={data.day_number} onChange={(value) => setData('day_number', value ?? String(itinerary.day_index))} error={errors.day_number} /><Select required searchable label="Point of interest" data={places.map((place) => ({ value: String(place.id), label: [place.name, place.city, place.state].filter(Boolean).join(' · ') }))} value={data.place_id} onChange={(value) => setData('place_id', value ?? '')} error={errors.place_id} /><TextInput type="time" label="Arrival time" value={data.time} onChange={(e) => setData('time', e.currentTarget.value)} error={errors.time} /></SimpleGrid>
            <TextInput label="Day title" value={data.title} onChange={(e) => setData('title', e.currentTarget.value)} error={errors.title} />
            <SimpleGrid cols={{ base: 1, md: 2 }}><TextInput label="Starting point" value={data.start_location} onChange={(e) => setData('start_location', e.currentTarget.value)} error={errors.start_location} /><TextInput label="Ending point" value={data.end_location} onChange={(e) => setData('end_location', e.currentTarget.value)} error={errors.end_location} /></SimpleGrid>
            <Textarea required minRows={5} label="Detailed day plan" value={data.details} onChange={(e) => setData('details', e.currentTarget.value)} error={errors.details} />
            <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }}><Textarea minRows={3} label="Activities" description="One per line" value={data.activities_text} onChange={(e) => setData('activities_text', e.currentTarget.value)} /><TextInput label="Accommodation" value={data.accommodation} onChange={(e) => setData('accommodation', e.currentTarget.value)} error={errors.accommodation} /><TextInput label="Travel distance" value={data.distance_km} onChange={(e) => setData('distance_km', e.currentTarget.value)} error={errors.distance_km} /><TextInput label="Drive time" value={data.travel_time} onChange={(e) => setData('travel_time', e.currentTarget.value)} error={errors.travel_time} /></SimpleGrid>
            <Textarea minRows={4} label="Key stops" description="One per line: Stop name | short customer-facing description" value={data.key_stops_text} onChange={(e) => setData('key_stops_text', e.currentTarget.value)} error={error('key_stops')} />
            <SimpleGrid cols={{ base: 1, md: 2 }}><Textarea minRows={4} label="Day inclusions" description="One per line" value={data.inclusions_text} onChange={(e) => setData('inclusions_text', e.currentTarget.value)} error={error('inclusions')} /><Textarea minRows={4} label="Day exclusions" description="One per line" value={data.exclusions_text} onChange={(e) => setData('exclusions_text', e.currentTarget.value)} error={error('exclusions')} /></SimpleGrid>
            <Checkbox.Group label="Meals included" value={data.meals_included} onChange={(value) => setData('meals_included', value)}><Group mt="xs"><Checkbox value="breakfast" label="Breakfast" /><Checkbox value="lunch" label="Lunch" /><Checkbox value="dinner" label="Dinner" /></Group></Checkbox.Group>
            {Object.keys(errors).length > 0 && <Alert color="red">Review the highlighted fields.</Alert>}
            <Group justify="flex-end"><Button component={Link} href={`/admin/tours/${tour.id}/itineraries`} variant="default">Cancel</Button><Button type="submit" loading={processing} leftSection={<Save size={17} />}>Save Day {itinerary.day_index}</Button></Group>
        </Stack></Paper>
    </Stack></form></AdminLayout>;
}
