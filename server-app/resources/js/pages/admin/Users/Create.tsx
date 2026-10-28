import React from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import {
    Paper,
    Stack,
    TextInput,
    PasswordInput,
    Select,
    Button,
    Group,
    Text,
} from '@mantine/core';
import { ArrowLeft, Save, Sparkles, Copy, Check } from 'lucide-react';

interface CreateUserProps {
    title: string;
    roles: Array<{
        id: number;
        name: string;
    }>;
}

const generateStrongPassword = () => {
    const length = 16;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
    let password = "";
    
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const num = "0123456789";
    const spec = "!@#$%^&*()_+~`|}{[]:;?><,./-=";
    
    password += lower.charAt(Math.floor(Math.random() * lower.length));
    password += upper.charAt(Math.floor(Math.random() * upper.length));
    password += num.charAt(Math.floor(Math.random() * num.length));
    password += spec.charAt(Math.floor(Math.random() * spec.length));
    
    for (let i = 4; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password.split('').sort(() => 0.5 - Math.random()).join('');
};

export default function CreateUser({ title, roles }: CreateUserProps) {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        email: '',
        phone: '',
        password: '',
        password_confirmation: '',
        role: '',
    });

    const [generatedPwd, setGeneratedPwd] = React.useState('');
    const [copied, setCopied] = React.useState(false);

    const handleGeneratePassword = () => {
        const newPassword = generateStrongPassword();
        setData(prev => ({
            ...prev,
            password: newPassword,
            password_confirmation: newPassword
        }));
        setGeneratedPwd(newPassword);
        setCopied(false);
    };

    const handleCopyPassword = () => {
        if (generatedPwd) {
            navigator.clipboard.writeText(generatedPwd);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/users');
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
            <Head title="Add New Staff" />

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
                            Add New Staff Member
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

                            <Group justify="space-between" align="flex-end" style={{ width: '100%' }}>
                                <div style={{ flex: 1 }}>
                                    <PasswordInput
                                        label="Password"
                                        placeholder="Enter secure password"
                                        required
                                        value={data.password}
                                        onChange={(e) => setData('password', e.currentTarget.value)}
                                        error={errors.password}
                                        radius="md"
                                        styles={inputStyles}
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    color="yellow"
                                    radius="md"
                                    leftSection={<Sparkles size={16} />}
                                    onClick={handleGeneratePassword}
                                    style={{
                                        height: 36,
                                        border: '1px solid rgba(251,191,36,0.3)',
                                        color: '#fbbf24',
                                        background: 'rgba(251,191,36,0.05)',
                                    }}
                                >
                                    Generate
                                </Button>
                            </Group>

                            <PasswordInput
                                label="Confirm Password"
                                placeholder="Repeat secure password"
                                required
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.currentTarget.value)}
                                error={errors.password_confirmation}
                                radius="md"
                                styles={inputStyles}
                            />

                            {generatedPwd && (
                                <Paper
                                    p="md"
                                    radius="md"
                                    style={{
                                        background: 'rgba(251,191,36,0.08)',
                                        border: '1px solid rgba(251,191,36,0.15)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: 12,
                                    }}
                                >
                                    <Stack gap={2} style={{ flex: 1 }}>
                                        <Text size="xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                            Generated Password:
                                        </Text>
                                        <Text size="sm" fw={700} style={{ color: '#fbbf24', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                            {generatedPwd}
                                        </Text>
                                    </Stack>
                                    <Button
                                        size="xs"
                                        variant="subtle"
                                        color="yellow"
                                        leftSection={copied ? <Check size={14} /> : <Copy size={14} />}
                                        onClick={handleCopyPassword}
                                        style={{ flexShrink: 0 }}
                                    >
                                        {copied ? 'Copied' : 'Copy'}
                                    </Button>
                                </Paper>
                            )}

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
                                Save Staff Member
                            </Button>
                        </Stack>
                    </form>
                </Paper>
            </Stack>
        </AdminLayout>
    );
}