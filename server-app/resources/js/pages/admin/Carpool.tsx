import AdminLayout from '@/layouts/AdminLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    Alert,
    Badge,
    Button,
    Checkbox,
    Group,
    NumberInput,
    Paper,
    Select,
    SimpleGrid,
    Stack,
    Tabs,
    Text,
    Textarea,
    TextInput,
    Title,
} from '@mantine/core';
import { useState } from 'react';

type Rules = {
    bounds: { south: number; north: number; west: number; east: number };
    review_note: string;
    fuel_price_minor_per_litre: number;
    max_toll_minor: number;
    consumption_ml_per_km: Record<string, number>;
    vehicle_consumption_ml_per_km?: Record<string, number>;
    driver_min_bps: number;
    allocation: string;
    fee_bps: number;
    fee_fixed_minor: number;
    payment_methods: string[];
    hold_minutes: number;
    approval_minutes: number;
    dispute_hours: number;
    no_show_minutes: number;
    no_show_refund_bps: number;
    proximity_m: number;
    min_distance_m: number;
    max_route_factor: number;
    cancellation: { free_hours: number; late_refund_bps: number };
};
type Policy = { id: number; region: string; currency: string; version: number; enabled: boolean; rules: Rules };
type Ride = { id: number; origin: string; destination: string; status: string; departure_at: string; driver: { name: string }; seats: number };
type Booking = {
    id: number;
    carpool_ride_id: number;
    status: string;
    payment_status: string;
    refund_status: string;
    payout_status: string;
    total_minor: number;
    currency: string;
};
type Review = { id: number; carpool_booking_id: number; rating: number; body: string; status: string };
type Complaint = { id: number; carpool_booking_id: number; body: string; status: string; resolution: string | null };
const defaults: Rules = {
    bounds: { south: 0, north: 0, west: 0, east: 0 },
    review_note: '',
    fuel_price_minor_per_litre: 0,
    max_toll_minor: 0,
    consumption_ml_per_km: {},
    driver_min_bps: 2500,
    allocation: 'equal_occupants',
    fee_bps: 0,
    fee_fixed_minor: 0,
    payment_methods: ['cash'],
    hold_minutes: 10,
    approval_minutes: 120,
    dispute_hours: 48,
    no_show_minutes: 15,
    no_show_refund_bps: 10000,
    proximity_m: 5000,
    min_distance_m: 20000,
    max_route_factor: 3,
    cancellation: { free_hours: 24, late_refund_bps: 0 },
};

