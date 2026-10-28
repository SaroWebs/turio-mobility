import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import axios from 'axios';
import AdminLayout from '@/layouts/AdminLayout';
import {
    Alert,
    Badge,
    Button,
    Card,
    Checkbox,
    Divider,
    Grid,
    Group,
    Paper,
    Select,
    SimpleGrid,
    Stack,
    Table,
    Text,
    Textarea,
    TextInput,
    Timeline,
} from '@mantine/core';
import { AlertCircle, ArrowLeft, CheckCircle2, CreditCard, IndianRupee, RefreshCcw, Star, User } from 'lucide-react';

interface Person {
    id: number;
    name: string;
    phone?: string;
    email?: string;
}

interface BookingRefund {
    id: number;
    amount: string;
    cancellation_fee: string;
    method: string;
    status: string;
    reason?: string | null;
    processed_at?: string | null;
}

interface BookingIncident {
    id: number;
    type: string;
    severity: string;
    status: string;
    title: string;
    description?: string | null;
    resolution?: string | null;
    reported_at?: string | null;
}

interface BookingAuditLog {
    id: number;
    action: string;
    note?: string | null;
    created_at: string;
    admin?: Person | null;
}

interface BookingReview {
    id: number;
    tour_rating: number;
    driver_rating?: number | null;
    review?: string | null;
    customer?: Person | null;
    driver?: Person | null;
}

interface TourBooking {
    id: number;
    booking_number: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    number_of_adults: number;
    number_of_children: number;
    travel_date: string;
    subtotal: string;
    discount_amount: string;
    total_price: string;
    commission_amount?: string | null;
    driver_share?: string | null;
    status: string;
    payment_status: string;
    payment_method: string;
    special_requests?: string | null;
    internal_notes?: string | null;
    cancellation_reason?: string | null;
    cancellation_fee?: string | null;
    refund_amount?: string | null;
    cancelled_at?: string | null;
    refunded_at?: string | null;
    current_lat?: string | null;
    current_lng?: string | null;
    last_location_update?: string | null;
    current_stop_index?: number | null;
    tour?: { id: number; title: string } | null;
    schedule?: { id: number; departure_date: string; return_date?: string | null; tour?: { title: string } | null } | null;
    assigned_driver?: Person | null;
    refunds: BookingRefund[];
    incidents: BookingIncident[];
    audit_logs: BookingAuditLog[];
    reviews: BookingReview[];
}

interface Props {
    title: string;
    booking: TourBooking;
    amendmentSchedules: { id: number; departure_date: string; departure_time: string; departure_point: string }[];
}

const statusOptions = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'].map((value) => ({ value, label: value.replace('_', ' ') }));
const paymentMethodOptions = ['cash', 'card', 'upi', 'bank_transfer'].map((value) => ({ value, label: value.replace('_', ' ') }));

