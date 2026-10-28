import React from 'react';
import { 
    Box, 
    AppShell, 
    Group, 
    Text, 
    UnstyledButton, 
    Stack, 
    rem, 
    Badge, 
    ActionIcon, 
    Avatar,
    Menu,
    Indicator,
    Transition,
    Portal
} from '@mantine/core';
import { 
    LayoutDashboard, 
    Car, 
    MapPin, 
    User, 
    Bell, 
    LogOut, 
    Settings, 
    ChevronLeft,
    Wifi,
    Battery,
    Clock,
    History,
    Wallet
} from 'lucide-react';
import { Link, router, usePage } from '@inertiajs/react';
import { useAuth } from '@/context/AuthContext';
import { useAppNotifications } from '@/app';

interface AppLayoutProps {
    children: React.ReactNode;
    title?: string;
    backPath?: string;
    showBottomNav?: boolean;
}

export default function AppLayout({ children, title, backPath, showBottomNav = true }: AppLayoutProps) {
    const { user, logout } = useAuth();
    const { url } = usePage();
    const addNotification = useAppNotifications();

    const isActive = (path: string) => url.startsWith(path);

    const navItems = user?.role === 'driver' ? [
        { icon: LayoutDashboard, label: 'Dash', path: '/driver/dashboard' },
        { icon: Wallet, label: 'Wallet', path: '/driver/wallet' },
        { icon: History, label: 'Ledger', path: '/driver/history' },
        { icon: User, label: 'Profile', path: '/driver/profile' },
    ] : [
        { icon: LayoutDashboard, label: 'Home', path: '/customer/dashboard' },
        { icon: Car, label: 'Rides', path: '/customer/rides' },
        { icon: MapPin, label: 'Tours', path: '/tours' },
        { icon: User, label: 'Profile', path: '/customer/profile' },
    ];

    return (
        <AppShell
            header={{ height: 60 }}
            padding="md"
            styles={{
                main: {
                    background: 'var(--mantine-color-gray-0)',
                    paddingBottom: showBottomNav ? rem(80) : 'var(--mantine-spacing-md)',
                    minHeight: '100vh',
                },
                header: {
                    background: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(10px)',
                    borderBottom: '1px solid var(--mantine-color-gray-2)',
                }
            }}
        >
            <AppShell.Header>
                <Group h="100%" px="md" justify="space-between">
                    <Group gap="sm">
                        {backPath ? (
                            <ActionIcon 
                                variant="subtle" 
                                color="gray" 
                                radius="xl" 
                                onClick={() => router.visit(backPath)}
                            >
                                <ChevronLeft size={20} />
                            </ActionIcon>
                        ) : (
                            <Group gap="xs" wrap="nowrap">
                                <img alt="" src="/brand/turiya-mark.png" style={{ width: 48, height: 32, objectFit: 'contain' }} />
                                <Text fw={900} size="lg" c="blue.9">Turiya Mobility</Text>
                            </Group>
                        )}
                        {title && !backPath && <Text fw={700} size="md">{title}</Text>}
                    </Group>

                    <Group gap="xs">
                        <Indicator color="red" offset={2} label="3" size={16} withBorder>
                            <ActionIcon variant="subtle" color="gray" radius="xl">
                                <Bell size={20} />
                            </ActionIcon>
                        </Indicator>
                        
                        <Menu shadow="md" width={200} position="bottom-end" radius="md">
                            <Menu.Target>
                                <UnstyledButton>
                                    <Avatar 
                                        src={user?.avatar} 
                                        alt={user?.name} 
                                        radius="xl" 
                                        size={32}
                                        color="blue"
                                    >
                                        {user?.name?.charAt(0)}
                                    </Avatar>
                                </UnstyledButton>
                            </Menu.Target>

                            <Menu.Dropdown>
                                <Menu.Label>Operational Control</Menu.Label>
                                <Menu.Item leftSection={<User size={14} />} component={Link} href={user?.role === 'driver' ? '/driver/profile' : '/customer/profile'}>
                                    Secure Identity
                                </Menu.Item>
                                <Menu.Item leftSection={<Settings size={14} />} component={Link} href={user?.role === 'driver' ? '/driver/settings' : '/customer/settings'}>
                                    Configuration
                                </Menu.Item>
                                <Menu.Divider />
                                <Menu.Item 
                                    color="red" 
                                    leftSection={<LogOut size={14} />}
                                    onClick={() => logout()}
                                >
                                    Terminate Session
                                </Menu.Item>
                            </Menu.Dropdown>
                        </Menu>
                    </Group>
                </Group>
            </AppShell.Header>

            <AppShell.Main>
                <div style={{ maxWidth: 600, margin: '0 auto' }}>
                    {children}
                </div>
            </AppShell.Main>

            {showBottomNav && (
                <Box
                    style={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 70,
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(10px)',
                        borderTop: '1px solid var(--mantine-color-gray-2)',
                        zIndex: 100,
                        display: 'flex',
                        justifyContent: 'space-around',
                        alignItems: 'center',
                        paddingBottom: 'env(safe-area-inset-bottom)',
                    }}
                >
                    {navItems.map((item) => (
                        <UnstyledButton
                            key={item.path}
                            onClick={() => router.visit(item.path)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '25%',
                                transition: 'all 0.2s ease',
                                transform: isActive(item.path) ? 'scale(1.05)' : 'scale(1)',
                            }}
                        >
                            <Box 
                                style={{
                                    color: isActive(item.path) ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-gray-5)',
                                    marginBottom: rem(4),
                                    transition: 'color 0.2s ease',
                                }}
                            >
                                <item.icon 
                                    size={24} 
                                    strokeWidth={isActive(item.path) ? 2.5 : 2} 
                                />
                            </Box>
                            <Text 
                                size="xs" 
                                fw={isActive(item.path) ? 700 : 500}
                                style={{
                                    color: isActive(item.path) ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-gray-5)',
                                    fontSize: rem(10),
                                    transition: 'color 0.2s ease',
                                }}
                            >
                                {item.label}
                            </Text>
                        </UnstyledButton>
                    ))}
                </Box>
            )}
        </AppShell>
    );
}
