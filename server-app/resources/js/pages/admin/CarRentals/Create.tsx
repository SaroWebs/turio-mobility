import React from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import {
    Paper,
    Text,
    Group,
    Stack,
    TextInput,
    Textarea,
    Select,
    Button,
    Grid,
    Box,
} from '@mantine/core';
import { Car, User, Settings, Navigation } from 'lucide-react';

interface CarCategory {
    id: number;
    name: string;
    vehicle_type: string;
    base_price_per_day: number;
    price_per_km: number;
    is_active: boolean;
}

interface Destination {
    id: number;
    name: string;
    is_active: boolean;
}

interface Driver {
    id: number;
    name: string;
    email: string;
}

interface CreateCarRentalProps {
    title: string;
    user: any;
    car_categories: CarCategory[];
    destinations: Destination[];
    drivers: Driver[];
}

export default function Create({ title, user, car_categories, destinations, drivers }: CreateCarRentalProps) {
    const { data, setData, post, processing, errors } = useForm({
        car_category_id: '',
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        customer_address: '',
        start_date: '',
        end_date: '',
        start_time: '09:00',
        end_time: '18:00',
        pickup_location: '',
        dropoff_location: '',
        destination_details: '',
        distance_km: '',
        special_requests: '',
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'cash',
        assigned_driver: '',
        vehicle_number: '',
        internal_notes: '',
        whatsapp_notification: true as boolean,
        email_notification: true as boolean,
        sms_notification: false as boolean,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/car-rentals');
    };

    const inputStyles = {
        input: {
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.85)',
        }
    };

    return (
        <AdminLayout title={title}>
            <Head title="Create Car Rental" />

            <Paper
                p="xl"
                radius="md"
                style={{
                    background: 'rgba(17,17,17,0.6)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(12px)',
                }}
            >
                <Group justify="space-between" mb="xl">
                    <Group gap={8}>
                        <Car size={18} color="#fbbf24" />
                        <Text size="lg" fw={700} style={{ color: 'rgba(255,255,255,0.9)', letterSpacing: '0.02em' }}>
                            Create New Car Rental
                        </Text>
                    </Group>
                    <Button
                        component={Link}
                        href="/admin/car-rentals"
                        variant="subtle"
                        style={{ color: 'rgba(255,255,255,0.4)' }}
                    >
                        Back to Car Rentals
                    </Button>
                </Group>

                <form onSubmit={handleSubmit}>
                    <Stack gap="xl">
                        {/* Customer Information */}
                        <Box>
                            <Group gap={8} mb="md">
                                <User size={16} color="rgba(255,255,255,0.4)" />
                                <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                    Customer Information
                                </Text>
                            </Group>
                            <Grid gutter="md">
                                <Grid.Col span={{ base: 12, md: 6 }}>
                                    <TextInput
                                        label="Customer Name *"
                                        placeholder="Enter customer name"
                                        value={data.customer_name}
                                        onChange={(e) => setData('customer_name', e.target.value)}
                                        error={errors.customer_name}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, md: 6 }}>
                                    <TextInput
                                        label="Customer Email *"
                                        placeholder="Enter customer email"
                                        type="email"
                                        value={data.customer_email}
                                        onChange={(e) => setData('customer_email', e.target.value)}
                                        error={errors.customer_email}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, md: 6 }}>
                                    <TextInput
                                        label="Customer Phone *"
                                        placeholder="Enter customer phone"
                                        value={data.customer_phone}
                                        onChange={(e) => setData('customer_phone', e.target.value)}
                                        error={errors.customer_phone}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, md: 6 }}>
                                    <TextInput
                                        label="Customer Address"
                                        placeholder="Enter customer address"
                                        value={data.customer_address}
                                        onChange={(e) => setData('customer_address', e.target.value)}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                            </Grid>
                        </Box>

                        {/* Car Details */}
                        <Box>
                            <Group gap={8} mb="md">
                                <Car size={16} color="rgba(255,255,255,0.4)" />
                                <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                    Car Details
                                </Text>
                            </Group>
                            <Grid gutter="md">
                                <Grid.Col span={{ base: 12, md: 4 }}>
                                    <Select
                                        label="Car Category *"
                                        placeholder="Select Car Category"
                                        data={car_categories.map((category) => ({
                                            value: category.id.toString(),
                                            label: `${category.name} - ${category.vehicle_type} (₹${category.base_price_per_day}/day)`,
                                        }))}
                                        value={data.car_category_id}
                                        onChange={(val) => setData('car_category_id', val || '')}
                                        error={errors.car_category_id}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, md: 4 }}>
                                    <Select
                                        label="Assigned Driver"
                                        placeholder="No Driver Assigned"
                                        data={drivers.map((driver) => ({
                                            value: driver.id.toString(),
                                            label: `${driver.name} (${driver.email})`,
                                        }))}
                                        value={data.assigned_driver}
                                        onChange={(val) => setData('assigned_driver', val || '')}
                                        clearable
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, md: 4 }}>
                                    <TextInput
                                        label="Vehicle Number"
                                        placeholder="e.g., AS-01-AB-1234"
                                        value={data.vehicle_number}
                                        onChange={(e) => setData('vehicle_number', e.target.value)}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                            </Grid>
                        </Box>

                        {/* Trip Information */}
                        <Box>
                            <Group gap={8} mb="md">
                                <Navigation size={16} color="rgba(255,255,255,0.4)" />
                                <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                    Trip Information
                                </Text>
                            </Group>
                            <Grid gutter="md">
                                <Grid.Col span={{ base: 12, md: 3 }}>
                                    <TextInput
                                        label="Start Date *"
                                        type="date"
                                        value={data.start_date}
                                        onChange={(e) => setData('start_date', e.target.value)}
                                        error={errors.start_date}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, md: 3 }}>
                                    <TextInput
                                        label="End Date *"
                                        type="date"
                                        value={data.end_date}
                                        onChange={(e) => setData('end_date', e.target.value)}
                                        error={errors.end_date}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, md: 3 }}>
                                    <TextInput
                                        label="Start Time"
                                        type="time"
                                        value={data.start_time}
                                        onChange={(e) => setData('start_time', e.target.value)}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, md: 3 }}>
                                    <TextInput
                                        label="End Time"
                                        type="time"
                                        value={data.end_time}
                                        onChange={(e) => setData('end_time', e.target.value)}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, md: 6 }}>
                                    <Textarea
                                        label="Pickup Location *"
                                        placeholder="Enter pickup location"
                                        rows={2}
                                        value={data.pickup_location}
                                        onChange={(e) => setData('pickup_location', e.target.value)}
                                        error={errors.pickup_location}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, md: 6 }}>
                                    <Textarea
                                        label="Dropoff Location"
                                        placeholder="Enter dropoff location"
                                        rows={2}
                                        value={data.dropoff_location}
                                        onChange={(e) => setData('dropoff_location', e.target.value)}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, md: 6 }}>
                                    <TextInput
                                        label="Distance (km)"
                                        type="number"
                                        step="0.1"
                                        placeholder="Enter distance"
                                        value={data.distance_km}
                                        onChange={(e) => setData('distance_km', e.target.value)}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, md: 6 }}>
                                    <Textarea
                                        label="Destination Details"
                                        placeholder="Additional destination information..."
                                        rows={2}
                                        value={data.destination_details}
                                        onChange={(e) => setData('destination_details', e.target.value)}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                            </Grid>
                        </Box>

                        {/* Status and Payment */}
                        <Box>
                            <Group gap={8} mb="md">
                                <Settings size={16} color="rgba(255,255,255,0.4)" />
                                <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                    Status & Payment
                                </Text>
                            </Group>
                            <Grid gutter="md">
                                <Grid.Col span={{ base: 12, md: 4 }}>
                                    <Select
                                        label="Status *"
                                        data={[
                                            { value: 'pending', label: 'Pending' },
                                            { value: 'confirmed', label: 'Confirmed' },
                                            { value: 'in_progress', label: 'In Progress' },
                                            { value: 'completed', label: 'Completed' },
                                            { value: 'cancelled', label: 'Cancelled' },
                                        ]}
                                        value={data.status}
                                        onChange={(val) => setData('status', val || '')}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, md: 4 }}>
                                    <Select
                                        label="Payment Status *"
                                        data={[
                                            { value: 'pending', label: 'Pending' },
                                            { value: 'paid', label: 'Paid' },
                                            { value: 'failed', label: 'Failed' },
                                            { value: 'refunded', label: 'Refunded' },
                                        ]}
                                        value={data.payment_status}
                                        onChange={(val) => setData('payment_status', val || '')}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, md: 4 }}>
                                    <Select
                                        label="Payment Method *"
                                        data={[
                                            { value: 'cash', label: 'Cash' },
                                            { value: 'card', label: 'Card' },
                                            { value: 'bank_transfer', label: 'Bank Transfer' },
                                            { value: 'upi', label: 'UPI' },
                                        ]}
                                        value={data.payment_method}
                                        onChange={(val) => setData('payment_method', val || '')}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                            </Grid>
                        </Box>

                        {/* Additional Information */}
                        <Box>
                            <Text size="sm" fw={600} mb="md" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                Additional Information
                            </Text>
                            <Grid gutter="md">
                                <Grid.Col span={{ base: 12, md: 6 }}>
                                    <Textarea
                                        label="Special Requests"
                                        placeholder="Any special requirements or requests..."
                                        rows={3}
                                        value={data.special_requests}
                                        onChange={(e) => setData('special_requests', e.target.value)}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, md: 6 }}>
                                    <Textarea
                                        label="Internal Notes"
                                        placeholder="Internal notes for staff only..."
                                        rows={3}
                                        value={data.internal_notes}
                                        onChange={(e) => setData('internal_notes', e.target.value)}
                                        styles={inputStyles}
                                    />
                                </Grid.Col>
                            </Grid>
                        </Box>

                        <Group justify="flex-end" mt="xl">
                            <Button
                                component={Link}
                                href="/admin/car-rentals"
                                variant="subtle"
                                style={{ color: 'rgba(255,255,255,0.4)' }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                loading={processing}
                                style={{
                                    background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                                    border: 'none',
                                    color: '#000',
                                    fontWeight: 600,
                                }}
                            >
                                Create Car Rental
                            </Button>
                        </Group>
                    </Stack>
                </form>
            </Paper>
        </AdminLayout>
    );
}