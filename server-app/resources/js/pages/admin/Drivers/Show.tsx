import React from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import { 
    Grid, 
    Paper, 
    Text, 
    Group, 
    Stack, 
    Avatar, 
    Badge, 
    Tabs, 
    Table, 
    Button, 
    ActionIcon, 
    Divider,
    SimpleGrid,
    Card,
    ThemeIcon,
    Indicator,
    Progress,
    Switch,
    TagsInput,
    Textarea,
    Rating,
    NumberInput,
    Select,
} from '@mantine/core';
import { 
    Phone, 
    Car, 
    MapPin, 
    ArrowLeft, 
    Check, 
    Ban, 
    ShieldCheck,
    Map,
    TrendingUp,
    Navigation,
    Activity,
    ExternalLink,
    Clock,
    Save,
    Languages,
    BadgeCheck,
    Star,
    MessageSquareText,
    UsersRound,
    FileCheck2,
} from 'lucide-react';

function DocumentProviderForm({ driverId, documentId, providers, disabled }: {
    driverId: number; documentId: number; providers: Array<{ value: string; label: string; simulated: boolean }>; disabled: boolean;
}) {
    const form = useForm({ provider: providers[0]?.value || '', outcome: 'approved' });
    const simulated = providers.find((provider) => provider.value === form.data.provider)?.simulated;
    return <form onSubmit={(event) => {
        event.preventDefault();
        form.transform((data) => simulated ? data : { provider: data.provider, outcome: null });
        form.post(`/admin/drivers/${driverId}/documents/${documentId}/verify`, { preserveScroll: true });
    }}>
        <Stack gap="xs">
            <Select label="Verification provider" data={providers.map(({ value, label }) => ({ value, label }))} value={form.data.provider} onChange={(value) => form.setData('provider', value || '')} disabled={disabled || form.processing} error={form.errors.provider} allowDeselect={false} />
            {simulated && <>
                <Text size="xs" c="orange">Simulation only: no third-party registry is contacted.</Text>
                <Select label="Simulated result" data={[{ value: 'approved', label: 'Pass' }, { value: 'rejected', label: 'Reject' }, { value: 'error', label: 'Provider unavailable' }]} value={form.data.outcome} onChange={(value) => form.setData('outcome', value || 'approved')} disabled={disabled || form.processing} error={form.errors.outcome} allowDeselect={false} />
            </>}
            {Object.entries(form.errors).filter(([key]) => !['provider', 'outcome'].includes(key)).map(([key, message]) => <Text key={key} size="xs" c="red">{message}</Text>)}
            <Button type="submit" size="xs" loading={form.processing} disabled={disabled || !form.data.provider}>{simulated ? 'Run simulated verification' : 'Verify with provider'}</Button>
        </Stack>
    </form>;
}

interface DriverRideBooking {
    id: number;
    booking_number: string;
    scheduled_at: string;
    pickup_location: string;
    dropoff_location: string;
    status: string;
    total_fare: number;
}

interface DriverTourAssignment {
    id: number;
    role?: string;
    schedule?: {
        tour?: {
            id: number;
            title: string;
        };
    };
}

interface Driver {
    id: number;
    name: string;
    email: string;
    phone: string;
    status: 'pending' | 'active' | 'suspended';
    vehicle_number: string;
    vehicle_type: string;
    can_short_ride: boolean;
    can_long_ride: boolean;
    can_tour_lead: boolean;
    can_tour_transport: boolean;
    can_rental_delivery: boolean;
    languages: string[] | null;
    expertise_tags: string[] | null;
    certification_notes: string | null;
    created_at: string;
    assigned_ride_bookings: DriverRideBooking[];
    driver_availability?: {
        is_online: boolean;
        is_available: boolean;
        current_lat: number;
        current_lng: number;
        last_ping: string;
        sharing_enabled: boolean;
        sharing_seat_capacity: number;
    };
    wallet?: {
        balance: number;
    };
    tour_driver_assignments: DriverTourAssignment[];
    vehicle?: {
        id: number;
        registration_number: string;
        make: string;
        model: string;
        photo_urls?: Partial<Record<'front' | 'rear' | 'left' | 'right', string>>;
        approval_status: 'pending' | 'approved' | 'rejected';
        condition: 'excellent' | 'good' | 'fair' | 'under_maintenance';
        rejection_reason?: string | null;
        category?: {
            id: number;
            name: string;
            base_fare?: number;
            price_per_km?: number;
            base_price_per_day?: number;
        } | null;
        tracker?: {
            status: string;
            last_ping_at?: string | null;
        } | null;
    } | null;
    documents: Array<{
        id: number;
        type: string;
        document_number?: string | null;
        file_url: string;
        status: 'pending' | 'approved' | 'rejected';
        rejection_reason?: string | null;
        expires_at?: string | null;
    }>;
}

