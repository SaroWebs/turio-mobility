import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import axios from 'axios';
import AdminLayout from '@/layouts/AdminLayout';
import {
    Alert,
    Badge,
    Button,
    Card,
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
import { AlertCircle, ArrowLeft, Car, CheckCircle2, CreditCard, IndianRupee, MapPin, RefreshCcw, Star, Truck, User } from 'lucide-react';

interface Person {
    id: number;
    name: string;
    phone?: string;
    email?: string;
}

interface Vehicle {
    id: number;
    driver_id?: number | null;
    car_category_id?: number | null;
    registration_number: string;
    make?: string | null;
    model?: string | null;
}

interface DriverOption extends Person {
    rating?: number | null;
    vehicle_number?: string | null;
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
    rental_rating: number;
    driver_rating?: number | null;
    review?: string | null;
    customer?: Person | null;
    driver?: Person | null;
}

interface CarRental {
    id: number;
    booking_number: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    customer_address?: string | null;
    start_date: string;
    end_date: string;
    start_time?: string | null;
    end_time?: string | null;
    number_of_days: number;
    pickup_location: string;
    dropoff_location?: string | null;
    destination_details?: string | null;
    distance_km: string | number;
    total_price: string;
    base_price: string;
    distance_price: string;
    extras_price: string;
    discount_amount: string;
    commission_amount?: string | null;
    driver_share?: string | null;
    status: string;
    payment_status: string;
    payment_method: string;
    driver_id?: number | null;
    vehicle_id?: number | null;
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
    car_category?: {
        id: number;
        name: string;
        vehicle_type: string;
        seats: number;
    } | null;
    carCategory?: {
        id: number;
        name: string;
        vehicle_type: string;
        seats: number;
    } | null;
    driver?: Person | null;
    vehicle?: Vehicle | null;
    refunds: BookingRefund[];
    incidents: BookingIncident[];
    audit_logs: BookingAuditLog[];
    reviews: BookingReview[];
}

interface Props {
    title: string;
    car_rental: CarRental;
    drivers: DriverOption[];
    vehicles: Vehicle[];
}

const rentalStatusOptions = ['pending', 'confirmed', 'driver_assigned', 'in_progress', 'completed', 'cancelled'].map((value) => ({ value, label: value.replace('_', ' ') }));
const paymentStatusOptions = ['pending', 'paid', 'failed', 'refunded'].map((value) => ({ value, label: value }));
const paymentMethodOptions = ['cash', 'card', 'upi', 'bank_transfer'].map((value) => ({ value, label: value.replace('_', ' ') }));

export default function Show({ title, car_rental, drivers, vehicles }: Props) {
    const category = car_rental.car_category || car_rental.carCategory;
    const [status, setStatus] = useState(car_rental.status);
    const [paymentStatus, setPaymentStatus] = useState(car_rental.payment_status);
    const [cancellationReason, setCancellationReason] = useState('');
    const [paymentMethod, setPaymentMethod] = useState(car_rental.payment_method || 'cash');
    const [paymentReference, setPaymentReference] = useState('');
    const [paymentNote, setPaymentNote] = useState('');
    const [driverId, setDriverId] = useState(car_rental.driver_id ? String(car_rental.driver_id) : '');
    const [vehicleId, setVehicleId] = useState(car_rental.vehicle_id ? String(car_rental.vehicle_id) : '');
    const [incidentTitle, setIncidentTitle] = useState('');
    const [incidentType, setIncidentType] = useState('no_show');
    const [incidentSeverity, setIncidentSeverity] = useState('medium');
    const [incidentDescription, setIncidentDescription] = useState('');
    const [processing, setProcessing] = useState(false);

    const reload = () => router.reload();

    const submitStatus = async () => {
        setProcessing(true);
        try {
            await axios.post(`/admin/car-rentals/${car_rental.id}/update-status`, {
                status,
                payment_status: paymentStatus,
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
            await axios.post(`/admin/car-rentals/${car_rental.id}/confirm-payment`, {
                payment_method: paymentMethod,
                payment_reference: paymentReference || null,
                note: paymentNote || null,
            });
            reload();
        } finally {
            setProcessing(false);
        }
    };

    const assignDriver = async () => {
        if (!driverId) return;
        setProcessing(true);
        try {
            await axios.post(`/admin/car-rentals/${car_rental.id}/assign-driver`, {
                driver_id: Number(driverId),
                vehicle_id: vehicleId ? Number(vehicleId) : null,
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
            await axios.post(`/admin/car-rentals/${car_rental.id}/incidents`, {
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
            <Head title={`Car Rental ${car_rental.booking_number}`} />

            <Stack gap="lg">
                <Group justify="space-between">
                    <Button component={Link} href="/admin/car-rentals" variant="subtle" color="gray" leftSection={<ArrowLeft size={16} />}>
                        Back to Car Rentals
                    </Button>
                    <Group>
                        <Badge size="lg" color={car_rental.status === 'cancelled' ? 'red' : car_rental.status === 'completed' ? 'green' : 'blue'}>
                            {car_rental.status.replace('_', ' ')}
                        </Badge>
                        <Badge size="lg" variant="outline" color={car_rental.payment_status === 'paid' ? 'green' : 'orange'}>
                            {car_rental.payment_status}
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
                                        <Text size="h3" fw={800}>{car_rental.booking_number}</Text>
                                    </div>
                                    <Text size="xl" fw={800}>₹{car_rental.total_price}</Text>
                                </Group>
                                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                                    <Info label="Category" value={category?.name || 'N/A'} />
                                    <Info label="Duration" value={`${car_rental.number_of_days} day(s)`} />
                                    <Info label="Distance" value={`${car_rental.distance_km || 0} km`} />
                                </SimpleGrid>
                                <Divider my="lg" />
                                <Timeline active={1}>
                                    <Timeline.Item bullet={<MapPin size={14} />} title="Pickup">
                                        <Text size="sm">{car_rental.pickup_location}</Text>
                                    </Timeline.Item>
                                    <Timeline.Item bullet={<Car size={14} />} title="Dropoff">
                                        <Text size="sm">{car_rental.dropoff_location || 'Return / not specified'}</Text>
                                    </Timeline.Item>
                                </Timeline>
                            </Paper>

                            <Paper p="xl" radius="md" withBorder>
                                <Text fw={800} mb="md">Customer</Text>
                                <Group gap="xl">
                                    <User size={22} />
                                    <div>
                                        <Text fw={700}>{car_rental.customer_name}</Text>
                                        <Text size="sm" color="dimmed">{car_rental.customer_phone} · {car_rental.customer_email}</Text>
                                        {car_rental.customer_address && <Text size="sm" color="dimmed">{car_rental.customer_address}</Text>}
                                    </div>
                                </Group>
                                {car_rental.special_requests && (
                                    <Alert mt="lg" color="indigo" icon={<AlertCircle size={16} />} title="Special Requests">
                                        {car_rental.special_requests}
                                    </Alert>
                                )}
                            </Paper>

                            <Paper p="xl" radius="md" withBorder>
                                <Text fw={800} mb="md">Lifecycle</Text>
                                <Timeline active={car_rental.status === 'completed' ? 4 : car_rental.status === 'cancelled' ? 5 : 2}>
                                    {['pending', 'confirmed', 'driver_assigned', 'in_progress', 'completed'].map((item) => (
                                        <Timeline.Item key={item} bullet={<CheckCircle2 size={14} />} title={item.replace('_', ' ')}>
                                            <Text size="xs" color="dimmed">{item === car_rental.status ? 'Current status' : 'Allowed lifecycle step'}</Text>
                                        </Timeline.Item>
                                    ))}
                                    {car_rental.status === 'cancelled' && (
                                        <Timeline.Item color="red" bullet={<AlertCircle size={14} />} title="cancelled">
                                            <Text size="xs" color="dimmed">{car_rental.cancellation_reason || 'No cancellation reason recorded'}</Text>
                                        </Timeline.Item>
                                    )}
                                </Timeline>
                            </Paper>

                            <Paper p="xl" radius="md" withBorder>
                                <Text fw={800} mb="md">Tracking</Text>
                                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                                    <Info label="Current Coordinates" value={car_rental.current_lat && car_rental.current_lng ? `${car_rental.current_lat}, ${car_rental.current_lng}` : 'No live location'} />
                                    <Info label="Pickup Date" value={new Date(car_rental.start_date).toLocaleDateString()} />
                                    <Info label="Last Update" value={car_rental.last_location_update ? new Date(car_rental.last_location_update).toLocaleString() : 'Never'} />
                                </SimpleGrid>
                            </Paper>

                            <OperationalTables rental={car_rental} onProcessRefund={processRefund} processing={processing} />
                        </Stack>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, lg: 4 }}>
                        <Stack gap="lg">
                            <Paper p="xl" radius="md" withBorder>
                                <Text fw={800} mb="md">Driver & Vehicle</Text>
                                {car_rental.driver && (
                                    <Alert mb="md" color="green" title="Assigned Driver">
                                        {car_rental.driver.name}{car_rental.vehicle ? ` · ${car_rental.vehicle.registration_number}` : ''}
                                    </Alert>
                                )}
                                <Stack gap="sm">
                                    <Select
                                        label="Driver"
                                        data={drivers.map((driver) => ({ value: String(driver.id), label: `${driver.name}${driver.vehicle_number ? ` · ${driver.vehicle_number}` : ''}` }))}
                                        value={driverId}
                                        onChange={(value) => setDriverId(value || '')}
                                        searchable
                                    />
                                    <Select
                                        label="Vehicle"
                                        data={vehicles.map((vehicle) => ({ value: String(vehicle.id), label: `${vehicle.registration_number} · ${vehicle.make || ''} ${vehicle.model || ''}` }))}
                                        value={vehicleId}
                                        onChange={(value) => setVehicleId(value || '')}
                                        searchable
                                        clearable
                                    />
                                    <Button leftSection={<Truck size={16} />} loading={processing} onClick={assignDriver}>Assign Driver</Button>
                                </Stack>
                            </Paper>

                            <Paper p="xl" radius="md" withBorder>
                                <Text fw={800} mb="md">Status & Payment</Text>
                                <Stack gap="sm">
                                    <Select label="Lifecycle status" data={rentalStatusOptions} value={status} onChange={(value) => setStatus(value || car_rental.status)} />
                                    <Select label="Payment status" data={paymentStatusOptions} value={paymentStatus} onChange={(value) => setPaymentStatus(value || car_rental.payment_status)} />
                                    {status === 'cancelled' && (
                                        <Textarea label="Cancellation reason" value={cancellationReason} onChange={(event) => setCancellationReason(event.currentTarget.value)} />
                                    )}
                                    <Button leftSection={<RefreshCcw size={16} />} loading={processing} onClick={submitStatus}>Update Rental</Button>
                                </Stack>
                            </Paper>

                            <Paper p="xl" radius="md" withBorder>
                                <Text fw={800} mb="md">Confirm Payment</Text>
                                <Stack gap="sm">
                                    <Select label="Method" data={paymentMethodOptions} value={paymentMethod} onChange={(value) => setPaymentMethod(value || 'cash')} />
                                    <TextInput label="Reference" value={paymentReference} onChange={(event) => setPaymentReference(event.currentTarget.value)} />
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
    rental,
    onProcessRefund,
    processing,
}: {
    rental: CarRental;
    onProcessRefund: (refundId: number) => void;
    processing: boolean;
}) {
    return (
        <Stack gap="lg">
            <Paper p="xl" radius="md" withBorder>
                <Group gap="sm" mb="md"><IndianRupee size={18} /><Text fw={800}>Payment, Refunds & Cancellation</Text></Group>
                <SimpleGrid cols={{ base: 1, sm: 4 }} mb="md">
                    <Info label="Base" value={`₹${rental.base_price}`} />
                    <Info label="Distance" value={`₹${rental.distance_price}`} />
                    <Info label="Cancellation Fee" value={`₹${rental.cancellation_fee || '0.00'}`} />
                    <Info label="Refund Amount" value={`₹${rental.refund_amount || '0.00'}`} />
                </SimpleGrid>
                <Table.ScrollContainer minWidth={700}>
                    <Table>
                        <Table.Thead><Table.Tr><Table.Th>Amount</Table.Th><Table.Th>Status</Table.Th><Table.Th>Reason</Table.Th><Table.Th /></Table.Tr></Table.Thead>
                        <Table.Tbody>
                            {rental.refunds.length === 0 ? (
                                <Table.Tr><Table.Td colSpan={4}><Text ta="center" color="dimmed">No refund records.</Text></Table.Td></Table.Tr>
                            ) : rental.refunds.map((refund) => (
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
                {rental.incidents.length === 0 ? <Text color="dimmed">No incidents recorded.</Text> : rental.incidents.map((incident) => (
                    <Card key={incident.id} withBorder radius="md" mb="sm">
                        <Group justify="space-between"><Text fw={700}>{incident.title}</Text><Badge>{incident.status}</Badge></Group>
                        <Text size="sm" color="dimmed">{incident.type} · {incident.severity}</Text>
                        <Text size="sm" mt="xs">{incident.description || 'No description'}</Text>
                    </Card>
                ))}
            </Paper>

            <Paper p="xl" radius="md" withBorder>
                <Group gap="sm" mb="md"><Star size={18} /><Text fw={800}>Reviews</Text></Group>
                {rental.reviews.length === 0 ? <Text color="dimmed">No review submitted.</Text> : rental.reviews.map((review) => (
                    <Card key={review.id} withBorder radius="md" mb="sm">
                        <Text fw={700}>{review.customer?.name || 'Customer'} · Rental {review.rental_rating}/5</Text>
                        <Text size="sm" color="dimmed">Driver rating: {review.driver_rating || 'N/A'}</Text>
                        <Text size="sm" mt="xs">{review.review || 'No written review'}</Text>
                    </Card>
                ))}
            </Paper>

            <Paper p="xl" radius="md" withBorder>
                <Text fw={800} mb="md">Audit History</Text>
                {rental.audit_logs.length === 0 ? <Text color="dimmed">No audit entries.</Text> : rental.audit_logs.map((log) => (
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
