import React from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import {
    Paper, Stack, Group, Text, TextInput, Button, Avatar,
    Divider, SimpleGrid, Badge,
} from '@mantine/core';
import { UserCircle, Mail, Phone, Save, Shield } from 'lucide-react';

interface ProfileProps {
    title: string;
    target_user: {
        id: number;
        name: string;
        email: string;
        phone: string;
        created_at: string;
        roles: Array<{ id: number; name: string; display_name: string }>;
    };
}

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
    admin:       { bg: 'rgba(239,68,68,0.15)',   text: '#ef4444' },
    super_admin: { bg: 'rgba(239,68,68,0.15)',   text: '#ef4444' },
    guide:       { bg: 'rgba(59,130,246,0.15)',  text: '#3b82f6' },
    driver:      { bg: 'rgba(20,184,166,0.15)',  text: '#14b8a6' },
    customer:    { bg: 'rgba(168,85,247,0.15)',  text: '#a855f7' },
};
const roleColor = (name: string) =>
    ROLE_COLORS[name.toLowerCase()] ?? { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.5)' };

const inputStyles = {
    input: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' },
    label: { color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
};

export default function AdminProfile({ title, target_user }: ProfileProps) {
    const { props } = usePage();
    const flash = (props as any)?.flash as { success?: string; error?: string } | undefined;

    const { data, setData, put, processing, errors } = useForm({
        name:  target_user.name,
        email: target_user.email,
        phone: target_user.phone,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put('/admin/profile');
    };

    return (
        <AdminLayout title={title}>
            <Head title="My Profile" />
            <Stack gap="xl" align="center" style={{ width: '100%' }}>
                <Paper p="xl" radius="md" style={{ background: '#11111199', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)', maxWidth: 680, width: '100%' }}>

                    {/* Flash message */}
                    {flash?.success && (
                        <div style={{
                            marginBottom: 20,
                            padding: '12px 16px',
                            borderRadius: 10,
                            background: 'rgba(16,185,129,0.1)',
                            border: '1px solid rgba(16,185,129,0.25)',
                            color: '#10b981',
                            fontSize: 14,
                        }}>
                            ✓ {flash.success}
                        </div>
                    )}

                    {/* Profile header */}
                    <Group gap="xl" mb="xl">
                        <div style={{
                            width: 80, height: 80, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                            boxShadow: '0 0 24px rgba(251,191,36,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: 28, color: '#000',
                            fontFamily: 'Orbitron, sans-serif',
                            flexShrink: 0,
                        }}>
                            {target_user.name.charAt(0).toUpperCase()}
                        </div>
                        <Stack gap={4}>
                            <Text size="xl" fw={700} style={{ color: 'rgba(255,255,255,0.95)' }}>
                                {target_user.name}
                            </Text>
                            <Text size="sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                {target_user.email}
                            </Text>
                            <Group gap={6} mt={4}>
                                {target_user.roles.map((role) => {
                                    const color = roleColor(role.name);
                                    return (
                                        <Badge
                                            key={role.id}
                                            size="sm"
                                            leftSection={<Shield size={10} />}
                                            style={{ background: color.bg, color: color.text, border: `1px solid ${color.text}40` }}
                                        >
                                            {role.display_name}
                                        </Badge>
                                    );
                                })}
                            </Group>
                        </Stack>
                    </Group>

                    <Divider label={<Text size="xs" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>PROFILE INFORMATION</Text>} labelPosition="left" style={{ borderColor: 'rgba(255,255,255,0.07)' }} mb="xl" />

                    <form onSubmit={handleSubmit}>
                        <Stack gap="md">
                            <TextInput
                                label="Full Name"
                                placeholder="Your full name"
                                required
                                value={data.name}
                                onChange={(e) => setData('name', e.currentTarget.value)}
                                error={errors.name}
                                radius="md"
                                styles={inputStyles}
                                leftSection={<UserCircle size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />}
                            />
                            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                                <TextInput
                                    label="Email Address"
                                    placeholder="your@email.com"
                                    type="email"
                                    required
                                    value={data.email}
                                    onChange={(e) => setData('email', e.currentTarget.value)}
                                    error={errors.email}
                                    radius="md"
                                    styles={inputStyles}
                                    leftSection={<Mail size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />}
                                />
                                <TextInput
                                    label="Phone Number"
                                    placeholder="+91 00000 00000"
                                    required
                                    value={data.phone}
                                    onChange={(e) => setData('phone', e.currentTarget.value)}
                                    error={errors.phone}
                                    radius="md"
                                    styles={inputStyles}
                                    leftSection={<Phone size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />}
                                />
                            </SimpleGrid>

                            <Group justify="flex-end" mt="xs">
                                <Button
                                    type="submit"
                                    radius="md"
                                    loading={processing}
                                    leftSection={<Save size={16} />}
                                    style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)', border: 'none', color: '#000', fontWeight: 600 }}
                                >
                                    Save Changes
                                </Button>
                            </Group>
                        </Stack>
                    </form>

                    <Divider style={{ borderColor: 'rgba(255,255,255,0.07)', marginTop: 28, marginBottom: 20 }} />

                    {/* Account info (read-only) */}
                    <Stack gap="xs">
                        <Text size="xs" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            Account Info
                        </Text>
                        <Group justify="space-between">
                            <Text size="sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Member since</Text>
                            <Text size="sm" fw={500} style={{ color: 'rgba(255,255,255,0.7)' }}>
                                {new Date(target_user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </Text>
                        </Group>
                        <Group justify="space-between">
                            <Text size="sm" style={{ color: 'rgba(255,255,255,0.45)' }}>User ID</Text>
                            <Text size="sm" fw={500} style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>
                                #{target_user.id}
                            </Text>
                        </Group>
                        <Group justify="space-between">
                            <Text size="sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Password</Text>
                            <Text size="sm" fw={500} style={{ color: 'rgba(255,255,255,0.7)' }}>
                                Use "Change Password" from the top-right menu
                            </Text>
                        </Group>
                    </Stack>
                </Paper>
            </Stack>
        </AdminLayout>
    );
}