export default function Carpool({
    policies,
    rides,
    bookings,
    reviews,
    complaints,
}: {
    policies: Policy[];
    rides: Ride[];
    bookings: Booking[];
    reviews: Review[];
    complaints: Complaint[];
}) {
    const form = useForm<{ region: string; currency: string; enabled: boolean; rules: Rules }>({
        region: '',
        currency: 'INR',
        enabled: false,
        rules: defaults,
    });
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [fuel, setFuel] = useState('petrol');
    const [vehicleId, setVehicleId] = useState('');
    const setRule = <K extends keyof Rules>(key: K, value: Rules[K]) => form.setData('rules', { ...form.data.rules, [key]: value });
    function action(kind: string, id: number, operation: string) {
        if (reason.trim().length < 5) {
            setNotice('Enter an audit reason of at least five characters before taking an action.');
            return;
        }
        if (operation === 'cancel' && !window.confirm('Cancel this trip, notify passengers and queue applicable refunds?')) return;
        setBusy(true);
        router.post(
            `/admin/carpool/${kind}/${id}`,
            { action: operation, reason },
            {
                preserveScroll: true,
                onSuccess: () => setNotice('Action processed. Review the resulting status below.'),
                onError: (errors) => setNotice(Object.values(errors).join(' ')),
                onFinish: () => setBusy(false),
            },
        );
    }
    const numeric: [keyof Rules, string, number, number][] = [
        ['fuel_price_minor_per_litre', 'Fuel price estimate (minor units / litre)', 1, 1000000],
        ['max_toll_minor', 'Maximum declared toll estimate (minor units)', 0, 10000000],
        ['driver_min_bps', 'Minimum driver share (basis points; 2500 = 25%)', 1, 10000],
        ['fee_bps', 'Platform fee (basis points)', 0, 10000],
        ['fee_fixed_minor', 'Fixed fee per booking (minor units)', 0, 100000],
        ['no_show_refund_bps', 'No-show refund (basis points; 10000 = full refund)', 0, 10000],
        ['hold_minutes', 'Checkout hold (minutes)', 1, 60],
        ['approval_minutes', 'Request deadline (minutes)', 1, 2880],
        ['dispute_hours', 'Payout dispute window (hours)', 0, 720],
        ['no_show_minutes', 'No-show wait after departure (minutes)', 5, 180],
        ['proximity_m', 'Endpoint proximity (metres)', 100, 25000],
        ['min_distance_m', 'Minimum intercity distance (metres)', 1000, 100000],
        ['max_route_factor', 'Maximum road / direct-distance ratio', 1, 5],
    ];
    return (
        <AdminLayout title="Carpool">
            <Head title="Carpool operations" />
            <Stack gap="lg">
                <Group justify="space-between">
                    <div>
                        <Title order={2}>Intercity carpool</Title>
                        <Text c="dimmed">Cost sharing, participant safety, and separate financial records.</Text>
                    </div>
                    <Group>
                        <Button component={Link} href="/admin/drivers" variant="default">
                            Driver verification
                        </Button>
                        <Button component={Link} href="/admin/vehicles" variant="default">
                            Vehicle verification
                        </Button>
                    </Group>
                </Group>
                {notice && (
                    <Alert onClose={() => setNotice('')} withCloseButton>
                        {notice}
                    </Alert>
                )}
                <Tabs defaultValue="rides">
                    <Tabs.List>
                        <Tabs.Tab value="rides">Rides</Tabs.Tab>
                        <Tabs.Tab value="bookings">Bookings & payments</Tabs.Tab>
                        <Tabs.Tab value="policies">Regional policies</Tabs.Tab>
                        <Tabs.Tab value="moderation">Complaints & reviews</Tabs.Tab>
                    </Tabs.List>
                    <Paper withBorder p="md" my="md">
                        <TextInput
                            label="Audit reason for operational actions"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            minLength={5}
                            maxLength={2000}
                        />
                    </Paper>
                    <Tabs.Panel value="rides">
                        <Stack>
                            {!rides.length && <Text>No carpool rides yet.</Text>}
                            {rides.map((ride) => (
                                <Paper key={ride.id} p="md" withBorder>
                                    <Group justify="space-between">
                                        <div>
                                            <Text fw={600}>
                                                #{ride.id} · {ride.origin} → {ride.destination}
                                            </Text>
                                            <Text>
                                                {ride.driver?.name} · {new Date(ride.departure_at).toLocaleString()} · {ride.seats} seats
                                            </Text>
                                            <Badge>{ride.status}</Badge>
                                        </div>
                                        {['draft', 'published'].includes(ride.status) && (
                                            <Button color="red" disabled={busy} onClick={() => action('rides', ride.id, 'cancel')}>
                                                Cancel and notify
                                            </Button>
                                        )}
                                    </Group>
                                </Paper>
                            ))}
                        </Stack>
                    </Tabs.Panel>
                    <Tabs.Panel value="bookings">
                        <Stack>
                            {!bookings.length && <Text>No carpool bookings yet.</Text>}
                            {bookings.map((b) => (
                                <Paper key={b.id} p="md" withBorder>
                                    <Group justify="space-between">
                                        <div>
                                            <Text fw={600}>
                                                Booking #{b.id} · Ride #{b.carpool_ride_id} · {b.currency} {(b.total_minor / 100).toFixed(2)}
                                            </Text>
                                            <Text>
                                                Booking: {b.status} · Payment: {b.payment_status}
                                            </Text>
                                            <Text>
                                                Refund: {b.refund_status} · Payout: {b.payout_status}
                                            </Text>
                                        </div>
                                        <Group>
                                            <Button variant="default" disabled={busy} onClick={() => action('bookings', b.id, 'settle')}>
                                                Process eligible settlement
                                            </Button>
                                            <Button
                                                color="red"
                                                variant="light"
                                                disabled={busy}
                                                onClick={() => {
                                                    if (
                                                        window.confirm(
                                                            'Authorize a full online refund? This records a financial decision and processes it when the provider is available.',
                                                        )
                                                    )
                                                        action('bookings', b.id, 'refund');
                                                }}
                                            >
                                                Authorize full refund
                                            </Button>
                                        </Group>
                                    </Group>
                                </Paper>
                            ))}
                        </Stack>
                    </Tabs.Panel>
                    <Tabs.Panel value="policies">
                        <Stack mt="md">
                            <Alert>
                                Markets start disabled. Price caps are product controls, not legal clearance. Review regional eligibility, cash
                                collection, fees, cancellation terms and marketplace payouts before activation. Fuel and toll values are estimates,
                                not live data.
                            </Alert>
                            <Select
                                label="Copy an existing policy to a new version"
                                placeholder="Choose policy"
                                data={policies.map((p) => ({
                                    value: String(p.id),
                                    label: `${p.region} v${p.version} · ${p.enabled ? 'enabled' : 'disabled'}`,
                                }))}
                                onChange={(id) => {
                                    const p = policies.find((p) => String(p.id) === id);
                                    if (p)
                                        form.setData({
                                            region: p.region,
                                            currency: p.currency,
                                            enabled: p.enabled,
                                            rules: { ...p.rules, review_note: '' },
                                        });
                                }}
                            />
                            <Paper p="lg" withBorder>
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        form.post('/admin/carpool/policies', {
                                            preserveScroll: true,
                                            onSuccess: () => setNotice('New policy version saved.'),
                                        });
                                    }}
                                >
                                    <Stack>
                                        <SimpleGrid cols={{ base: 1, sm: 2 }}>
                                            <TextInput
                                                label="Region identifier"
                                                required
                                                value={form.data.region}
                                                onChange={(e) => form.setData('region', e.target.value)}
                                            />
                                            <TextInput
                                                label="Currency (ISO code; amounts use 1/100 units)"
                                                required
                                                maxLength={3}
                                                value={form.data.currency}
                                                onChange={(e) => form.setData('currency', e.target.value.toUpperCase())}
                                            />
                                            {numeric.map(([key, label, min, max]) => (
                                                <NumberInput
                                                    key={key}
                                                    label={label}
                                                    required
                                                    min={min}
                                                    max={max}
                                                    allowDecimal={false}
                                                    value={Number(form.data.rules[key])}
                                                    onChange={(v) => setRule(key, Number(v) as never)}
                                                />
                                            ))}
                                            <Select
                                                label="Cost allocation"
                                                value={form.data.rules.allocation}
                                                data={[
                                                    { value: 'equal_occupants', label: 'Equal shares including driver' },
                                                    { value: 'passenger_pool', label: 'Passenger pool after minimum driver share' },
                                                ]}
                                                onChange={(v) => setRule('allocation', v || 'equal_occupants')}
                                            />
                                            <NumberInput
                                                label="Free cancellation cutoff (hours)"
                                                min={0}
                                                max={168}
                                                value={form.data.rules.cancellation.free_hours}
                                                onChange={(v) => setRule('cancellation', { ...form.data.rules.cancellation, free_hours: Number(v) })}
                                            />
                                            <NumberInput
                                                label="Late cancellation refund (basis points)"
                                                min={0}
                                                max={10000}
                                                value={form.data.rules.cancellation.late_refund_bps}
                                                onChange={(v) =>
                                                    setRule('cancellation', { ...form.data.rules.cancellation, late_refund_bps: Number(v) })
                                                }
                                            />
                                        </SimpleGrid>
                                        <Title order={3}>Regional service area</Title><Text size="sm">Both route endpoints must fall inside these reviewed bounds. Regions crossing the date line must be configured separately.</Text><SimpleGrid cols={{ base: 1, sm: 2 }}>{(['south', 'north', 'west', 'east'] as const).map(side => <NumberInput key={side} label={`${side} boundary (degrees)`} required decimalScale={6} value={form.data.rules.bounds?.[side] ?? 0} onChange={v => setRule('bounds', { ...form.data.rules.bounds, [side]: Number(v) })} />)}</SimpleGrid><Title order={3}>Vehicle fuel consumption estimates</Title>
                                        <Group align="end">
                                            <Select
                                                label="Fuel type"
                                                data={['petrol', 'diesel', 'hybrid']}
                                                value={fuel}
                                                onChange={(v) => setFuel(v || 'petrol')}
                                            />
                                            <NumberInput
                                                label="Millilitres per kilometre"
                                                min={1}
                                                max={1000}
                                                value={form.data.rules.consumption_ml_per_km[fuel] ?? ''}
                                                onChange={(v) =>
                                                    setRule('consumption_ml_per_km', { ...form.data.rules.consumption_ml_per_km, [fuel]: Number(v) })
                                                }
                                            />
                                        </Group>
                                        <Text size="sm">
                                            Only configured fuel types can publish. Do not enable electric/CNG vehicles using liquid-fuel estimates;
                                            use an appropriate reviewed adapter first.
                                        </Text>
                                        <Group align="end">
                                            <TextInput
                                                label="Optional vehicle-specific estimate: vehicle ID"
                                                value={vehicleId}
                                                onChange={(e) => setVehicleId(e.target.value.replace(/[^0-9]/g, ''))}
                                            />
                                            <NumberInput
                                                label="Vehicle consumption (ml/km)"
                                                min={1}
                                                max={1000}
                                                disabled={!vehicleId}
                                                value={form.data.rules.vehicle_consumption_ml_per_km?.[vehicleId] ?? ''}
                                                onChange={(v) => {
                                                    if (vehicleId)
                                                        setRule('vehicle_consumption_ml_per_km', {
                                                            ...form.data.rules.vehicle_consumption_ml_per_km,
                                                            [vehicleId]: Number(v),
                                                        });
                                                }}
                                            />
                                        </Group>
                                        <Checkbox.Group
                                            label="Allowed payment methods"
                                            value={form.data.rules.payment_methods}
                                            onChange={(v) => setRule('payment_methods', v)}
                                        >
                                            <Group mt="xs">
                                                <Checkbox value="cash" label="Cash directly to driver (requires zero fees)" />
                                                <Checkbox value="online" label="Online (requires configured settlement provider)" />
                                            </Group>
                                        </Checkbox.Group>
                                        <Textarea
                                            label="Regional policy review and estimate source"
                                            required
                                            minLength={10}
                                            value={form.data.rules.review_note}
                                            onChange={(e) => setRule('review_note', e.target.value)}
                                        />
                                        <Checkbox
                                            label="Enable this market after review"
                                            checked={form.data.enabled}
                                            onChange={(e) => form.setData('enabled', e.currentTarget.checked)}
                                        />
                                        {Object.values(form.errors).length > 0 && <Alert color="red">{Object.values(form.errors).join(' ')}</Alert>}
                                        <Button type="submit" loading={form.processing}>
                                            Save new policy version
                                        </Button>
                                    </Stack>
                                </form>
                            </Paper>
                        </Stack>
                    </Tabs.Panel>
                    <Tabs.Panel value="moderation">
                        <Stack mt="md">
                            <Title order={3}>Complaints and disputes</Title>
                            {!complaints.length && <Text>No complaints.</Text>}
                            {complaints.map((c) => (
                                <Paper key={c.id} p="md" withBorder>
                                    <Text fw={600}>
                                        #{c.id} · Booking #{c.carpool_booking_id} · {c.status}
                                    </Text>
                                    <Text>{c.body}</Text>
                                    {c.resolution && <Text>Resolution: {c.resolution}</Text>}
                                    {c.status === 'open' && (
                                        <Button mt="sm" disabled={busy} onClick={() => action('complaints', c.id, 'resolved')}>
                                            Resolve using audit reason
                                        </Button>
                                    )}
                                </Paper>
                            ))}
                            <Title order={3}>Reviews</Title>
                            {reviews.map((r) => (
                                <Paper key={r.id} p="md" withBorder>
                                    <Text>
                                        Booking #{r.carpool_booking_id} · {r.rating}/5 · {r.status}
                                    </Text>
                                    <Text>{r.body}</Text>
                                    <Button
                                        mt="sm"
                                        variant="default"
                                        disabled={busy}
                                        onClick={() => action('reviews', r.id, r.status === 'published' ? 'hidden' : 'published')}
                                    >
                                        {r.status === 'published' ? 'Hide review' : 'Publish review'}
                                    </Button>
                                </Paper>
                            ))}
                        </Stack>
                    </Tabs.Panel>
                </Tabs>
                <Text size="sm" c="dimmed">
                    Operations shows the latest 100 records per section. Financial entries carry the CarpoolBooking reference type.
                </Text>
            </Stack>
        </AdminLayout>
    );
}
