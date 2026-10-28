import { useForm } from '@inertiajs/react';
import { Alert, Button, FileInput, Group, Paper, Stack, Text } from '@mantine/core';
import { Download, FileText, Upload } from 'lucide-react';

export default function TourBrochurePanel({ tour }: { tour: { id: number; brochure_name?: string | null; brochure_uploaded_at?: string | null } }) {
    const upload = useForm<{ brochure: File | null }>({ brochure: null });
    const removal = useForm({});
    const busy = upload.processing || removal.processing;
    const base = `/admin/tours/${tour.id}/brochure`;

    return <Paper p="xl" radius="lg" withBorder>
        <Stack gap="md">
            <Group gap="sm"><FileText size={22} /><Text size="lg" fw={700}>Tour brochure</Text></Group>
            <Text size="sm" c="dimmed">Every tour has a PDF generated from its latest package details and itinerary. Upload a designed PDF to make it the default customer download.</Text>
            <Group>
                <Button component="a" href={`${base}?source=generated`} variant="light" leftSection={<Download size={16} />}>Download generated PDF</Button>
                {tour.brochure_name && <Button component="a" href={`${base}?source=uploaded`} variant="default" leftSection={<Download size={16} />}>Download uploaded PDF</Button>}
            </Group>
            {tour.brochure_name && <Alert color="teal" title="Uploaded brochure is the default">
                <Text size="sm">{tour.brochure_name}</Text>
                <Text size="sm">Update this file when the itinerary, prices or policies change. Uploaded PDFs do not update automatically.</Text>
                <Button mt="sm" size="sm" variant="subtle" color="red" disabled={busy} loading={removal.processing} onClick={() => {
                    if (window.confirm('Remove the uploaded PDF? Customers will still have the generated brochure.')) removal.delete(base);
                }}>Remove uploaded PDF</Button>
            </Alert>}
            <form onSubmit={(event) => {
                event.preventDefault();
                upload.post(base, { forceFormData: true, preserveScroll: true, onSuccess: () => upload.reset() });
            }}>
                <Stack gap="sm">
                    <FileInput label={tour.brochure_name ? 'Replace brochure' : 'Upload brochure'} description="PDF only, up to 20 MB. The existing brochure stays available until the new upload succeeds." accept="application/pdf" clearable value={upload.data.brochure} onChange={(file) => upload.setData('brochure', file)} error={upload.errors.brochure} disabled={busy} />
                    <Group><Button type="submit" leftSection={<Upload size={16} />} disabled={!upload.data.brochure || busy} loading={upload.processing}>{upload.progress ? `Uploading ${upload.progress.percentage}%` : 'Save uploaded brochure'}</Button></Group>
                </Stack>
            </form>
        </Stack>
    </Paper>;
}