export default function TourBookingShow({ title, booking, amendmentSchedules }: Props) {
    const [status, setStatus] = useState(booking.status);
    const [cancellationReason, setCancellationReason] = useState('');
    const [paymentMethod, setPaymentMethod] = useState(['cash', 'card', 'upi', 'bank_transfer'].includes(booking.payment_method || '') ? booking.payment_method : 'cash');
    const [paymentReference, setPaymentReference] = useState('');
    const [paymentNote, setPaymentNote] = useState('');
    const [incidentTitle, setIncidentTitle] = useState('');
    const [incidentType, setIncidentType] = useState('no_show');
    const [incidentSeverity, setIncidentSeverity] = useState('medium');
    const [incidentDescription, setIncidentDescription] = useState('');
    const [processing, setProcessing] = useState(false);
    const [targetSchedule, setTargetSchedule] = useState<string | null>(null);
    const [amendmentReason, setAmendmentReason] = useState('');
    const [customerAgreed, setCustomerAgreed] = useState(false);
    const [amendmentError, setAmendmentError] = useState('');
    const [amendmentRequestId, setAmendmentRequestId] = useState(() => crypto.randomUUID());

    const amendDeparture = async () => {
        if (processing || !targetSchedule || !customerAgreed || !amendmentReason.trim()) return;
        setProcessing(true);
        setAmendmentError('');
        try {
            await axios.post(`/admin/tour-bookings/${booking.id}/amend-departure`, {
                source_schedule_id: booking.schedule?.id,
                target_schedule_id: Number(targetSchedule),
                customer_agreed: customerAgreed,
                reason: amendmentReason,
                request_id: amendmentRequestId,
            });
            setTargetSchedule(null);
            setAmendmentReason('');
            setCustomerAgreed(false);
            setAmendmentRequestId(crypto.randomUUID());
            router.reload();
        } catch (error) {
            setAmendmentError(axios.isAxiosError(error)
                ? error.response?.data?.message || 'Unable to change departure. Refresh the booking and try again.'
                : 'Unable to change departure. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    const reload = () => router.reload();

    const submitStatus = async () => {
        setProcessing(true);
        try {
            await axios.post(`/admin/tour-bookings/${booking.id}/update-status`, {
                status,
                cancellation_reason: cancellationReason || null,
            });
            reload();
        } finally {
            setProcessing(false);
        }
    };

    const confirmPayment = async () => {
        setProcessing(true);
        try {
            await axios.post(`/admin/tour-bookings/${booking.id}/confirm-payment`, {
                payment_method: paymentMethod,
                payment_reference: paymentReference || null,
                note: paymentNote || null,
            });
            reload();
        } finally {
            setProcessing(false);
        }
    };

    const createIncident = async () => {
        if (!incidentTitle) return;
        setProcessing(true);
        try {
            await axios.post(`/admin/tour-bookings/${booking.id}/incidents`, {
                title: incidentTitle,
                type: incidentType,
                severity: incidentSeverity,
                description: incidentDescription || null,
            });
            setIncidentTitle('');
            setIncidentDescription('');
            reload();
        } finally {
            setProcessing(false);
        }
    };

    const processRefund = async (refundId: number) => {
        setProcessing(true);
        try {
            await axios.post(`/admin/booking-refunds/${refundId}/process`);
            reload();
        } finally {
            setProcessing(false);
        }
    };

    return (
        <AdminLayout title={title}>
            <Head title={`Tour Booking ${booking.booking_number}`} />

            <Stack gap="lg">
                <Group justify="space-between">
                    <Button component={Link} href="/admin/tour-bookings" variant="subtle" color="gray" leftSection={<ArrowLeft size={16} />}>
                        Back to Tour Bookings
                    </Button>
                    <Group>
                        <Badge size="lg" color={booking.status === 'cancelled' ? 'red' : booking.status === 'completed' ? 'green' : 'blue'}>
                            {booking.status}
                        </Badge>
                        <Badge size="lg" variant="outline" color={booking.payment_status === 'paid' ? 'green' : 'orange'}>
                            {booking.payment_status}
                        </Badge>
                    </Group>
                </Group>

                <Grid gutter="lg">
                    <Grid.Col span={{ base: 12, lg: 8 }}>
                        <Stack gap="lg">
                            <Paper p="xl" radius="md" withBorder>
                                <Group justify="space-between" mb="lg">
                                    <div>
                                        <Text size="xs" color="dimmed" fw={700} tt="uppercase">Booking Number</Text>
                                        <Text size="h3" fw={800}>{booking.booking_number}</Text>
                                    </div>
                                    <Text size="xl" fw={800}>₹{booking.total_price}</Text>
                                </Group>
                                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                                    <Info label="Tour" value={booking.tour?.title || booking.schedule?.tour?.title || 'N/A'} />
                                    <Info label="Travel Date" value={new Date(booking.travel_date).toLocaleDateString()} />
                                    <Info label="Passengers" value={`${booking.number_of_adults} adults, ${booking.number_of_children} children`} />
                                </SimpleGrid>
                                <Divider my="lg" />
                                <Group gap="xl">
                                    <User size={18} />
                                    <div>
                                        <Text fw={700}>{booking.customer_name}</Text>
                                        <Text size="sm" color="dimmed">{booking.customer_phone} · {booking.customer_email}</Text>
                                    </div>
                                </Group>
                                {booking.special_requests && (
                                    <Alert mt="lg" color="indigo" icon={<AlertCircle size={16} />} title="Special Requests">
                                        {booking.special_requests}
                                    </Alert>
                                )}
                            </Paper>

                            <Paper p="xl" radius="md" withBorder>
                                <Text fw={800} mb="md">Lifecycle</Text>
                                <Timeline active={booking.status === 'completed' ? 3 : booking.status === 'cancelled' ? 4 : 1}>
                                    {['pending', 'confirmed', 'in_progress', 'completed'].map((item) => (
                                        <Timeline.Item key={item} bullet={<CheckCircle2 size={14} />} title={item.replace('_', ' ')}>
                                            <Text size="xs" color="dimmed">{item === booking.status ? 'Current status' : 'Allowed lifecycle step'}</Text>
                                        </Timeline.Item>
                                    ))}
                                    {booking.status === 'cancelled' && (
                                        <Timeline.Item color="red" bullet={<AlertCircle size={14} />} title="cancelled">
                                            <Text size="xs" color="dimmed">{booking.cancellation_reason || 'No cancellation reason recorded'}</Text>
                                        </Timeline.Item>
                                    )}
                                </Timeline>
                            </Paper>

                            <Paper p="xl" radius="md" withBorder>
                                <Text fw={800} mb="md">Tracking</Text>
                                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                                    <Info label="Current Coordinates" value={booking.current_lat && booking.current_lng ? `${booking.current_lat}, ${booking.current_lng}` : 'No live location'} />
                                    <Info label="Current Stop" value={booking.current_stop_index?.toString() ?? 'N/A'} />
                                    <Info label="Last Update" value={booking.last_location_update ? new Date(booking.last_location_update).toLocaleString() : 'Never'} />
                                </SimpleGrid>
                            </Paper>

                            <OperationalTables booking={booking} onProcessRefund={processRefund} processing={processing} />
                        </Stack>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, lg: 4 }}>
                        <Stack gap="lg">
                            <Paper p="xl" radius="md" withBorder>
                                <Text fw={800} mb="md">Status & Payment</Text>
                                <Stack gap="sm">
                                    <Select label="Lifecycle status" data={statusOptions} value={status} onChange={(value) => setStatus(value || booking.status)} />
                                    <Text size="sm">Payment: {booking.payment_status}. Use receipt confirmation or the refund workflow to change it.</Text>
                                    {status === 'cancelled' && (
                                        <Textarea label="Cancellation reason" value={cancellationReason} onChange={(event) => setCancellationReason(event.currentTarget.value)} />
                                    )}
                                    <Button leftSection={<RefreshCcw size={16} />} loading={processing} onClick={submitStatus}>Update Booking</Button>
                                </Stack>
                            </Paper>

                            {['pending', 'confirmed'].includes(booking.status) && (
                                <Paper p="xl" radius="md" withBorder>
                                    <Text fw={800} mb="md">Change departure</Text>
                                    <Stack gap="sm">
                                        <Text size="sm">Move this booking to another departure of the same tour. The agreed price, payment balance and existing hold deadline stay unchanged.</Text>
                                        {amendmentSchedules.length === 0 && <Text size="sm">No alternative departures currently have enough seats.</Text>}
                                        <Select label="New departure" required searchable disabled={processing}
                                            data={amendmentSchedules.map((schedule) => ({ value: String(schedule.id), label: `${schedule.departure_date.slice(0, 10)} ${schedule.departure_time || ''} — ${schedule.departure_point || 'Departure'} (#${schedule.id})` }))}
                                            value={targetSchedule} onChange={setTargetSchedule} />
                                        <Textarea label="Reason and customer agreement reference" required maxLength={2000} disabled={processing}
                                            value={amendmentReason} onChange={(event) => setAmendmentReason(event.currentTarget.value)} />
                                        <Checkbox label="The customer agreed to this departure change" disabled={processing}
                                            checked={customerAgreed} onChange={(event) => setCustomerAgreed(event.currentTarget.checked)} />
                                        {amendmentError && <Alert color="red" role="alert">{amendmentError}</Alert>}
                                        <Button variant="light" loading={processing} disabled={!targetSchedule || !customerAgreed || !amendmentReason.trim()} onClick={amendDeparture}>Confirm departure change</Button>
                                    </Stack>
                                </Paper>
                            )}

                            <Paper p="xl" radius="md" withBorder>
                                <Text fw={800} mb="md">Record collected payment</Text>
                                <Stack gap="sm">
                                    <Select label="Method" data={paymentMethodOptions} value={paymentMethod} onChange={(value) => setPaymentMethod(value || 'cash')} />
                                    <TextInput label="Receipt reference" required={paymentMethod !== 'cash'} value={paymentReference} onChange={(event) => setPaymentReference(event.currentTarget.value)} />
                                    <Textarea label="Note" value={paymentNote} onChange={(event) => setPaymentNote(event.currentTarget.value)} />
                                    <Button leftSection={<CreditCard size={16} />} loading={processing} onClick={confirmPayment}>Mark Paid</Button>
                                </Stack>
                            </Paper>

                            <Paper p="xl" radius="md" withBorder>
                                <Text fw={800} mb="md">Record Incident</Text>
                                <Stack gap="sm">
                                    <TextInput label="Title" value={incidentTitle} onChange={(event) => setIncidentTitle(event.currentTarget.value)} />
                                    <Select label="Type" data={['no_show', 'dispute', 'safety', 'payment', 'service_quality', 'other']} value={incidentType} onChange={(value) => setIncidentType(value || 'other')} />
                                    <Select label="Severity" data={['low', 'medium', 'high', 'critical']} value={incidentSeverity} onChange={(value) => setIncidentSeverity(value || 'medium')} />
                                    <Textarea label="Description" value={incidentDescription} onChange={(event) => setIncidentDescription(event.currentTarget.value)} />
                                    <Button leftSection={<AlertCircle size={16} />} loading={processing} onClick={createIncident}>Add Incident</Button>
                                </Stack>
                            </Paper>
                        </Stack>
                    </Grid.Col>
                </Grid>
            </Stack>
        </AdminLayout>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <Card withBorder radius="md" padding="md">
            <Text size="xs" color="dimmed" fw={700} tt="uppercase">{label}</Text>
            <Text fw={700}>{value}</Text>
        </Card>
    );
}

function OperationalTables({
    booking,
    onProcessRefund,
    processing,
}: {
    booking: TourBooking;
    onProcessRefund: (refundId: number) => void;
    processing: boolean;
}) {
    return (
        <Stack gap="lg">
            <Paper p="xl" radius="md" withBorder>
                <Group gap="sm" mb="md"><IndianRupee size={18} /><Text fw={800}>Refunds & Cancellation</Text></Group>
                <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
                    <Info label="Cancellation Fee" value={`₹${booking.cancellation_fee || '0.00'}`} />
                    <Info label="Refund Amount" value={`₹${booking.refund_amount || '0.00'}`} />
                    <Info label="Refunded At" value={booking.refunded_at ? new Date(booking.refunded_at).toLocaleString() : 'Not refunded'} />
                </SimpleGrid>
                <Table.ScrollContainer minWidth={700}>
                    <Table>
                        <Table.Thead><Table.Tr><Table.Th>Amount</Table.Th><Table.Th>Status</Table.Th><Table.Th>Reason</Table.Th><Table.Th /></Table.Tr></Table.Thead>
                        <Table.Tbody>
                            {booking.refunds.length === 0 ? (
                                <Table.Tr><Table.Td colSpan={4}><Text ta="center" color="dimmed">No refund records.</Text></Table.Td></Table.Tr>
                            ) : booking.refunds.map((refund) => (
                                <Table.Tr key={refund.id}>
                                    <Table.Td>₹{refund.amount}</Table.Td>
                                    <Table.Td><Badge color={refund.status === 'processed' ? 'green' : 'orange'}>{refund.status}</Badge></Table.Td>
                                    <Table.Td>{refund.reason || 'N/A'}</Table.Td>
                                    <Table.Td>
                                        {refund.status === 'pending' && <Button size="xs" loading={processing} onClick={() => onProcessRefund(refund.id)}>Process</Button>}
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </Table.ScrollContainer>
            </Paper>

            <Paper p="xl" radius="md" withBorder>
                <Text fw={800} mb="md">Incidents</Text>
                {booking.incidents.length === 0 ? <Text color="dimmed">No incidents recorded.</Text> : booking.incidents.map((incident) => (
                    <Card key={incident.id} withBorder radius="md" mb="sm">
                        <Group justify="space-between"><Text fw={700}>{incident.title}</Text><Badge>{incident.status}</Badge></Group>
                        <Text size="sm" color="dimmed">{incident.type} · {incident.severity}</Text>
                        <Text size="sm" mt="xs">{incident.description || 'No description'}</Text>
                    </Card>
                ))}
            </Paper>

            <Paper p="xl" radius="md" withBorder>
                <Group gap="sm" mb="md"><Star size={18} /><Text fw={800}>Reviews</Text></Group>
                {booking.reviews.length === 0 ? <Text color="dimmed">No review submitted.</Text> : booking.reviews.map((review) => (
                    <Card key={review.id} withBorder radius="md" mb="sm">
                        <Text fw={700}>{review.customer?.name || 'Customer'} · Tour {review.tour_rating}/5</Text>
                        <Text size="sm" color="dimmed">Driver rating: {review.driver_rating || 'N/A'}</Text>
                        <Text size="sm" mt="xs">{review.review || 'No written review'}</Text>
                    </Card>
                ))}
            </Paper>

            <Paper p="xl" radius="md" withBorder>
                <Text fw={800} mb="md">Audit History</Text>
                {booking.audit_logs.length === 0 ? <Text color="dimmed">No audit entries.</Text> : booking.audit_logs.map((log) => (
                    <Group key={log.id} justify="space-between" py="xs">
                        <div>
                            <Text fw={700}>{log.action}</Text>
                            <Text size="xs" color="dimmed">{log.note || 'No note'}</Text>
                        </div>
                        <Text size="xs" color="dimmed">{new Date(log.created_at).toLocaleString()}</Text>
                    </Group>
                ))}
            </Paper>
        </Stack>
    );
}
