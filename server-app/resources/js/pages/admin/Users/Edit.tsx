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
} from '@mantine/core';
import { ArrowLeft, Save } from 'lucide-react';
import { AdminUser } from '@/types';

interface EditUserProps {
    title: string;
    target_user: AdminUser;
    roles: Array<{
        id: number;
        name: string;
    }>;
}

export default function EditUser({ title, target_user, roles }: EditUserProps) {
    const currentRole = target_user.roles && target_user.roles[0] ? target_user.roles[0].name : '';

    const { data, setData, put, processing, errors } = useForm({
        name: target_user.name || '',
        email: target_user.email || '',
        phone: target_user.phone || '',
        role: currentRole,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(`/admin/users/${target_user.id}`);
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
            <Head title="Edit Staff Member" />

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
                            Edit Staff Member
                        </Text>
                        <Button
                            component={Link}
                            href="/admin/users"
                            variant="subtle"
                            leftSection={<ArrowLeft size={16} />}
                            style={{
                                color: 'rgba(255,255,255,0.6)',
                            }}
                        >
                            Back to List
                        </Button>
                    </Group>

                    <form onSubmit={handleSubmit}>
                        <Stack gap="md">
                            <TextInput
                                label="Full Name"
                                placeholder="John Doe"
                                required
                                value={data.name}
                                onChange={(e) => setData('name', e.currentTarget.value)}
                                error={errors.name}
                                radius="md"
                                styles={inputStyles}
                            />

                            <TextInput
                                label="Email Address"
                                placeholder="john@example.com"
                                type="email"
                                required
                                value={data.email}
                                onChange={(e) => setData('email', e.currentTarget.value)}
                                error={errors.email}
                                radius="md"
                                styles={inputStyles}
                            />

                            <TextInput
                                label="Phone Number"
                                placeholder="+91 XXXXX XXXXX"
                                required
                                value={data.phone}
                                onChange={(e) => setData('phone', e.currentTarget.value)}
                                error={errors.phone}
                                radius="md"
                                styles={inputStyles}
                            />

                            <Select
                                label="Role"
                                placeholder="Select staff role"
                                required
                                data={roles.map((r) => ({ value: r.name, label: r.name.charAt(0).toUpperCase() + r.name.slice(1) }))}
                                value={data.role}
                                onChange={(value) => setData('role', value || '')}
                                error={errors.role}
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