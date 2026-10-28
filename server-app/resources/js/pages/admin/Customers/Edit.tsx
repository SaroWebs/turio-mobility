import React from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import {
    Paper,
    Stack,
    TextInput,
    Select,
    Button,
    Group,
    Text,
    SimpleGrid,
} from '@mantine/core';
import { ArrowLeft, Save } from 'lucide-react';

interface Customer {
    id: number;
    name: string;
    email: string | null;
    phone: string;
    status: 'active' | 'suspended';
    date_of_birth?: string | null;
    gender?: 'male' | 'female' | 'other' | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
}

interface EditCustomerProps {
    title: string;
    customer: Customer;
}

export default function EditCustomer({ title, customer }: EditCustomerProps) {
    const { data, setData, put, processing, errors } = useForm({
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone,
        status: customer.status,
        date_of_birth: customer.date_of_birth ? customer.date_of_birth.substring(0, 10) : '',
        gender: customer.gender || '',
        emergency_contact_name: customer.emergency_contact_name || '',
        emergency_contact_phone: customer.emergency_contact_phone || '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(`/admin/customers/${customer.id}`);
    };

    const inputStyles = {
        input: {
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.85)',
        },
        label: {
            color: 'rgba(255,255,255,0.6)',
            marginBottom: 6,
        }
    };

    return (
        <AdminLayout title={title}>
            <Head title={`Edit Customer: ${customer.name}`} />

            <Stack gap="xl" align="center" style={{ width: '100%' }}>
                <Paper
                    p="xl"
                    radius="md"
                    style={{
                        background: '#11111199',
                        border: '1px solid rgba(255,255,255,0.06)',
                        backdropFilter: 'blur(12px)',
                        maxWidth: 600,
                        width: '100%',
                    }}
                >
                    <Group justify="space-between" mb="xl">
                        <Text size="lg" fw={700} style={{ color: 'rgba(255,255,255,0.9)' }}>
                            Edit Customer Details
                        </Text>
                        <Button
                            component={Link}
                            href={`/admin/customers/${customer.id}`}
                            variant="subtle"
                            leftSection={<ArrowLeft size={16} />}
                            style={{
                                color: 'rgba(255,255,255,0.6)',
                            }}
                        >
                            Back to Details
                        </Button>
                    </Group>

                    <form onSubmit={handleSubmit}>
                        <Stack gap="md">
                            <TextInput
                                label="Full Name"
                                placeholder="Enter customer's name"
                                required
                                value={data.name}
                                onChange={(e) => setData('name', e.currentTarget.value)}
                                error={errors.name}
                                radius="md"
                                styles={inputStyles}
                            />

                            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                                <TextInput
                                    label="Email Address"
                                    placeholder="customer@example.com"
                                    type="email"
                                    value={data.email || ''}
                                    onChange={(e) => setData('email', e.currentTarget.value)}
                                    error={errors.email}
                                    radius="md"
                                    styles={inputStyles}
                                />

                                <TextInput
                                    label="Phone Number"
                                    placeholder="Enter phone number"
                                    required
                                    value={data.phone}
                                    onChange={(e) => setData('phone', e.currentTarget.value)}
                                    error={errors.phone}
                                    radius="md"
                                    styles={inputStyles}
                                />
                            </SimpleGrid>

                            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                                <TextInput
                                    label="Date of Birth"
                                    type="date"
                                    value={data.date_of_birth}
                                    onChange={(e) => setData('date_of_birth', e.currentTarget.value)}
                                    error={errors.date_of_birth}
                                    radius="md"
                                    styles={inputStyles}
                                />

                                <Select
                                    label="Gender"
                                    placeholder="Select gender"
                                    data={[
                                        { value: 'male', label: 'Male' },
                                        { value: 'female', label: 'Female' },
                                        { value: 'other', label: 'Other' },
                                    ]}
                                    value={data.gender}
                                    onChange={(value) => setData('gender', value || '')}
                                    error={errors.gender}
                                    radius="md"
                                    styles={{
                                        ...inputStyles,
                                        dropdown: {
                                            background: '#111111',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                        },
                                        option: {
                                            color: 'rgba(255,255,255,0.85)',
                                        }
                                    }}
                                />
                            </SimpleGrid>

                            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                                <TextInput
                                    label="Emergency Contact Name"
                                    placeholder="Emergency contact name"
                                    value={data.emergency_contact_name}
                                    onChange={(e) => setData('emergency_contact_name', e.currentTarget.value)}
                                    error={errors.emergency_contact_name}
                                    radius="md"
                                    styles={inputStyles}
                                />

                                <TextInput
                                    label="Emergency Contact Phone"
                                    placeholder="Emergency contact phone number"
                                    value={data.emergency_contact_phone}
                                    onChange={(e) => setData('emergency_contact_phone', e.currentTarget.value)}
                                    error={errors.emergency_contact_phone}
                                    radius="md"
                                    styles={inputStyles}
                                />
                            </SimpleGrid>

                            <Select
                                label="Account Status"
                                placeholder="Select status"
                                required
                                data={[
                                    { value: 'active', label: 'Active' },
                                    { value: 'suspended', label: 'Suspended' },
                                ]}
                                value={data.status}
                                onChange={(value) => setData('status', (value as 'active' | 'suspended') || 'active')}
                                error={errors.status}
                                radius="md"
                                styles={{
                                    ...inputStyles,
                                    dropdown: {
                                        background: '#111111',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                    },
                                    option: {
                                        color: 'rgba(255,255,255,0.85)',
                                    }
                                }}
                            />

                            <Button
                                type="submit"
                                radius="md"
                                loading={processing}
                                leftSection={<Save size={16} />}
                                style={{
                                    background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                                    border: 'none',
                                    color: '#000',
                                    fontWeight: 600,
                                    marginTop: 10,
                                }}
                            >
                                Save Changes
                            </Button>
                        </Stack>
                    </form>
                </Paper>
            </Stack>
        </AdminLayout>
    );
}
