import React from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import {
    Paper,
    Stack,
    Button,
    Group,
    Text,
    Avatar,
    Badge,
    Divider,
    Grid,
} from '@mantine/core';
import { ArrowLeft, Pencil, Trash, Shield, Mail, Phone, User } from 'lucide-react';
import { AdminUser } from '@/types';

interface ShowUserProps {
    title: string;
    target_user: AdminUser;
}

const getRoleColor = (role: string) => {
    const r = role.toLowerCase();
    if (r === 'admin') return { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' };
    if (r === 'guide') return { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' };
    if (r === 'driver') return { bg: 'rgba(20,184,166,0.15)', text: '#14b8a6' };
    return { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.6)' };
};

export default function ShowUser({ title, target_user }: ShowUserProps) {
    const primaryRole = target_user.roles && target_user.roles[0] ? target_user.roles[0].name : 'user';
    const roleColor = getRoleColor(primaryRole);

    const handleDelete = () => {
        if (confirm('Are you sure you want to delete this staff member?')) {
            router.delete(`/admin/users/${target_user.id}`);
        }
    };

    return (
        <AdminLayout title={title}>
            <Head title="Staff Member Details" />

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
                            Staff Details
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

                    <Stack gap="xl">
                        {/* Header profile info */}
                        <Group gap="lg">
                            <Avatar
                                radius="xl"
                                size="lg"
                                style={{
                                    background: `${roleColor.text}20`,
                                    border: `1px solid ${roleColor.text}40`,
                                    color: roleColor.text,
                                    width: 72,
                                    height: 72,
                                    fontSize: 28,
                                }}
                            >
                                {target_user.name.charAt(0)}
                            </Avatar>
                            <Stack gap={4}>
                                <Text size="xl" fw={700} style={{ color: 'rgba(255,255,255,0.95)' }}>
                                    {target_user.name}
                                </Text>
                                <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>
                                    STAFF ID: #USR-{target_user.id}
                                </Text>
                                <Group gap={6} mt={4}>
                                    {target_user.roles?.map((role) => {
                                        const color = getRoleColor(role.name);
                                        return (
                                            <Badge
                                                key={role.id}
                                                size="sm"
                                                variant="light"
                                                style={{
                                                    background: color.bg,
                                                    color: color.text,
                                                    border: `1px solid ${color.text}40`,
                                                }}
                                                leftSection={<Shield size={12} />}
                                                radius="sm"
                                            >
                                                {role.name.toUpperCase()}
                                            </Badge>
                                        );
                                    })}
                                    {(!target_user.roles || target_user.roles.length === 0) && (
                                        <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                            No roles assigned
                                        </Text>
                                    )}
                                </Group>
                            </Stack>
                        </Group>

                        <Divider style={{ borderColor: 'rgba(255,255,255,0.06)' }} />

                        {/* Detailed grid information */}
                        <Grid gutter="md">
                            <Grid.Col span={12}>
                                <Group gap="md" wrap="nowrap" align="flex-start">
                                    <Mail size={18} style={{ color: 'rgba(255,255,255,0.3)', marginTop: 2 }} />
                                    <Stack gap={2}>
                                        <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                            Email Address
                                        </Text>
                                        <Text size="sm" fw={500} style={{ color: 'rgba(255,255,255,0.85)' }}>
                                            {target_user.email}
                                        </Text>
                                    </Stack>
                                </Group>
                            </Grid.Col>

                            <Grid.Col span={12} mt="xs">
                                <Group gap="md" wrap="nowrap" align="flex-start">
                                    <Phone size={18} style={{ color: 'rgba(255,255,255,0.3)', marginTop: 2 }} />
                                    <Stack gap={2}>
                                        <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                            Phone Number
                                        </Text>
                                        <Text size="sm" fw={500} style={{ color: 'rgba(255,255,255,0.85)' }}>
                                            {target_user.phone || 'Not provided'}
                                        </Text>
                                    </Stack>
                                </Group>
                            </Grid.Col>
                        </Grid>

                        <Divider style={{ borderColor: 'rgba(255,255,255,0.06)' }} />

                        {/* Action buttons */}
                        <Group justify="flex-end" gap="sm" mt="md">
                            <Button
                                variant="subtle"
                                color="red"
                                leftSection={<Trash size={16} />}
                                onClick={handleDelete}
                            >
                                Delete Staff
                            </Button>
                            <Button
                                component={Link}
                                href={`/admin/users/${target_user.id}/edit`}
                                leftSection={<Pencil size={16} />}
                                radius="md"
                                style={{
                                    background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                                    border: 'none',
                                    color: '#000',
                                    fontWeight: 600,
                                }}
                            >
                                Edit Staff Member
                            </Button>
                        </Group>
                    </Stack>
                </Paper>
            </Stack>
        </AdminLayout>
    );
}
