import { Head, Link } from '@inertiajs/react';
import { Alert, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import AdminLayout from '@/layouts/AdminLayout';

export default function Analytics({ providers, expiring }: {
    providers: { provider: string; currency: string | null; requests: number; chargeable_requests: number; unknown_charges: number; known_cost_minor: number | null; average_ms: number | null; errors: number }[];
    expiring: { data: { id: number; driver_id: number; type: string; expires_at: string; status: string; driver: { name: string } | null }[]; prev_page_url: string | null; next_page_url: string | null };
}) {
    return <AdminLayout><Head title="Verification compliance and costs" /><Stack gap="lg"><Text component={Link} href="/admin/verification">Back to queue</Text><Title order={1}>Compliance and provider costs</Title>
        <Alert>Costs include only amounts reported by the adapter. Unknown charges require provider reconciliation. Simulations are not registry checks.</Alert>
        <Title order={2}>Provider performance · all recorded requests</Title>
        {providers.length === 0 && <Text c="dimmed">No verification requests have been recorded.</Text>}
        {providers.map((provider) => <Paper withBorder p="md" key={`${provider.provider}:${provider.currency}`}><Stack gap="xs"><Text fw={600}>{provider.provider}</Text><Text>{provider.requests} requests · {provider.errors} errors · {provider.chargeable_requests} confirmed chargeable · {provider.unknown_charges} unknown billing outcomes</Text><Text>Known cost: {provider.known_cost_minor === null ? 'Unknown' : `${provider.currency || ''} ${(Number(provider.known_cost_minor) / 100).toFixed(2)}`} · Mean response time: {provider.average_ms === null ? 'Unknown' : `${Math.round(provider.average_ms)} ms`}</Text></Stack></Paper>)}
        <Title order={2}>Expired or expiring within 30 days</Title>
        {expiring.data.length === 0 && <Text c="dimmed">No documents are in this expiration window.</Text>}
        {expiring.data.map((document) => <Paper withBorder p="md" key={document.id}><Group justify="space-between"><div><Text fw={600}>{document.driver?.name || `Driver #${document.driver_id}`}</Text><Text>{document.type.replaceAll('_', ' ')} · {document.expires_at.slice(0, 10)} · {document.status}</Text></div><Button component={Link} href={`/admin/verification/${document.driver_id}`} variant="light">Review</Button></Group></Paper>)}
        <Group>{expiring.prev_page_url && <Button component={Link} href={expiring.prev_page_url} variant="default">Previous</Button>}{expiring.next_page_url && <Button component={Link} href={expiring.next_page_url} variant="default">Next</Button>}</Group>
    </Stack></AdminLayout>;
}
