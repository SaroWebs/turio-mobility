import { Head, Link, router } from '@inertiajs/react';
import { Alert, Anchor, Box, Button, Checkbox, Group, Paper, PasswordInput, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { Activity, ArrowRight, Car, Info, Lock, Mail, ShieldCheck } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';

interface LoginProps {
    errors?: {
        email?: string;
        password?: string;
    };
}

const inputStyles = {
    label: { color: 'rgba(255,255,255,0.72)', fontWeight: 600, marginBottom: 6 },
    input: {
        minHeight: 46,
        background: 'rgba(255,255,255,0.045)',
        borderColor: 'rgba(255,255,255,0.1)',
        color: '#fff',
    },
};

const operationItems = ['Fleet and vehicle control', 'Customer, driver and guide records', 'Tours, rides and rental bookings'];

export default function Login({ errors }: LoginProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        remember: false,
    });

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);

        router.post('/login', formData, {
            onFinish: () => setLoading(false),
        });
    };

    return (
        <Box
            style={{
                minHeight: '100vh',
                background: '#080808',
                color: '#fff',
                position: 'relative',
                overflow: 'hidden',
                fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
            }}
        >
            <Head title="Admin Login" />
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Orbitron:wght@600;800&display=swap');

                body { background: #080808; }
                .font-display { font-family: 'Orbitron', sans-serif; }

                @keyframes auth-grid {
                    from { background-position: 0 0; }
                    to { background-position: 40px 40px; }
                }

                .auth-grid {
                    background-image:
                        linear-gradient(rgba(251,191,36,0.04) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(251,191,36,0.04) 1px, transparent 1px);
                    background-size: 40px 40px;
                    animation: auth-grid 9s linear infinite;
                }

                .auth-login-button {
                    background: linear-gradient(135deg, #facc15, #f59e0b) !important;
                    border: 1px solid #fde047 !important;
                    box-shadow: 0 10px 30px rgba(245,158,11,0.28) !important;
                    color: #111827 !important;
                }
                .auth-login-button:hover { background: linear-gradient(135deg, #fde047, #fbbf24) !important; }
                .auth-login-button:focus-visible { outline: 3px solid rgba(253,224,71,0.55); outline-offset: 3px; }
                .auth-login-button:disabled { opacity: 0.72; }
            `}</style>

            <Box className="auth-grid" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
            <Box
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    background: 'radial-gradient(ellipse 70% 45% at 50% 0%, rgba(251,191,36,0.1), transparent 65%)',
                }}
            />

            <Box
                style={{
                    position: 'relative',
                    zIndex: 1,
                    minHeight: '100vh',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    alignItems: 'center',
                    gap: 40,
                    width: 'min(1080px, calc(100% - 32px))',
                    margin: '0 auto',
                    padding: '48px 0',
                }}
            >
                <Stack gap="xl">
                    <Group gap="sm">
                        <img alt="" src="/brand/turiya-mark-white.png" style={{ width: 56, height: 40, objectFit: 'contain' }} />
                        <Text className="font-display" size="sm" tt="uppercase" lts={2} c="rgba(255,255,255,0.78)">
                            Turiya Mobility
                        </Text>
                    </Group>

                    <Box>
                        <Text size="xs" tt="uppercase" lts={2} c="rgba(251,191,36,0.72)" fw={700} mb={10}>
                            Secure operations console
                        </Text>
                        <Title order={1} c="#fff" fw={900} style={{ fontSize: 'clamp(2.4rem, 6vw, 4.7rem)', lineHeight: 1 }}>
                            Admin access
                        </Title>
                        <Text maw={500} mt="lg" size="md" c="rgba(255,255,255,0.56)" lh={1.7}>
                            Sign in to manage live bookings, users, vehicles, locations and service operations from the Turiya Mobility admin dashboard.
                        </Text>
                    </Box>

                    <Stack gap="sm">
                        {operationItems.map((item) => (
                            <Group key={item} gap="sm" wrap="nowrap">
                                <ThemeIcon size={28} radius="md" color="amber" variant="light">
                                    <Activity size={15} />
                                </ThemeIcon>
                                <Text size="sm" c="rgba(255,255,255,0.68)">
                                    {item}
                                </Text>
                            </Group>
                        ))}
                    </Stack>
                </Stack>

                <Paper
                    radius="md"
                    p={{ base: 'lg', sm: 'xl' }}
                    withBorder
                    shadow="xl"
                    style={{
                        width: '100%',
                        maxWidth: 460,
                        justifySelf: 'end',
                        background: 'rgba(13,13,13,0.88)',
                        borderColor: 'rgba(255,255,255,0.08)',
                        backdropFilter: 'blur(18px)',
                    }}
                >
                    <Stack gap="lg">
                        <Group justify="space-between" align="flex-start">
                            <Box>
                                <Title order={2} c="#fff" fw={800}>
                                    Welcome back
                                </Title>
                                <Text size="sm" c="rgba(255,255,255,0.45)" mt={4}>
                                    Use your admin credentials to continue.
                                </Text>
                            </Box>
                            <ThemeIcon size={46} radius="md" color="amber" variant="light">
                                <ShieldCheck size={24} />
                            </ThemeIcon>
                        </Group>

                        {errors?.email && (
                            <Alert icon={<Info size={16} />} color="red" radius="md" variant="light">
                                <Text size="sm">{errors.email}</Text>
                            </Alert>
                        )}

                        <form onSubmit={handleSubmit}>
                            <Stack gap="md">
                                <TextInput
                                    label="Admin email"
                                    placeholder="admin@skyslope.com"
                                    required
                                    leftSection={<Mail size={16} color="rgba(255,255,255,0.42)" />}
                                    value={formData.email}
                                    onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                                    error={errors?.email}
                                    radius="md"
                                    styles={inputStyles}
                                />

                                <PasswordInput
                                    label="Password"
                                    placeholder="Enter your password"
                                    required
                                    leftSection={<Lock size={16} color="rgba(255,255,255,0.42)" />}
                                    value={formData.password}
                                    onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                                    error={errors?.password}
                                    radius="md"
                                    styles={inputStyles}
                                />

                                <Group justify="space-between" mt="xs" gap="md">
                                    <Checkbox
                                        label="Remember me"
                                        checked={formData.remember}
                                        onChange={(event) => setFormData({ ...formData, remember: event.currentTarget.checked })}
                                        styles={{
                                            label: { color: 'rgba(255,255,255,0.62)' },
                                            input: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.18)' },
                                        }}
                                    />
                                    <Anchor size="sm" component={Link} href="/" c="amber.4">
                                        Back to overview
                                    </Anchor>
                                </Group>

                                <Button
                                    className="auth-login-button"
                                    type="submit"
                                    fullWidth
                                    mt="sm"
                                    radius="md"
                                    size="md"
                                    loading={loading}
                                    rightSection={<ArrowRight size={18} />}
                                    styles={{
                                        root: {
                                            minHeight: 46,
                                            color: '#080808',
                                            fontWeight: 800,
                                        },
                                    }}
                                >
                                    Login to dashboard
                                </Button>
                            </Stack>
                        </form>

                        <Alert icon={<Info size={16} />} title="Restricted access" color="amber" radius="md" variant="light">
                            <Text size="xs">Only authenticated admin users can access this panel.</Text>
                        </Alert>
                    </Stack>
                </Paper>
            </Box>
        </Box>
    );
}
