import React, { useState } from 'react';
import { Link, useForm, usePage } from '@inertiajs/react';
import { Head } from '@inertiajs/react';
import {
    AppShell,
    Burger,
    Group,
    Text,
    UnstyledButton,
    ScrollArea,
    Menu,
    Modal,
    PasswordInput,
    Button,
    Stack,
    rem,
    Box,
    Collapse,
    ActionIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { motion } from 'framer-motion';
import {
    LayoutDashboard,
    Users,
    Map,
    ClipboardList,
    Car,
    MapPin,
    Settings,
    LogOut,
    ChevronRight,
    ChevronDown,
    Bell,
    Search,
    UserCircle,
    Activity,
    TicketPercent,
    UserCheck,
    Truck,
    ShieldCheck,
    Lock,
    Sparkles,
    Copy,
    Check,
    Coins,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface AdminLayoutProps {
    children: React.ReactNode;
    title?: string;
}

interface NavigationItem {
    name: string;
    href: string;
    icon: React.ElementType;
    current?: boolean;
    children?: { name: string; href: string }[];
}

interface AdminUser {
    name: string;
    email?: string;
}

interface AdminPageProps {
    auth?: {
        user?: AdminUser;
    };
    [key: string]: unknown;
}

/* ─────────────────────────────────────────────
   Global styles (injected once)
───────────────────────────────────────────── */
const GlobalStyles = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Orbitron:wght@600;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        body {
            font-family: 'DM Sans', 'Helvetica Neue', sans-serif !important;
            background: #080808 !important;
            color: rgba(255,255,255,0.85) !important;
        }

        .font-orbitron { font-family: 'Orbitron', sans-serif; }

        /* scrollbar */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(251,191,36,0.2); border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(251,191,36,0.4); }

        /* animated grid bg */
        @keyframes grid-drift {
            from { background-position: 0 0; }
            to   { background-position: 40px 40px; }
        }
        .admin-grid-bg {
            background-image:
                linear-gradient(rgba(251,191,36,0.035) 1px, transparent 1px),
                linear-gradient(90deg, rgba(251,191,36,0.035) 1px, transparent 1px);
            background-size: 40px 40px;
            animation: grid-drift 10s linear infinite;
        }

        /* nav hover */
        .nav-item-btn:hover { background: rgba(255,255,255,0.04) !important; }
        .nav-child-btn:hover { background: rgba(251,191,36,0.06) !important; color: rgba(251,191,36,0.9) !important; }

        /* mantine overrides */
        .mantine-AppShell-header {
            background: rgba(8,8,8,0.85) !important;
            border-bottom: 1px solid rgba(255,255,255,0.06) !important;
            backdrop-filter: blur(16px) !important;
        }
        .mantine-AppShell-navbar {
            background: #0c0c0c !important;
            border-right: 1px solid rgba(255,255,255,0.06) !important;
        }
        .mantine-AppShell-main {
            background: transparent !important;
        }

        /* dark admin tables */
        .mantine-Table-table {
            --table-border-color: rgba(255,255,255,0.07) !important;
            --table-hover-color: rgba(251,191,36,0.055) !important;
            --table-striped-color: rgba(255,255,255,0.025) !important;
            --table-highlight-on-hover-color: rgba(251,191,36,0.055) !important;
            color: rgba(255,255,255,0.78) !important;
            background: transparent !important;
        }
        .mantine-Table-scrollContainer {
            border-color: rgba(255,255,255,0.07) !important;
        }
        .mantine-Table-thead {
            background: rgba(255,255,255,0.035) !important;
        }
        .mantine-Table-th {
            color: rgba(255,255,255,0.55) !important;
            border-color: rgba(255,255,255,0.07) !important;
        }
        .mantine-Table-td {
            color: rgba(255,255,255,0.78) !important;
            border-color: rgba(255,255,255,0.06) !important;
            background: transparent !important;
        }
        .mantine-Table-tr[data-hover]:hover {
            --tr-hover-bg: rgba(251,191,36,0.055) !important;
            background-color: rgba(251,191,36,0.055) !important;
        }
        .mantine-Table-tr[data-hover]:hover .mantine-Table-td {
            color: rgba(255,255,255,0.9) !important;
            background: transparent !important;
        }

        /* dark admin surfaces and controls */
        .mantine-Paper-root,
        .mantine-Card-root {
            background: rgba(17,17,17,0.64) !important;
            border-color: rgba(255,255,255,0.07) !important;
            color: rgba(255,255,255,0.84) !important;
            backdrop-filter: blur(12px);
        }
        .mantine-Card-section {
            border-color: rgba(255,255,255,0.07) !important;
        }
        .mantine-Input-input,
        .mantine-Textarea-input,
        .mantine-Select-input,
        .mantine-NumberInput-input {
            background: rgba(255,255,255,0.035) !important;
            border-color: rgba(255,255,255,0.09) !important;
            color: rgba(255,255,255,0.86) !important;
        }
        .mantine-Input-input::placeholder,
        .mantine-Textarea-input::placeholder,
        .mantine-Select-input::placeholder,
        .mantine-NumberInput-input::placeholder {
            color: rgba(255,255,255,0.34) !important;
        }
        .mantine-Input-input:focus,
        .mantine-Textarea-input:focus,
        .mantine-Select-input:focus,
        .mantine-NumberInput-input:focus {
            border-color: rgba(251,191,36,0.45) !important;
            box-shadow: 0 0 0 2px rgba(251,191,36,0.1) !important;
        }
        .mantine-Input-label,
        .mantine-Textarea-label,
        .mantine-Select-label,
        .mantine-NumberInput-label,
        .mantine-Checkbox-label {
            color: rgba(255,255,255,0.66) !important;
        }
        .mantine-Input-section,
        .mantine-Select-section,
        .mantine-NumberInput-section {
            color: rgba(255,255,255,0.42) !important;
        }
        .mantine-Select-dropdown,
        .mantine-Menu-dropdown,
        .mantine-Combobox-dropdown,
        .mantine-Popover-dropdown {
            background: #111 !important;
            border-color: rgba(255,255,255,0.08) !important;
            color: rgba(255,255,255,0.82) !important;
        }
        .mantine-Select-option,
        .mantine-Combobox-option,
        .mantine-Menu-item {
            color: rgba(255,255,255,0.76) !important;
        }
        .mantine-Select-option:hover,
        .mantine-Combobox-option:hover,
        .mantine-Menu-item:hover {
            background: rgba(251,191,36,0.07) !important;
            color: rgba(255,255,255,0.92) !important;
        }
        .mantine-Menu-label {
            color: rgba(255,255,255,0.34) !important;
        }
        .mantine-Menu-divider,
        .mantine-Divider-root {
            border-color: rgba(255,255,255,0.08) !important;
        }
        .mantine-Tabs-list {
            border-color: rgba(255,255,255,0.09) !important;
        }
        .mantine-Tabs-tab {
            color: rgba(255,255,255,0.58) !important;
            border-color: rgba(255,255,255,0.09) !important;
        }
        .mantine-Tabs-tab:hover {
            background: rgba(251,191,36,0.055) !important;
            color: rgba(255,255,255,0.88) !important;
        }
        .mantine-Tabs-tab[data-active] {
            background: rgba(251,191,36,0.1) !important;
            color: #fbbf24 !important;
            border-color: rgba(251,191,36,0.3) !important;
        }
        .mantine-Pagination-control {
            background: rgba(255,255,255,0.035) !important;
            border-color: rgba(255,255,255,0.08) !important;
            color: rgba(255,255,255,0.72) !important;
        }
        .mantine-Pagination-control:hover {
            background: rgba(251,191,36,0.075) !important;
        }
        .mantine-Pagination-control[data-active] {
            background: #fbbf24 !important;
            border-color: #fbbf24 !important;
            color: #080808 !important;
        }
        .mantine-Modal-content,
        .mantine-Modal-header {
            background: #111 !important;
            color: rgba(255,255,255,0.86) !important;
        }
        .mantine-Modal-content {
            border: 1px solid rgba(255,255,255,0.08) !important;
        }
        .mantine-Modal-title {
            color: rgba(255,255,255,0.9) !important;
        }
        .mantine-Badge-root[data-variant="outline"] {
            border-color: rgba(255,255,255,0.16) !important;
        }

        /* Legacy admin pages still use light Tailwind utilities. Keep every
           content surface readable while those pages are migrated. */
        .admin-shell {
            --mantine-color-text: rgba(255,255,255,0.88);
            --mantine-color-body: #080808;
            color: rgba(255,255,255,0.88);
        }
        .admin-shell .mantine-Title-root,
        .admin-shell .mantine-Text-root:not([data-dimmed]),
        .admin-shell h1,
        .admin-shell h2,
        .admin-shell h3,
        .admin-shell h4,
        .admin-shell dd {
            color: rgba(255,255,255,0.9);
        }
        .admin-shell .mantine-Text-root[data-dimmed],
        .admin-shell .mantine-Input-description,
        .admin-shell dt,
        .admin-shell [class*="text-gray-500"],
        .admin-shell [class*="text-gray-600"] {
            color: rgba(255,255,255,0.62) !important;
        }
        .admin-shell [class*="text-gray-700"],
        .admin-shell [class*="text-gray-900"],
        .admin-shell [class~="text-black"] {
            color: rgba(255,255,255,0.88) !important;
        }
        .admin-shell [class~="bg-white"],
        .admin-shell [class*="bg-gray-50"],
        .admin-shell [class*="bg-gray-100"] {
            background-color: rgba(17,17,17,0.86) !important;
        }
        .admin-shell [class*="border-gray-"],
        .admin-shell input,
        .admin-shell select,
        .admin-shell textarea {
            border-color: rgba(255,255,255,0.12) !important;
        }
        .admin-shell input:not([type="checkbox"]):not([type="radio"]),
        .admin-shell select,
        .admin-shell textarea {
            background-color: rgba(255,255,255,0.045) !important;
            color: rgba(255,255,255,0.9) !important;
        }
        .admin-shell option { background: #111; color: #f8fafc; }
        .admin-shell input[type="file"]::file-selector-button {
            background: rgba(251,191,36,0.12);
            border: 0;
            color: #fbbf24;
            min-height: 42px;
            padding: 0 14px;
        }
        .admin-shell a, .admin-shell button { outline-offset: 3px; }
        .admin-shell a:focus-visible, .admin-shell button:focus-visible {
            outline: 3px solid rgba(251,191,36,0.72);
        }
    `}</style>
);

/* ─────────────────────────────────────────────
   Pulse dot
───────────────────────────────────────────── */
const PulseDot = () => (
    <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
        <span style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%', background: '#fbbf24',
            opacity: 0.6,
            animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
        }} />
        <span style={{
            position: 'relative', width: 8, height: 8,
            borderRadius: '50%', background: '#fbbf24',
        }} />
        <style>{`@keyframes ping { 75%,100%{ transform:scale(2); opacity:0; } }`}</style>
    </span>
);

/* ─────────────────────────────────────────────
   Amber icon box
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   NavItem
───────────────────────────────────────────── */
const NavItem = ({ item, index }: { item: NavigationItem; index: number }) => {
    const { url } = usePage();
    const [opened, setOpened] = useState(!!item.current);
    const hasChildren = !!item.children;
    const isActive = item.current;

    const baseStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 12px',
        borderRadius: 10,
        display: 'block',
        transition: 'all 0.2s ease',
        textDecoration: 'none',
        color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
        background: isActive && !hasChildren
            ? 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))'
            : 'transparent',
        border: isActive && !hasChildren
            ? '1px solid rgba(251,191,36,0.2)'
            : '1px solid transparent',
        position: 'relative',
        overflow: 'hidden',
    };

    const innerContent = (
        <Group justify="space-between" gap={0} style={{ pointerEvents: 'none' }}>
            <Group gap={10}>
                <item.icon
                    size={18}
                    strokeWidth={isActive ? 2 : 1.5}
                    color={isActive ? '#fbbf24' : 'rgba(255,255,255,0.35)'}
                />
                <Text
                    size="sm"
                    fw={isActive ? 600 : 400}
                    style={{ color: 'inherit', letterSpacing: '0.01em' }}
                >
                    {item.name}
                </Text>
            </Group>
            {hasChildren && (
                <ChevronRight
                    size={13}
                    strokeWidth={2}
                    color="rgba(255,255,255,0.3)"
                    style={{
                        transform: opened ? 'rotate(90deg)' : 'none',
                        transition: 'transform 220ms ease',
                    }}
                />
            )}
        </Group>
    );

    return (
        <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
            style={{ marginBottom: 2 }}
        >
            {/* amber left bar for active */}
            {isActive && !hasChildren && (
                <div style={{
                    position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                    width: 3, height: '60%', borderRadius: 99,
                    background: '#fbbf24',
                    boxShadow: '0 0 8px rgba(251,191,36,0.6)',
                    marginLeft: 0,
                }} />
            )}

            {hasChildren ? (
                <UnstyledButton
                    onClick={() => setOpened((o) => !o)}
                    style={baseStyle}
                    className="nav-item-btn"
                >
                    {innerContent}
                </UnstyledButton>
            ) : (
                <UnstyledButton
                    component={Link}
                    href={item.href}
                    style={baseStyle}
                    className="nav-item-btn"
                >
                    {innerContent}
                </UnstyledButton>
            )}

            {hasChildren && (
                <Collapse in={opened}>
                    <Box pt={2} pb={2} pl={28}>
                        <div style={{
                            borderLeft: '1px solid rgba(251,191,36,0.15)',
                            paddingLeft: 14,
                            marginLeft: 2,
                        }}>
                            {item.children?.map((child, ci) => {
                                const isChildActive = url.startsWith(child.href);
                                return (
                                    <motion.div
                                        key={child.name}
                                        initial={{ opacity: 0, x: -6 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.25, delay: ci * 0.04 }}
                                    >
                                        <UnstyledButton
                                            component={Link}
                                            href={child.href}
                                            className="nav-child-btn"
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                padding: '7px 10px',
                                                borderRadius: 7,
                                                fontSize: 13,
                                                fontWeight: isChildActive ? 600 : 400,
                                                color: isChildActive ? '#fbbf24' : 'rgba(255,255,255,0.38)',
                                                transition: 'all 0.18s ease',
                                                letterSpacing: '0.01em',
                                            }}
                                        >
                                            {child.name}
                                        </UnstyledButton>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </Box>
                </Collapse>
            )}
        </motion.div>
    );
};

/* ─────────────────────────────────────────────
   Main Layout
───────────────────────────────────────────── */
const AdminLayout = ({ children, title = 'Admin Panel' }: AdminLayoutProps) => {
    const [opened, { toggle }] = useDisclosure();
    const { url, props } = usePage<AdminPageProps>();
    const user = props.auth?.user || { name: 'Admin', email: 'admin@example.com' };

    const [pwdOpened, { open: openPwd, close: closePwd }] = useDisclosure(false);
    const { data: pwdData, setData: setPwdData, put: putPwd, processing: pwdProcessing, errors: pwdErrors, reset: resetPwd } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const [generatedPwd, setGeneratedPwd] = useState('');
    const [copied, setCopied] = useState(false);

    const generateStrongPassword = () => {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
        const lower = 'abcdefghijklmnopqrstuvwxyz';
        const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const num   = '0123456789';
        const spec  = '!@#$%^&*()_+';
        const pwd = [
            lower.charAt(Math.floor(Math.random() * lower.length)),
            upper.charAt(Math.floor(Math.random() * upper.length)),
            num.charAt(Math.floor(Math.random() * num.length)),
            spec.charAt(Math.floor(Math.random() * spec.length)),
        ];
        for (let i = 4; i < 16; i++) pwd.push(charset.charAt(Math.floor(Math.random() * charset.length)));
        return pwd.sort(() => 0.5 - Math.random()).join('');
    };

    const handleGeneratePassword = () => {
        const pwd = generateStrongPassword();
        setPwdData(prev => ({ ...prev, password: pwd, password_confirmation: pwd }));
        setGeneratedPwd(pwd);
        setCopied(false);
    };

    const handleCopyPassword = () => {
        if (generatedPwd) {
            navigator.clipboard.writeText(generatedPwd);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        putPwd('/admin/profile/password', {
            onSuccess: () => {
                resetPwd();
                setGeneratedPwd('');
                setCopied(false);
                closePwd();
            },
        });
    };

    const navigation: NavigationItem[] = [
        {
            name: 'Dashboard',
            href: '/admin/journey-operations',
            icon: LayoutDashboard,
            current: url === '/admin/dashboard',
        },
        {
            name: 'Management',
            href: '#',
            icon: Users,
            current: url.startsWith('/admin/users'),
            children: [
                { name: 'System Users', href: '/admin/users' },
            ],
        },
        {
            name: 'Customers',
            href: '/admin/customers',
            icon: UserCheck,
            current: url.startsWith('/admin/customers'),
        },
        {
            name: 'Drivers',
            href: '#',
            icon: Truck,
            current: url.startsWith('/admin/drivers') || url.startsWith('/admin/vehicles'),
            children: [
                { name: 'Driver Directory', href: '/admin/drivers' },
                { name: 'Document Verification', href: '/admin/verification' },
                { name: 'Vehicle Inventory', href: '/admin/vehicles' },
            ],
        },
        {
            name: 'Bookings',
            href: '/admin/bookings',
            icon: ClipboardList,
            current:
                url.startsWith('/admin/bookings') ||
                url.startsWith('/admin/ride-bookings') ||
                url.startsWith('/admin/tour-bookings') ||
                url.startsWith('/admin/car-rentals'),
        },
        { name: 'Carpool', href: '/admin/carpool', icon: Car, current: url.startsWith('/admin/carpool') },
        { name: 'Tour Packages', href: '/admin/tours', icon: Map, current: url.startsWith('/admin/tours') },
        {
            name: 'Destinations',
            href: '#',
            icon: MapPin,
            current: url.startsWith('/admin/destinations') || url.startsWith('/admin/places'),
            children: [
                { name: 'Destination Directory', href: '/admin/destinations' },
                { name: 'Points of Interest', href: '/admin/places' },
            ],
        },
        { name: 'Coupons & Offers', href: '/admin/coupons', icon: TicketPercent, current: url.startsWith('/admin/coupons') },
        {
            name: 'Master Data',
            href: '#',
            icon: MapPin,
            current: url.startsWith('/admin/car-categories'),
            children: [
                { name: 'Car Categories', href: '/admin/car-categories' },
            ],
        },
        {
            name: 'Financials',
            href: '#',
            icon: Coins,
            current: url.startsWith('/admin/financials'),
            children: [
                { name: 'Driver Wallets', href: '/admin/financials/wallets' },
                { name: 'Payout Requests', href: '/admin/financials/withdrawals' },
            ],
        },
        {
            name: 'Configuration',
            href: '#',
            icon: ShieldCheck,
            current:
                url.startsWith('/admin/cms') ||
                url.startsWith('/admin/roles') ||
                url.startsWith('/admin/settings') ||
                url.startsWith('/admin/service-zones'),
            children: [
                { name: 'Frontend CMS', href: '/admin/cms' },
                { name: 'System Settings', href: '/admin/settings' },
                { name: 'Service Zones', href: '/admin/service-zones' },
                { name: 'Roles & Permissions', href: '/admin/roles' },
            ],
        },
    ];

    return (
        <>
            <GlobalStyles />

            {/* full-page grid background */}
            <div
                className="admin-grid-bg"
                style={{
                    position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
                }}
            />
            {/* radial amber glow top-center */}
            <div style={{
                position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
                background: 'radial-gradient(ellipse 70% 40% at 50% -5%, rgba(251,191,36,0.07), transparent)',
            }} />

            <AppShell
                className="admin-shell"
                header={{ height: 68 }}
                navbar={{ width: 268, breakpoint: 'sm', collapsed: { mobile: !opened } }}
                padding="md"
                styles={{ main: { background: 'transparent', position: 'relative', zIndex: 1 } }}
            >
                <Head title={title} />

                {/* ── Header ── */}
                <AppShell.Header px="md">
                    <Group h="100%" justify="space-between">
                        <Group gap="md">
                            <Burger
                                opened={opened}
                                onClick={toggle}
                                hiddenFrom="sm"
                                size="sm"
                                color="rgba(255,255,255,0.5)"
                            />

                            {/* logo */}
                            <Group gap={10}>
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                >
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 10,
                                        background: '#fbbf24',
                                        boxShadow: '0 0 20px rgba(251,191,36,0.4)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Car size={18} color="#000" strokeWidth={2.5} />
                                    </div>
                                </motion.div>
                                <motion.div
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.5, delay: 0.1 }}
                                >
                                    <span className="font-orbitron" style={{
                                        fontSize: 15, letterSpacing: '0.12em',
                                        color: 'rgba(255,255,255,0.85)',
                                    }}>
                                        SKY<span style={{ color: '#fbbf24' }}>SLOPE</span>
                                    </span>
                                </motion.div>
                            </Group>
                        </Group>

                        {/* right side */}
                        <Group gap="md">
                            {/* system live badge */}
                            <Group
                                gap={6}
                                visibleFrom="sm"
                                style={{
                                    padding: '5px 12px', borderRadius: 99,
                                    border: '1px solid rgba(255,255,255,0.07)',
                                    background: 'rgba(255,255,255,0.03)',
                                }}
                            >
                                <PulseDot />
                                <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>
                                    System Live
                                </Text>
                            </Group>

                            {/* icon buttons */}
                            <Group gap={4} visibleFrom="sm">
                                {[Search, Bell].map((Icon, i) => (
                                    <ActionIcon
                                        key={i}
                                        variant="subtle"
                                        size="lg"
                                        radius="md"
                                        style={{
                                            color: 'rgba(255,255,255,0.35)',
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <Icon size={17} strokeWidth={1.5} />
                                    </ActionIcon>
                                ))}
                            </Group>

                            {/* user menu */}
                            <Menu shadow="md" width={210} position="bottom-end" transitionProps={{ transition: 'pop-top-right' }}>
                                <Menu.Target>
                                    <UnstyledButton>
                                        <Group gap={10}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                                                boxShadow: '0 0 12px rgba(251,191,36,0.3)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 700, fontSize: 14, color: '#000',
                                                fontFamily: 'Orbitron, sans-serif',
                                                flexShrink: 0,
                                            }}>
                                                {user.name.charAt(0)}
                                            </div>
                                            <div className="hidden sm:block">
                                                <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.2 }}>
                                                    {user.name}
                                                </Text>
                                                <Text size="xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                                                    Administrator
                                                </Text>
                                            </div>
                                            <ChevronDown size={13} color="rgba(255,255,255,0.3)" className="hidden sm:block" />
                                        </Group>
                                    </UnstyledButton>
                                </Menu.Target>

                                <Menu.Dropdown style={{
                                    background: '#111',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: 12,
                                }}>
                                    <Menu.Label style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: '0.08em' }}>
                                        ACCOUNT
                                    </Menu.Label>
                                    <Menu.Item
                                        leftSection={<UserCircle size={rem(14)} color="rgba(255,255,255,0.5)" />}
                                        component={Link}
                                        href="/admin/profile"
                                        style={{ color: 'rgba(255,255,255,0.7)', borderRadius: 8 }}
                                    >
                                        My Profile
                                    </Menu.Item>
                                    <Menu.Item
                                        leftSection={<Lock size={rem(14)} color="rgba(255,255,255,0.5)" />}
                                        style={{ color: 'rgba(255,255,255,0.7)', borderRadius: 8 }}
                                        onClick={openPwd}
                                    >
                                        Change Password
                                    </Menu.Item>
                                    <Menu.Item
                                        leftSection={<Settings size={rem(14)} color="rgba(255,255,255,0.5)" />}
                                        component={Link}
                                        href="/admin/settings"
                                        style={{ color: 'rgba(255,255,255,0.7)', borderRadius: 8 }}
                                    >
                                        System Settings
                                    </Menu.Item>
                                    <Menu.Divider style={{ borderColor: 'rgba(255,255,255,0.07)' }} />
                                    <Menu.Item
                                        color="red"
                                        leftSection={<LogOut size={rem(14)} />}
                                        component={Link}
                                        href="/admin/logout"
                                        method="post"
                                        as="button"
                                        style={{ borderRadius: 8 }}
                                    >
                                        Logout
                                    </Menu.Item>
                                </Menu.Dropdown>
                            </Menu>
                        </Group>
                    </Group>
                </AppShell.Header>

                {/* ── Navbar ── */}
                <AppShell.Navbar p="xs">
                    {/* top hairline */}
                    <div style={{
                        height: 1,
                        background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.4), transparent)',
                        marginBottom: 12,
                    }} />

                    <AppShell.Section grow component={ScrollArea} scrollbarSize={4}>
                        <Box py="xs" px={4}>
                            {/* section label */}
                            <Text size="10px" style={{
                                color: 'rgba(255,255,255,0.2)',
                                letterSpacing: '0.14em',
                                textTransform: 'uppercase',
                                padding: '0 12px',
                                marginBottom: 8,
                            }}>
                                Navigation
                            </Text>

                            {navigation.map((item, i) => (
                                <NavItem key={item.name} item={item} index={i} />
                            ))}
                        </Box>
                    </AppShell.Section>

                    <AppShell.Section>
                        <div style={{
                            height: 1,
                            background: 'rgba(255,255,255,0.05)',
                            margin: '8px 0',
                        }} />
                        <Box px={4} pb={8}>
                            <UnstyledButton
                                component={Link}
                                href="/admin/logout"
                                method="post"
                                as="button"
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    color: 'rgba(239,68,68,0.6)',
                                    transition: 'all 0.2s ease',
                                    border: '1px solid transparent',
                                }}
                                className="nav-item-btn"
                            >
                                <Group gap={10}>
                                    <LogOut size={18} strokeWidth={1.5} />
                                    <Text size="sm" fw={500} style={{ color: 'inherit' }}>Sign Out</Text>
                                </Group>
                            </UnstyledButton>
                        </Box>
                    </AppShell.Section>
                </AppShell.Navbar>

                {/* ── Main ── */}
                <AppShell.Main>
                    <Box px={{ base: 0, sm: 'sm' }} py="sm">

                        {/* page header */}
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <Group justify="space-between" mb="xl" align="flex-end">
                                <div>
                                    <Group gap={6} mb={6}>
                                        <Activity size={12} color="#fbbf24" strokeWidth={2} />
                                        <Text size="10px" style={{
                                            color: 'rgba(255,255,255,0.3)',
                                            letterSpacing: '0.14em',
                                            textTransform: 'uppercase',
                                        }}>
                                            Admin Area
                                        </Text>
                                    </Group>
                                    <Text
                                        size="xl"
                                        fw={700}
                                        style={{
                                            fontFamily: 'Orbitron, sans-serif',
                                            letterSpacing: '0.04em',
                                            color: 'rgba(255,255,255,0.9)',
                                            lineHeight: 1.1,
                                        }}
                                    >
                                        {title}
                                    </Text>
                                </div>

                                {/* subtle amber rule */}
                                <div style={{
                                    flex: 1,
                                    height: 1,
                                    marginLeft: 24,
                                    background: 'linear-gradient(90deg, rgba(251,191,36,0.2), transparent)',
                                }} />
                            </Group>
                        </motion.div>

                        {/* page content */}
                        <motion.div
                            key={title}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                        >
                            {children}
                        </motion.div>
                    </Box>
                </AppShell.Main>
            </AppShell>

            {/* ── Change Password Modal ── */}
            <Modal
                opened={pwdOpened}
                onClose={closePwd}
                title={
                    <Group gap="sm">
                        <Lock size={18} style={{ color: '#fbbf24' }} />
                        <Text fw={700} style={{ color: 'rgba(255,255,255,0.9)' }}>Change Password</Text>
                    </Group>
                }
                centered
                radius="md"
                styles={{
                    content: { background: '#111', border: '1px solid rgba(255,255,255,0.08)' },
                    header: { background: '#111', borderBottom: '1px solid rgba(255,255,255,0.06)' },
                    close: { color: 'rgba(255,255,255,0.4)' },
                }}
            >
                <form onSubmit={handlePasswordSubmit}>
                    <Stack gap="md" pt="xs">
                        <PasswordInput
                            label="Current Password"
                            placeholder="Your current password"
                            required
                            value={pwdData.current_password}
                            onChange={(e) => setPwdData('current_password', e.currentTarget.value)}
                            error={pwdErrors.current_password}
                            radius="md"
                            styles={{
                                input: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' },
                                label: { color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
                            }}
                        />
                        <PasswordInput
                            label="New Password"
                            placeholder="At least 8 characters"
                            required
                            value={pwdData.password}
                            onChange={(e) => setPwdData('password', e.currentTarget.value)}
                            error={pwdErrors.password}
                            radius="md"
                            styles={{
                                input: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' },
                                label: { color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
                            }}
                            rightSection={
                                <ActionIcon
                                    variant="subtle"
                                    size="sm"
                                    title="Generate strong password"
                                    onClick={handleGeneratePassword}
                                    style={{ color: '#fbbf24' }}
                                >
                                    <Sparkles size={14} />
                                </ActionIcon>
                            }
                        />
                        <PasswordInput
                            label="Confirm New Password"
                            placeholder="Repeat new password"
                            required
                            value={pwdData.password_confirmation}
                            onChange={(e) => setPwdData('password_confirmation', e.currentTarget.value)}
                            error={pwdErrors.password_confirmation}
                            radius="md"
                            styles={{
                                input: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' },
                                label: { color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
                            }}
                        />

                        {/* Generated password strip */}
                        {generatedPwd && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                padding: '10px 14px',
                                borderRadius: 10,
                                background: 'rgba(251,191,36,0.07)',
                                border: '1px solid rgba(251,191,36,0.18)',
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Text size="10px" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
                                        Generated Password
                                    </Text>
                                    <Text size="sm" fw={700} style={{ color: '#fbbf24', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                        {generatedPwd}
                                    </Text>
                                </div>
                                <Button
                                    size="xs"
                                    variant="subtle"
                                    color="yellow"
                                    leftSection={copied ? <Check size={13} /> : <Copy size={13} />}
                                    onClick={handleCopyPassword}
                                    style={{ flexShrink: 0, color: copied ? '#10b981' : '#fbbf24' }}
                                >
                                    {copied ? 'Copied!' : 'Copy'}
                                </Button>
                            </div>
                        )}
                        <Button
                            type="submit"
                            radius="md"
                            loading={pwdProcessing}
                            fullWidth
                            style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)', border: 'none', color: '#000', fontWeight: 600 }}
                        >
                            Update Password
                        </Button>
                    </Stack>
                </form>
            </Modal>
        </>
    );
};

export default AdminLayout;
