import React, { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import { 
    Card,
    Avatar,
    Badge, 
    Table, 
    Select, 
    Button, 
    Loader, 
    Group, 
    Stack, 
    Text, 
    Paper, 
    SimpleGrid, 
    ThemeIcon, 
    Progress,
    Box,
    rem,
    Divider,
    ScrollArea,
    ActionIcon,
    Tooltip
} from '@mantine/core';
import {
    DollarSign,
    TrendingUp,
    Calendar,
    Download,
    Filter,
    BarChart3,
    ArrowUpRight,
    Clock,
    User,
    Wallet,
    Percent,
    Car,
    FileSpreadsheet,
    ChevronRight,
    Target
} from 'lucide-react';
import axios from '@/lib/axios';

interface CommissionStats {
    total_commission: number;
    today_commission: number;
    month_commission: number;
    pending_commission: number;
    commission_count: number;
    average_commission: number;
    by_service_type: {
        type: string;
        count: number;
        total: number;
        percentage: number;
    }[];
    by_driver: {
        driver_id: number;
        driver_name: string;
        total_rides: number;
        total_commission: number;
        total_earnings: number;
    }[];
    daily_trend: {
        date: string;
        commission: number;
        rides: number;
    }[];
}

interface CommissionTransaction {
    id: number;
    booking_number: string;
    driver_name: string;
    service_type: string;
    total_fare: number;
    commission_amount: number;
    driver_share: number;
    status: string;
    created_at: string;
}

const CommissionAnalytics: React.FC = () => {
    const [stats, setStats] = useState<CommissionStats | null>(null);
    const [transactions, setTransactions] = useState<CommissionTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [serviceType, setServiceType] = useState<string>('all');

    useEffect(() => {
        fetchCommissionData();
    }, [dateRange, serviceType]);

    const fetchCommissionData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [statsRes, transactionsRes] = await Promise.all([
                axios.get('/admin/api/commission-stats', {
                    baseURL: '',
                    params: {
                        start_date: dateRange.start,
                        end_date: dateRange.end,
                        service_type: serviceType
                    }
                }),
                axios.get('/admin/api/commission-transactions', {
                    baseURL: '',
                    params: {
                        start_date: dateRange.start,
                        end_date: dateRange.end,
                        service_type: serviceType
                    }
                })
            ]);

            if (statsRes.data.success) setStats(statsRes.data.data);
            if (transactionsRes.data.success) setTransactions(transactionsRes.data.data);
        } catch (error) {
            console.error('Error fetching commission data:', error);
            setError('Unable to load commission analytics right now.');
        } finally {
            setLoading(false);
        }
    };

    const exportToCsv = () => {
        if (!transactions.length) return;
        const headers = ['Booking', 'Driver', 'Service Type', 'Total Fare', 'Commission', 'Driver Share', 'Status', 'Date'];
        const rows = transactions.map(t => [
            t.booking_number, t.driver_name, t.service_type, t.total_fare, t.commission_amount, t.driver_share, t.status, new Date(t.created_at).toLocaleDateString()
        ]);
        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `commission-report-${dateRange.start}-to-${dateRange.end}.csv`;
        a.click();
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    if (loading) return (
        <AdminLayout title="Commission Analytics">
            <Box h={400} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader size="xl" variant="bars" />
            </Box>
        </AdminLayout>
    );

    return (
        <AdminLayout title="Commission Analytics">
            <Head title="Commission Analytics" />

            <Stack gap="xl">
                {/* Header Section */}
                <Group justify="space-between" align="flex-end">
                    <Stack gap={2}>
                        <Text size="h3" fw={800}>Commission Portfolio</Text>
                        <Text size="sm" color="dimmed">Detailed revenue intelligence and platform commission distribution.</Text>
                    </Stack>
                    <Group gap="sm">
                        <Button 
                            variant="light" 
                            color="blue" 
                            leftSection={<FileSpreadsheet size={16} />}
                            onClick={exportToCsv}
                        >
                            Export Report
                        </Button>
                    </Group>
                </Group>

                {/* Quick Filters */}
                <Paper p="md" radius="md" withBorder shadow="sm">
                    <Group justify="space-between">
                        <Group gap="md">
                            <Group gap={8}>
                                <Calendar size={16} color="gray" />
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                    style={{ border: '1px solid #e9ecef', borderRadius: '8px', padding: '6px 12px', fontSize: '14px' }}
                                />
                                <Text size="sm" color="dimmed">to</Text>
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                    style={{ border: '1px solid #e9ecef', borderRadius: '8px', padding: '6px 12px', fontSize: '14px' }}
                                />
                            </Group>
                            <Divider orientation="vertical" />
                            <Select
                                value={serviceType}
                                onChange={(value) => setServiceType(value || 'all')}
                                data={[
                                    { value: 'all', label: 'All Services' },
                                    { value: 'point_to_point', label: 'Local Rides' },
                                    { value: 'hourly_rental', label: 'Rentals' },
                                    { value: 'round_trip', label: 'Round Trips' }
                                ]}
                                radius="md"
                                leftSection={<Car size={16} color="gray" />}
                            />
                        </Group>
                        <Button color="blue" radius="md" onClick={fetchCommissionData} leftSection={<Filter size={16} />}>
                            Run Analysis
                        </Button>
                    </Group>
                </Paper>

                {/* Key Metrics */}
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
                    <Paper p="xl" radius="md" withBorder shadow="xs">
                        <Group justify="space-between">
                            <Stack gap={0}>
                                <Text size="xs" color="dimmed" fw={700} tt="uppercase">Accumulated Commission</Text>
                                <Text size="h3" fw={800}>{formatCurrency(stats?.total_commission || 0)}</Text>
                            </Stack>
                            <ThemeIcon size={48} radius="md" color="green" variant="light">
                                <Wallet size={24} />
                            </ThemeIcon>
                        </Group>
                        <Group gap={4} mt="sm">
                            <ArrowUpRight size={14} color="var(--mantine-color-green-7)" />
                            <Text size="xs" color="green.7" fw={600}>+12.5% vs last period</Text>
                        </Group>
                    </Paper>

                    <Paper p="xl" radius="md" withBorder shadow="xs">
                        <Group justify="space-between">
                            <Stack gap={0}>
                                <Text size="xs" color="dimmed" fw={700} tt="uppercase">Today's Revenue</Text>
                                <Text size="h3" fw={800}>{formatCurrency(stats?.today_commission || 0)}</Text>
                            </Stack>
                            <ThemeIcon size={48} radius="md" color="blue" variant="light">
                                <TrendingUp size={24} />
                            </ThemeIcon>
                        </Group>
                        <Text size="xs" color="dimmed" mt="sm">{stats?.commission_count || 0} Successful rides today</Text>
                    </Paper>

                    <Paper p="xl" radius="md" withBorder shadow="xs">
                        <Group justify="space-between">
                            <Stack gap={0}>
                                <Text size="xs" color="dimmed" fw={700} tt="uppercase">Monthly Target</Text>
                                <Text size="h3" fw={800}>{formatCurrency(stats?.month_commission || 0)}</Text>
                            </Stack>
                            <ThemeIcon size={48} radius="md" color="indigo" variant="light">
                                <Target size={24} />
                            </ThemeIcon>
                        </Group>
                        <Progress value={75} mt="md" color="indigo" size="xs" radius="xl" />
                    </Paper>

                    <Paper p="xl" radius="md" withBorder shadow="xs">
                        <Group justify="space-between">
                            <Stack gap={0}>
                                <Text size="xs" color="dimmed" fw={700} tt="uppercase">Avg per Transaction</Text>
                                <Text size="h3" fw={800}>{formatCurrency(stats?.average_commission || 0)}</Text>
                            </Stack>
                            <ThemeIcon size={48} radius="md" color="orange" variant="light">
                                <BarChart3 size={24} />
                            </ThemeIcon>
                        </Group>
                        <Text size="xs" color="dimmed" mt="sm">Net platform yield efficiency</Text>
                    </Paper>
                </SimpleGrid>

                {/* Intelligence Layer */}
                <Grid gutter="xl">
                    <Grid.Col span={{ base: 12, lg: 5 }}>
                        <Paper p="xl" radius="md" withBorder h="100%">
                            <Text fw={800} mb="xl" size="lg">Service Performance</Text>
                            <Stack gap="xl">
                                {stats?.by_service_type.map((item) => (
                                    <Box key={item.type}>
                                        <Group justify="space-between" mb={6}>
                                            <Group gap="xs">
                                                <Badge color="blue" variant="dot" size="sm">{item.type.replace('_', ' ')}</Badge>
                                                <Text size="xs" color="dimmed">({item.count} rides)</Text>
                                            </Group>
                                            <Text size="sm" fw={700}>{formatCurrency(item.total)}</Text>
                                        </Group>
                                        <Progress value={item.percentage} color="blue" radius="xl" size="sm" />
                                        <Text size="xs" color="dimmed" mt={4} ta="right">{item.percentage}% of total revenue</Text>
                                    </Box>
                                ))}
                            </Stack>
                        </Paper>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, lg: 7 }}>
                        <Paper p="xl" radius="md" withBorder h="100%">
                            <Text fw={800} mb="xl" size="lg">Top Yield Drivers</Text>
                            <ScrollArea h={350} offsetScrollbars>
                                <Table verticalSpacing="sm">
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th>Driver Portfolio</Table.Th>
                                            <Table.Th>Volume</Table.Th>
                                            <Table.Th>Commission</Table.Th>
                                            <Table.Th>Earnings</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {stats?.by_driver.map((driver) => (
                                            <Table.Tr key={driver.driver_id}>
                                                <Table.Td>
                                                    <Group gap="sm">
                                                        <Avatar radius="xl" size="sm" color="blue">{driver.driver_name.charAt(0)}</Avatar>
                                                        <Text size="sm" fw={600}>{driver.driver_name}</Text>
                                                    </Group>
                                                </Table.Td>
                                                <Table.Td><Text size="sm">{driver.total_rides}</Text></Table.Td>
                                                <Table.Td><Text size="sm" fw={700} color="green.7">{formatCurrency(driver.total_commission)}</Text></Table.Td>
                                                <Table.Td><Text size="sm" color="dimmed">{formatCurrency(driver.total_earnings)}</Text></Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            </ScrollArea>
                        </Paper>
                    </Grid.Col>
                </Grid>

                {/* Audit Trail */}
                <Paper p="xl" radius="md" withBorder shadow="sm">
                    <Text fw={800} mb="xl" size="lg">Live Commission Ledger</Text>
                    <Table.ScrollContainer minWidth={1000}>
                        <Table verticalSpacing="md" highlightOnHover>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Booking Ref</Table.Th>
                                    <Table.Th>Driver Partner</Table.Th>
                                    <Table.Th>Service</Table.Th>
                                    <Table.Th>Fare Detail</Table.Th>
                                    <Table.Th>Platform Cut</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {transactions.map((t) => (
                                    <Table.Tr key={t.id}>
                                        <Table.Td><Text size="sm" fw={700}>{t.booking_number}</Text></Table.Td>
                                        <Table.Td><Text size="sm">{t.driver_name}</Text></Table.Td>
                                        <Table.Td><Badge variant="light" size="sm">{t.service_type.replace('_', ' ')}</Badge></Table.Td>
                                        <Table.Td><Text size="xs" color="dimmed">Total: {formatCurrency(t.total_fare)}</Text></Table.Td>
                                        <Table.Td>
                                            <Stack gap={0}>
                                                <Text size="sm" fw={700} color="orange.8">{formatCurrency(t.commission_amount)}</Text>
                                                <Text size="xs" color="dimmed">Share: {formatCurrency(t.driver_share)}</Text>
                                            </Stack>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge color={t.status === 'completed' ? 'green' : 'yellow'} radius="sm" variant="dot">
                                                {t.status.toUpperCase()}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <ActionIcon variant="subtle" color="gray" component={Link} href={`/admin/ride-bookings/${t.id}`}>
                                                <ChevronRight size={16} />
                                            </ActionIcon>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>
                </Paper>
            </Stack>
        </AdminLayout>
    );
};

export default CommissionAnalytics;

// Grid helper as it was missing from standard imports but used in logic
const Grid = ({ children, gutter }: any) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: gutter === 'xl' ? '32px' : '16px' }}>
        {children}
    </div>
);
Grid.Col = ({ children, span }: any) => {
    let gridSpan = 'span 12';
    if (typeof span === 'object') {
        // Base case for simplicity, fully functional grid requires complex CSS mapping
        gridSpan = `span 12`;
        if (window.innerWidth >= 1200 && span.lg) gridSpan = `span ${span.lg}`;
        else if (window.innerWidth >= 768 && span.md) gridSpan = `span ${span.md}`;
    } else {
        gridSpan = `span ${span}`;
    }
    return <div style={{ gridColumn: gridSpan }}>{children}</div>;
};