interface DriverShowProps {
    verification_providers: Record<string, Array<{ value: string; label: string; simulated: boolean }>>;
    verification_attempts: Record<number, Array<{ id: number; provider: string; simulated: boolean; status: string; reference: string | null; message: string | null; created_at: string; requested_by: number | null }>>;
    title: string;
    driver: Driver;
    document_verification: {
        is_complete: boolean;
        message: string;
        requirements: Array<{ type: string; label: string; required: boolean; status: string; expires_at: string | null }>;
    };
    stats: {
        total_rides: number;
        completed_rides: number;
        total_earned: number;
        wallet_balance: number;
        is_online: boolean;
        is_available: boolean;
        average_rating: number | null;
        ratings_count: number;
        sharing_enabled: boolean;
        sharing_seat_capacity: number;
    };
    reviews: DriverReview[];
    available_vehicles: Array<{
        id: number;
        registration_number: string;
        make: string;
        model: string;
        category?: { id: number; name: string } | null;
    }>;
}

interface DriverReview {
    id: string;
    service: 'Ride' | 'Rental' | 'Tour';
    booking_number: string | null;
    customer_name: string;
    rating: number | null;
    feedback: string | null;
    created_at: string | null;
}

export default function DriverShow({ title, driver, document_verification, verification_providers, verification_attempts, stats, reviews, available_vehicles }: DriverShowProps) {
    const documentsReady = document_verification.is_complete;
    const { data, setData, put, processing, errors } = useForm({
        can_short_ride: Boolean(driver.can_short_ride),
        can_long_ride: Boolean(driver.can_long_ride),
        can_tour_lead: Boolean(driver.can_tour_lead),
        can_tour_transport: Boolean(driver.can_tour_transport),
        can_rental_delivery: Boolean(driver.can_rental_delivery),
        languages: driver.languages ?? [],
        expertise_tags: driver.expertise_tags ?? [],
        certification_notes: driver.certification_notes ?? '',
    });
    const sharingForm = useForm({
        sharing_enabled: Boolean(driver.driver_availability?.sharing_enabled),
        sharing_seat_capacity: driver.driver_availability?.sharing_seat_capacity ?? 3,
    });
    const vehicleAssignment = useForm({
        vehicle_id: driver.vehicle?.id ? String(driver.vehicle.id) : '',
    });
    const vehicleReview = useForm({
        approval_status: driver.vehicle?.approval_status ?? 'pending',
        condition: driver.vehicle?.condition ?? 'good',
        rejection_reason: driver.vehicle?.rejection_reason ?? '',
    });

    const handleApprove = () => router.post(`/admin/drivers/${driver.id}/approve`, {}, { preserveScroll: true });
    const handleSuspend = () => router.post(`/admin/drivers/${driver.id}/suspend`, {}, { preserveScroll: true });
    const handleActivate = () => router.post(`/admin/drivers/${driver.id}/activate`, {}, { preserveScroll: true });
    const handleCapabilitiesSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        put(`/admin/drivers/${driver.id}/capabilities`, { preserveScroll: true });
    };
    const handleSharingSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        sharingForm.put(`/admin/drivers/${driver.id}/sharing`, { preserveScroll: true });
    };
    const handleVehicleAssignment = (event: React.FormEvent) => {
        event.preventDefault();
        vehicleAssignment.put(`/admin/drivers/${driver.id}/vehicle`, { preserveScroll: true });
    };
    const handleVehicleReview = (event: React.FormEvent) => {
        event.preventDefault();
        vehicleReview.put(`/admin/drivers/${driver.id}/vehicle/review`, { preserveScroll: true });
    };
    const reviewDocument = (documentId: number, status: 'approved' | 'rejected') => {
        const rejectionReason = status === 'rejected' ? window.prompt('Why is this document rejected?') : null;
        if (status === 'rejected' && !rejectionReason) return;
        router.put(`/admin/drivers/${driver.id}/documents/${documentId}`, {
            status,
            rejection_reason: rejectionReason,
        }, { preserveScroll: true });
    };

    return (
        <AdminLayout title={title}>
            <Head title={`Driver: ${driver.name}`} />

            <Stack gap="lg">
                <Group justify="space-between">
                    <Button 
                        variant="subtle" 
                        color="gray" 
                        leftSection={<ArrowLeft size={16} />}
                        component={Link}
                        href="/admin/drivers"
                    >
                        Back to Drivers
                    </Button>
                    <Group gap="sm">
                        {driver.status === 'pending' && (
                            <Button 
                                variant="filled" 
                                color="green" 
                                leftSection={<ShieldCheck size={16} />}
                                onClick={handleApprove}
                                disabled={!documentsReady}
                            >
                                Approve Driver
                            </Button>
                        )}
                        {driver.status === 'suspended' ? (
                            <Button 
                                variant="outline" 
                                color="green" 
                                leftSection={<Check size={16} />}
                                onClick={handleActivate}
                                disabled={!documentsReady}
                            >
                                Reactivate
                            </Button>
                        ) : (
                            <Button 
                                variant="outline" 
                                color="red" 
                                leftSection={<Ban size={16} />}
                                onClick={handleSuspend}
                            >
                                Suspend
                            </Button>
                        )}
                    </Group>
                </Group>

                <Grid gutter="lg">
                    {/* Driver Profile */}
                    <Grid.Col span={{ base: 12, md: 4 }}>
                        <Stack gap="lg">
                            <Paper p="xl" radius="md" withBorder>
                                <Stack align="center" gap="md">
                                    <Indicator 
                                        color={stats.is_online ? 'green' : 'gray'} 
                                        size={20} 
                                        offset={8} 
                                        position="bottom-end" 
                                        processing={stats.is_online}
                                        withBorder
                                    >
                                        <Avatar size={100} radius="xl" color="blue">
                                            {driver.name.charAt(0)}
                                        </Avatar>
                                    </Indicator>
                                    <Stack align="center" gap={4}>
                                        <Text size="xl" fw={700}>{driver.name}</Text>
                                        <Badge 
                                            variant="light" 
                                            color={driver.status === 'active' ? 'green' : driver.status === 'pending' ? 'yellow' : 'red'}
                                            size="lg"
                                        >
                                            {driver.status.toUpperCase()}
                                        </Badge>
                                    </Stack>
                                </Stack>

                                <Divider my="xl" />

                                <Stack gap="sm">
                                    <Group gap="md">
                                        <ThemeIcon variant="light" color="gray" radius="md">
                                            <Phone size={16} />
                                        </ThemeIcon>
                                        <div>
                                            <Text size="xs" color="dimmed">Mobile Number</Text>
                                            <Text size="sm" fw={500}>{driver.phone}</Text>
                                        </div>
                                    </Group>
                                    <Group gap="md">
                                        <ThemeIcon variant="light" color="gray" radius="md">
                                            <Car size={16} />
                                        </ThemeIcon>
                                        <div>
                                            <Text size="xs" color="dimmed">Vehicle Number</Text>
                                            <Text size="sm" fw={500}>{driver.vehicle_number}</Text>
                                        </div>
                                    </Group>
                                     <Group gap="md">
                                        <ThemeIcon variant="light" color="gray" radius="md">
                                            <Clock size={16} />
                                        </ThemeIcon>
                                        <div>
                                            <Text size="xs" color="dimmed">Last Seen</Text>
                                            <Text size="sm" fw={500}>
                                                {driver.driver_availability?.last_ping ? new Date(driver.driver_availability.last_ping).toLocaleString() : 'Never'}
                                            </Text>
                                        </div>
                                    </Group>
                                </Stack>
                            </Paper>

                            <Paper p="xl" radius="md" withBorder bg="teal.9">
                                <Group justify="space-between" mb="xs">
                                     <Text color="teal.1" size="xs" fw={700} tt="uppercase">Total Earnings</Text>
                                     <TrendingUp size={16} color="white" />
                                </Group>
                                <Text color="white" size="h1" fw={800}>₹{parseFloat(stats.total_earned.toString()).toLocaleString()}</Text>
                                <Text color="teal.1" size="xs" mt={4}>Current Wallet: ₹{stats.wallet_balance}</Text>
                                <Button fullWidth variant="white" color="teal.9" mt="xl" size="sm">Payout History</Button>
                            </Paper>

                            <Paper p="xl" radius="md" withBorder>
                                <Stack gap="lg">
                                    <Group gap="sm">
                                        <ThemeIcon variant="light" color="indigo" radius="md"><Car size={18} /></ThemeIcon>
                                        <div>
                                            <Text fw={700}>Driver vehicle</Text>
                                            <Text size="xs" c="dimmed">Assign and approve the car without leaving this driver.</Text>
                                        </div>
                                    </Group>
                                    <form onSubmit={handleVehicleAssignment}>
                                        <Stack gap="sm">
                                            <Select
                                                label="Assigned vehicle"
                                                clearable
                                                searchable
                                                data={available_vehicles.map((vehicle) => ({
                                                    value: String(vehicle.id),
                                                    label: `${vehicle.registration_number} · ${vehicle.make} ${vehicle.model}`,
                                                }))}
                                                value={vehicleAssignment.data.vehicle_id}
                                                onChange={(value) => vehicleAssignment.setData('vehicle_id', value || '')}
                                                error={vehicleAssignment.errors.vehicle_id}
                                            />
                                            <Button type="submit" variant="light" loading={vehicleAssignment.processing}>Save assignment</Button>
                                        </Stack>
                                    </form>
                                    {driver.vehicle ? (
                                        <>
                                            <Divider />
                                            <Group justify="space-between">
                                                <div>
                                                    <Text fw={700}>{driver.vehicle.make} {driver.vehicle.model}</Text>
                                                    <Text size="xs" c="dimmed">{driver.vehicle.registration_number} · {driver.vehicle.category?.name || 'Uncategorised'}</Text>
                                                    <div className="mt-3 grid grid-cols-2 gap-3">
                                                        {Object.entries(driver.vehicle.photo_urls || {}).map(([side, url]) => (
                                                            <a key={side} href={url} target="_blank" rel="noreferrer" className="rounded-lg border p-2">
                                                                <img src={url} alt={`${side} view of vehicle`} className="h-28 w-full rounded object-cover" />
                                                                <Text size="xs" mt={4} tt="capitalize">{side} view</Text>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                                <Badge color={driver.vehicle.approval_status === 'approved' ? 'green' : driver.vehicle.approval_status === 'rejected' ? 'red' : 'yellow'}>
                                                    {driver.vehicle.approval_status}
                                                </Badge>
                                            </Group>
                                            {driver.vehicle.category && (
                                                <SimpleGrid cols={3} spacing="xs">
                                                    <Paper p="xs" bg="gray.0"><Text size="xs" c="dimmed">Ride base</Text><Text fw={700}>₹{driver.vehicle.category.base_fare ?? 0}</Text></Paper>
                                                    <Paper p="xs" bg="gray.0"><Text size="xs" c="dimmed">Per km</Text><Text fw={700}>₹{driver.vehicle.category.price_per_km ?? 0}</Text></Paper>
                                                    <Paper p="xs" bg="gray.0"><Text size="xs" c="dimmed">Rental/day</Text><Text fw={700}>₹{driver.vehicle.category.base_price_per_day ?? 0}</Text></Paper>
                                                </SimpleGrid>
                                            )}
                                            <form onSubmit={handleVehicleReview}>
                                                <Stack gap="sm">
                                                    <Select label="Approval" data={['pending', 'approved', 'rejected']} value={vehicleReview.data.approval_status} onChange={(value) => vehicleReview.setData('approval_status', (value || 'pending') as typeof vehicleReview.data.approval_status)} />
                                                    <Select label="Condition" data={['excellent', 'good', 'fair', 'under_maintenance']} value={vehicleReview.data.condition} onChange={(value) => vehicleReview.setData('condition', (value || 'good') as typeof vehicleReview.data.condition)} />
                                                    {vehicleReview.data.approval_status === 'rejected' && <Textarea label="Rejection reason" value={vehicleReview.data.rejection_reason} onChange={(event) => vehicleReview.setData('rejection_reason', event.currentTarget.value)} error={vehicleReview.errors.rejection_reason} />}
                                                    <Button type="submit" color="indigo" loading={vehicleReview.processing}>Save vehicle review</Button>
                                                </Stack>
                                            </form>
                                        </>
                                    ) : <Text size="sm" c="dimmed">No car has been submitted or assigned.</Text>}
                                </Stack>
                            </Paper>

                            <Paper p="xl" radius="md" withBorder>
                                <Stack gap="md">
                                    <Group gap="sm"><ThemeIcon variant="light" color="teal"><FileCheck2 size={18} /></ThemeIcon><div><Text fw={700}>Document verification</Text><Text size="xs" c="dimmed">Licence, identity and RC are required. Police verification is optional.</Text></div></Group>
                                    <Badge color={documentsReady ? 'green' : 'yellow'} variant="light">
                                        {documentsReady ? 'Ready for driver activation' : 'Required documents pending'}
                                    </Badge>
                                    <Text size="sm" c="dimmed">{document_verification.message}</Text>
                                    {document_verification.requirements.filter((item) => item.required && item.status === 'missing').map((item) => (
                                        <Text key={item.type} size="sm">{item.label}: not submitted</Text>
                                    ))}
                                    {driver.documents.length ? driver.documents.map((document) => (
                                        <Paper key={document.id} p="sm" radius="md" withBorder>
                                            <Stack gap="xs">
                                                <Group justify="space-between">
                                                    <div><Text size="sm" fw={700}>{document_verification.requirements.find((item) => item.type === document.type)?.label || document.type.replaceAll('_', ' ')}</Text><Text size="xs" c="dimmed">{document.document_number || 'No document number'}</Text></div>
                                                    <Badge color={document_verification.requirements.find((item) => item.type === document.type)?.status === 'expired' ? 'red' : document.status === 'approved' ? 'green' : document.status === 'rejected' ? 'red' : 'yellow'}>{document_verification.requirements.find((item) => item.type === document.type)?.status || document.status}</Badge>
                                                </Group>
                                                {document.rejection_reason && <Text size="xs" c="red">{document.rejection_reason}</Text>}
                                                <Group gap="xs">
                                                    <Button size="xs" variant="light" component="a" href={document.file_url} target="_blank">View file</Button>
                                                    <Button size="xs" color="red" variant="outline" onClick={() => reviewDocument(document.id, 'rejected')}>Reject</Button>
                                                </Group>
                                                <DocumentProviderForm driverId={driver.id} documentId={document.id} providers={verification_providers[document.type] || []} disabled={document.status === 'approved' || document_verification.requirements.find((item) => item.type === document.type)?.status === 'expired'} />
                                                {(verification_attempts[document.id] || []).map((attempt) => <Paper key={attempt.id} p="xs" bg="gray.0">
                                                    <Text size="xs" fw={600}>{attempt.provider} · {attempt.status}{attempt.simulated ? ' · Simulation' : ''}</Text>
                                                    <Text size="xs">{attempt.message}</Text>
                                                    <Text size="xs" c="dimmed">{attempt.reference || 'Awaiting reference'} · {new Date(attempt.created_at).toLocaleString()} · Reviewer #{attempt.requested_by ?? 'deleted'}</Text>
                                                </Paper>)}
                                            </Stack>
                                        </Paper>
                                    )) : <Text size="sm" c="dimmed">No documents submitted yet.</Text>}
                                </Stack>
                            </Paper>

                            <Paper p="xl" radius="md" withBorder>
                                <form onSubmit={handleCapabilitiesSubmit}>
                                    <Stack gap="lg">
                                        <Group gap="sm">
                                            <ThemeIcon variant="light" color="blue" radius="md">
                                                <BadgeCheck size={18} />
                                            </ThemeIcon>
                                            <div>
                                                <Text fw={700}>Capabilities</Text>
                                                <Text size="xs" color="dimmed">Driver app eligibility and guide-style profile.</Text>
                                            </div>
                                        </Group>

                                        <Stack gap="sm">
                                            <Switch
                                                label="Short rides"
                                                checked={data.can_short_ride}
                                                onChange={(event) => setData('can_short_ride', event.currentTarget.checked)}
                                            />
                                            <Switch
                                                label="Long rides"
                                                checked={data.can_long_ride}
                                                onChange={(event) => setData('can_long_ride', event.currentTarget.checked)}
                                            />
                                            <Switch
                                                label="Tour lead"
                                                checked={data.can_tour_lead}
                                                onChange={(event) => setData('can_tour_lead', event.currentTarget.checked)}
                                            />
                                            <Switch
                                                label="Tour transport"
                                                checked={data.can_tour_transport}
                                                onChange={(event) => setData('can_tour_transport', event.currentTarget.checked)}
                                            />
                                            <Switch
                                                label="Rental delivery"
                                                checked={data.can_rental_delivery}
                                                onChange={(event) => setData('can_rental_delivery', event.currentTarget.checked)}
                                            />
                                        </Stack>

                                        <Divider />

                                        <TagsInput
                                            label="Languages"
                                            placeholder="Add language"
                                            value={data.languages}
                                            onChange={(value) => setData('languages', value)}
                                            leftSection={<Languages size={16} />}
                                            error={errors.languages}
                                            splitChars={[',']}
                                        />
                                        <TagsInput
                                            label="Expertise tags"
                                            placeholder="Add expertise"
                                            value={data.expertise_tags}
                                            onChange={(value) => setData('expertise_tags', value)}
                                            error={errors.expertise_tags}
                                            splitChars={[',']}
                                        />
                                        <Textarea
                                            label="Certification notes"
                                            placeholder="Tour guide certifications, local permits, training notes"
                                            rows={4}
                                            value={data.certification_notes}
                                            onChange={(event) => setData('certification_notes', event.currentTarget.value)}
                                            error={errors.certification_notes}
                                        />

                                        <Button type="submit" leftSection={<Save size={16} />} loading={processing}>
                                            Save Capabilities
                                        </Button>
                                    </Stack>
                                </form>
                            </Paper>

                            <Paper p="xl" radius="md" withBorder>
                                <form onSubmit={handleSharingSubmit}>
                                    <Stack gap="lg">
                                        <Group gap="sm">
                                            <ThemeIcon variant="light" color="teal" radius="md">
                                                <UsersRound size={18} />
                                            </ThemeIcon>
                                            <div>
                                                <Text fw={700}>Point-to-point sharing</Text>
                                                <Text size="xs" c="dimmed">Allow customers to reserve seats instead of the full car.</Text>
                                            </div>
                                        </Group>
                                        <Switch
                                            label="Driver accepts shared rides"
                                            description="Customers see a reduced shared fare. The first customer can also open a shared ride when this is off."
                                            checked={sharingForm.data.sharing_enabled}
                                            onChange={(event) => sharingForm.setData('sharing_enabled', event.currentTarget.checked)}
                                        />
                                        <NumberInput
                                            label="Shareable passenger seats"
                                            description="Maximum passenger seats offered for shared point-to-point rides."
                                            min={2}
                                            max={6}
                                            clampBehavior="strict"
                                            value={sharingForm.data.sharing_seat_capacity}
                                            onChange={(value) => sharingForm.setData('sharing_seat_capacity', Number(value) || 3)}
                                            error={sharingForm.errors.sharing_seat_capacity}
                                        />
                                        <Button type="submit" color="teal" leftSection={<Save size={16} />} loading={sharingForm.processing}>
                                            Save Sharing Preference
                                        </Button>
                                    </Stack>
                                </form>
                            </Paper>
                        </Stack>
                    </Grid.Col>

                    {/* Driver Stats and Activity */}
                    <Grid.Col span={{ base: 12, md: 8 }}>
                        <Stack gap="lg">
                            <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="lg">
                                <Card padding="lg" radius="md" withBorder>
                                    <Stack gap={4}>
                                        <Text size="xs" color="dimmed" fw={700} tt="uppercase">Successful Rides</Text>
                                        <Group justify="space-between" align="flex-end">
                                            <Group gap="xs">
                                                <Check size={18} color="var(--mantine-color-green-6)" />
                                                <Text size="xl" fw={700}>{stats.completed_rides}</Text>
                                            </Group>
                                            <Text size="xs" color="green" fw={600}>{stats.total_rides > 0 ? Math.round((stats.completed_rides / stats.total_rides) * 100) : 0}% success</Text>
                                        </Group>
                                        <Progress value={stats.total_rides > 0 ? (stats.completed_rides / stats.total_rides) * 100 : 0} size="xs" color="green" mt="sm" />
                                    </Stack>
                                </Card>
                                <Card padding="lg" radius="md" withBorder>
                                    <Stack gap={4}>
                                        <Text size="xs" color="dimmed" fw={700} tt="uppercase">Customer Rating</Text>
                                        <Group gap="xs">
                                            <Star size={18} fill="var(--mantine-color-yellow-5)" color="var(--mantine-color-yellow-6)" />
                                            <Text size="xl" fw={700}>{stats.average_rating !== null ? stats.average_rating.toFixed(1) : '—'}</Text>
                                            <Text size="xs" c="dimmed">/ 5</Text>
                                        </Group>
                                        <Text size="xs" c="dimmed">Based on {stats.ratings_count} {stats.ratings_count === 1 ? 'rating' : 'ratings'}</Text>
                                    </Stack>
                                </Card>
                                <Card padding="lg" radius="md" withBorder>
                                    <Stack gap={4}>
                                        <Text size="xs" color="dimmed" fw={700} tt="uppercase">Total Rides</Text>
                                        <Group gap="xs">
                                            <Activity size={18} color="var(--mantine-color-blue-6)" />
                                            <Text size="xl" fw={700}>{stats.total_rides}</Text>
                                        </Group>
                                    </Stack>
                                </Card>
                                <Card padding="lg" radius="md" withBorder>
                                    <Stack gap={4}>
                                        <Text size="xs" color="dimmed" fw={700} tt="uppercase">Work Status</Text>
                                        <Badge 
                                            fullWidth 
                                            size="lg" 
                                            variant="dot" 
                                            color={stats.is_online ? (stats.is_available ? 'green' : 'orange') : 'gray'}
                                        >
                                            {stats.is_online ? (stats.is_available ? 'Ready' : 'In Ride') : 'Offline'}
                                        </Badge>
                                    </Stack>
                                </Card>
                            </SimpleGrid>

                            <Paper radius="md" withBorder>
                                <Tabs defaultValue="rides" variant="outline">
                                    <Tabs.List px="md" pt="md">
                                        <Tabs.Tab value="rides" leftSection={<Navigation size={14} />}>Recent Rides</Tabs.Tab>
                                        <Tabs.Tab value="tours" leftSection={<Map size={14} />}>Assigned Tours</Tabs.Tab>
                                        <Tabs.Tab value="reviews" leftSection={<MessageSquareText size={14} />}>Customer Feedback ({stats.ratings_count})</Tabs.Tab>
                                        <Tabs.Tab value="location" leftSection={<MapPin size={14} />}>Live Tracker</Tabs.Tab>
                                    </Tabs.List>

                                    <Tabs.Panel value="rides" p="md">
                                        <Table verticalSpacing="sm" highlightOnHover>
                                            <Table.Thead>
                                                <Table.Tr>
                                                    <Table.Th>ID</Table.Th>
                                                    <Table.Th>Date</Table.Th>
                                                    <Table.Th>Route</Table.Th>
                                                    <Table.Th>Status</Table.Th>
                                                    <Table.Th>Earnings</Table.Th>
                                                    <Table.Th />
                                                </Table.Tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                                {driver.assigned_ride_bookings.length > 0 ? driver.assigned_ride_bookings.map((ride) => (
                                                    <Table.Tr key={ride.id}>
                                                        <Table.Td><Text size="sm" fw={500}>#{ride.booking_number}</Text></Table.Td>
                                                        <Table.Td><Text size="xs">{new Date(ride.scheduled_at).toLocaleDateString()}</Text></Table.Td>
                                                        <Table.Td>
                                                            <Text size="xs" lineClamp={1}>{ride.pickup_location} → {ride.dropoff_location}</Text>
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <Badge size="xs" variant="light" color={ride.status === 'completed' ? 'green' : 'blue'}>{ride.status}</Badge>
                                                        </Table.Td>
                                                        <Table.Td><Text size="sm" fw={600}>₹{ride.total_fare}</Text></Table.Td>
                                                        <Table.Td>
                                                            <ActionIcon variant="subtle" color="gray" component={Link} href={`/admin/ride-bookings/${ride.id}`}>
                                                                <ExternalLink size={14} />
                                                            </ActionIcon>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                )) : (
                                                    <Table.Tr><Table.Td colSpan={6} py="xl"><Text ta="center" color="dimmed">No ride activity recorded yet</Text></Table.Td></Table.Tr>
                                                )}
                                            </Table.Tbody>
                                        </Table>
                                    </Tabs.Panel>

                                    <Tabs.Panel value="tours" p="md">
                                        <Table verticalSpacing="sm">
                                            <Table.Tbody>
                                                {driver.tour_driver_assignments.length > 0 ? driver.tour_driver_assignments.map((td) => (
                                                    <Table.Tr key={td.id}>
                                                        <Table.Td><Text size="sm" fw={600}>{td.schedule?.tour?.title}</Text></Table.Td>
                                                        <Table.Td><Text size="xs">{td.role ?? 'Tour Driver'}</Text></Table.Td>
                                                        <Table.Td>
                                                            <ActionIcon variant="subtle" color="blue" component={Link} href={`/admin/tours/${td.schedule?.tour?.id}`}>
                                                                <ExternalLink size={14} />
                                                            </ActionIcon>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                )) : (
                                                    <Table.Tr><Table.Td colSpan={3} py="xl"><Text ta="center" color="dimmed">No tours assigned to this driver</Text></Table.Td></Table.Tr>
                                                )}
                                            </Table.Tbody>
                                        </Table>
                                    </Tabs.Panel>

                                    <Tabs.Panel value="reviews" p="md">
                                        {reviews.length > 0 ? (
                                            <Stack gap="sm">
                                                {reviews.map((review) => (
                                                    <Paper key={review.id} p="md" radius="md" withBorder>
                                                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                                                            <Group align="flex-start" wrap="nowrap">
                                                                <Avatar color="blue" radius="xl">{review.customer_name.charAt(0).toUpperCase()}</Avatar>
                                                                <div>
                                                                    <Group gap="xs">
                                                                        <Text size="sm" fw={700}>{review.customer_name}</Text>
                                                                        <Badge size="xs" variant="light">{review.service}</Badge>
                                                                    </Group>
                                                                    <Group gap="xs" mt={4}>
                                                                        <Rating value={review.rating ?? 0} fractions={2} readOnly size="sm" aria-label={`${review.rating ?? 0} out of 5`} />
                                                                        {review.booking_number && <Text size="xs" c="dimmed">#{review.booking_number}</Text>}
                                                                    </Group>
                                                                </div>
                                                            </Group>
                                                            {review.created_at && <Text size="xs" c="dimmed">{new Date(review.created_at).toLocaleDateString()}</Text>}
                                                        </Group>
                                                        <Text mt="md" size="sm" lh={1.6} c={review.feedback ? undefined : 'dimmed'} fs={review.feedback ? undefined : 'italic'}>
                                                            {review.feedback || 'Rating submitted without written feedback.'}
                                                        </Text>
                                                    </Paper>
                                                ))}
                                            </Stack>
                                        ) : (
                                            <Stack align="center" py="xl" gap="xs">
                                                <MessageSquareText size={40} strokeWidth={1.2} color="var(--mantine-color-gray-5)" />
                                                <Text fw={600}>No customer feedback yet</Text>
                                                <Text size="sm" c="dimmed">Ratings from completed rides, rentals and tours will appear here.</Text>
                                            </Stack>
                                        )}
                                    </Tabs.Panel>

                                    <Tabs.Panel value="location" p="xl">
                                        {driver.vehicle ? (
                                            <Group justify="space-between" align="center" py="md">
                                                <Group>
                                                    <ThemeIcon size={52} radius="lg" variant="light" color="teal"><MapPin size={24} /></ThemeIcon>
                                                    <div>
                                                        <Group gap="xs">
                                                            <Text fw={700}>{driver.vehicle.registration_number}</Text>
                                                            <Badge size="sm" color={driver.vehicle.tracker?.status === 'active' ? 'green' : 'orange'}>
                                                                {driver.vehicle.tracker?.status === 'active' ? 'GPS provisioned' : 'GPS setup required'}
                                                            </Badge>
                                                        </Group>
                                                        <Text size="sm" c="dimmed">{driver.vehicle.make} {driver.vehicle.model} · hardware vehicle tracking</Text>
                                                    </div>
                                                </Group>
                                                <Button component={Link} href={`/admin/vehicles/${driver.vehicle.id}/tracking`} leftSection={<Navigation size={16} />}>
                                                    Open live tracker
                                                </Button>
                                            </Group>
                                        ) : (
                                            <Stack align="center" py="xl">
                                                <MapPin size={48} strokeWidth={1} color="var(--mantine-color-gray-4)" />
                                                <Text color="dimmed" size="sm">Assign the driver’s car before vehicle GPS tracking is available.</Text>
                                            </Stack>
                                        )}
                                    </Tabs.Panel>
                                </Tabs>
                            </Paper>
                        </Stack>
                    </Grid.Col>
                </Grid>
            </Stack>
        </AdminLayout>
    );
}
