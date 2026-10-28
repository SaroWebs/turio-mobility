import React, { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import { 
    Card, 
    Badge, 
    Table, 
    Group, 
    Stack, 
    Text, 
    Paper, 
    SimpleGrid, 
    ThemeIcon, 
    Button,
    ActionIcon,
    Tooltip,
    Avatar,
    Select,
    TextInput,
    Divider,
    Progress,
    Box,
    Loader,
    ScrollArea,
    Tabs,
    rem
} from '@mantine/core';
import {
    Shield,
    Users,
    DollarSign,
    FileText,
    Eye,
    Pencil,
    Trash,
    Search,
    Filter,
    Plus,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    ArrowRight,
    TrendingUp,
    ShieldCheck,
    CreditCard
} from 'lucide-react';

interface InsurancePolicy {
    id: number;
    policy_number: string;
    user: {
        name: string;
        email: string;
    };
    insurance_type: string;
    coverage_amount: number;
    premium_amount: number;
    start_date: string;
    end_date: string;
    status: string;
    payment_status: string;
    created_at: string;
}

interface Claim {
    id: number;
    claim_number: string;
    policy: {
        policy_number: string;
        user: {
            name: string;
        };
    };
    incident_date: string;
    incident_description: string;
    claim_amount: number;
    status: string;
    approved_by?: string;
    approved_at?: string;
    created_at: string;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0
    }).format(amount);
};

const InsuranceManagement: React.FC = () => {
    const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
    const [claims, setClaims] = useState<Claim[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string | null>('policies');

    useEffect(() => {
        const fetchInsuranceData = async () => {
            try {
                // Mock data for premium design demonstration
                const mockPolicies: InsurancePolicy[] = [
                    {
                        id: 1,
                        policy_number: 'POL-2025-001',
                        user: { name: 'Rahul Sharma', email: 'rahul@example.com' },
                        insurance_type: 'Comprehensive',
                        coverage_amount: 500000,
                        premium_amount: 15000,
                        start_date: '2025-01-01',
                        end_date: '2026-01-01',
                        status: 'active',
                        payment_status: 'paid',
                        created_at: '2025-01-01T10:00:00Z'
                    },
                    {
                        id: 2,
                        policy_number: 'POL-2025-002',
                        user: { name: 'Priya Das', email: 'priya@example.com' },
                        insurance_type: 'Third Party',
                        coverage_amount: 1000000,
                        premium_amount: 8000,
                        start_date: '2024-06-01',
                        end_date: '2025-06-01',
                        status: 'expired',
                        payment_status: 'paid',
                        created_at: '2024-06-01T10:00:00Z'
                    }
                ];

                const mockClaims: Claim[] = [
                    {
                        id: 1,
                        claim_number: 'CLM-001',
                        policy: { policy_number: 'POL-2025-001', user: { name: 'Rahul Sharma' } },
                        incident_date: '2025-02-15',
                        incident_description: 'Driver side bumper scratch',
                        claim_amount: 12000,
                        status: 'pending',
                        created_at: '2025-02-15T14:30:00Z'
                    }
                ];

                setPolicies(mockPolicies);
                setClaims(mockClaims);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchInsuranceData();
    }, []);

    const stats = {
        totalPolicies: policies.length,
        activePolicies: policies.filter(p => p.status === 'active').length,
        pendingClaims: claims.filter(c => c.status === 'pending').length,
        totalPremium: policies.reduce((sum, p) => sum + p.premium_amount, 0),
    };

    if (loading) return (
        <AdminLayout title="Insurance Management">
            <Box h={400} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader size="xl" variant="dots" />
            </Box>
        </AdminLayout>
    );

    return (
        <AdminLayout title="Insurance Management">
            <Head title="Insurance Management" />

            <Stack gap="xl">
                <Group justify="space-between" align="flex-end">
                    <Stack gap={2}>
                        <Text size="h3" fw={800}>Insurance Operations</Text>
                        <Text size="sm" color="dimmed">Fleet insurance coverage, policy lifecycle, and settlement operations.</Text>
                    </Stack>
                    <Group gap="sm">
                        <Button variant="light" color="blue" leftSection={<Shield size={16} />}>Export Actuarial</Button>
                        <Button color="blue" leftSection={<Plus size={16} />}>New Policy</Button>
                    </Group>
                </Group>

                {/* Performance HUD */}
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
                    <Paper p="xl" radius="md" withBorder shadow="sm">
                        <Group justify="space-between" mb="xs">
                            <Text size="xs" color="dimmed" fw={700} tt="uppercase">Fleet Policies</Text>
                            <ThemeIcon variant="light" color="blue" size="lg">
                                <ShieldCheck size={20} />
                            </ThemeIcon>
                        </Group>
                        <Text size="h3" fw={800}>{stats.totalPolicies}</Text>
                        <Text size="xs" color="blue.7" fw={600} mt={4}>{stats.activePolicies} Enforced actively</Text>
                    </Paper>

                    <Paper p="xl" radius="md" withBorder shadow="sm">
                        <Group justify="space-between" mb="xs">
                            <Text size="xs" color="dimmed" fw={700} tt="uppercase">Premium Yield</Text>
                            <ThemeIcon variant="light" color="teal" size="lg">
                                <TrendingUp size={20} />
                            </ThemeIcon>
                        </Group>
                        <Text size="h3" fw={800}>{formatCurrency(stats.totalPremium)}</Text>
                        <Text size="xs" color="dimmed" mt={4}>Cumulative annual premium</Text>
                    </Paper>

                    <Paper p="xl" radius="md" withBorder shadow="sm">
                        <Group justify="space-between" mb="xs">
                            <Text size="xs" color="dimmed" fw={700} tt="uppercase">Open Claims</Text>
                            <ThemeIcon variant="light" color="orange" size="lg">
                                <AlertCircle size={20} />
                            </ThemeIcon>
                        </Group>
                        <Text size="h3" fw={800}>{stats.pendingClaims}</Text>
                        <Text size="xs" color="orange.7" fw={600} mt={4}>Requires administrative review</Text>
                    </Paper>

                    <Paper p="xl" radius="md" withBorder shadow="sm">
                        <Group justify="space-between" mb="xs">
                            <Text size="xs" color="dimmed" fw={700} tt="uppercase">Capital Reserve</Text>
                            <ThemeIcon variant="light" color="indigo" size="lg">
                                <CreditCard size={20} />
                            </ThemeIcon>
                        </Group>
                        <Text size="h3" fw={800}>{formatCurrency(stats.totalPremium * 0.4)}</Text>
                        <Progress value={40} mt="md" color="indigo" size="xs" />
                    </Paper>
                </SimpleGrid>

                {/* Operations Center */}
                <Paper p="xl" radius="md" withBorder shadow="md">
                    <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="md">
                        <Tabs.List mb="xl">
                            <Tabs.Tab value="policies" leftSection={<Shield size={rem(14)} />}>Policy Registry</Tabs.Tab>
                            <Tabs.Tab value="claims" leftSection={<FileText size={rem(14)} />}>Claims & Settlements</Tabs.Tab>
                            <Tabs.Tab value="analytics" leftSection={<TrendingUp size={rem(14)} />} disabled>Actuarial Analysis</Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="policies">
                            <Stack gap="md">
                                <Group justify="space-between">
                                    <TextInput 
                                        placeholder="Search policy # or subscriber name..." 
                                        leftSection={<Search size={16} />}
                                        radius="md"
                                        style={{ width: 400 }}
                                    />
                                    <Select 
                                        placeholder="Status Filter" 
                                        data={['All', 'Active', 'Expired', 'Cancelled']}
                                        radius="md"
                                    />
                                </Group>
                                
                                <Table.ScrollContainer minWidth={800}>
                                    <Table verticalSpacing="md" highlightOnHover>
                                        <Table.Thead>
                                            <Table.Tr>
                                                <Table.Th>Policy Identifier</Table.Th>
                                                <Table.Th>Enforced Entity</Table.Th>
                                                <Table.Th>Tier & Coverage</Table.Th>
                                                <Table.Th>Financials</Table.Th>
                                                <Table.Th>Operational Status</Table.Th>
                                                <Table.Th />
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {policies.map((policy) => (
                                                <Table.Tr key={policy.id}>
                                                    <Table.Td>
                                                        <Stack gap={0}>
                                                            <Text size="sm" fw={700}>{policy.policy_number}</Text>
                                                            <Text size="xs" color="dimmed">{new Date(policy.created_at).toLocaleDateString()}</Text>
                                                        </Stack>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Group gap="sm">
                                                            <Avatar src={null} radius="xl" color="blue" size="sm">
                                                                {policy.user.name.charAt(0)}
                                                            </Avatar>
                                                            <Stack gap={0}>
                                                                <Text size="sm" fw={600}>{policy.user.name}</Text>
                                                                <Text size="xs" color="dimmed">{policy.user.email}</Text>
                                                            </Stack>
                                                        </Group>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Stack gap={4}>
                                                            <Badge variant="light" size="xs">{policy.insurance_type}</Badge>
                                                            <Text size="sm" fw={700}>{formatCurrency(policy.coverage_amount)}</Text>
                                                        </Stack>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Text size="sm" fw={700} color="teal.8">{formatCurrency(policy.premium_amount)}</Text>
                                                        <Badge variant="outline" size="xs" color={policy.payment_status === 'paid' ? 'green' : 'red'}>
                                                            {policy.payment_status.toUpperCase()}
                                                        </Badge>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Badge 
                                                            color={policy.status === 'active' ? 'green' : 'red'} 
                                                            variant="dot" 
                                                            size="sm"
                                                        >
                                                            {policy.status.toUpperCase()}
                                                        </Badge>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Group gap={4} justify="flex-end">
                                                            <Tooltip label="View Terms"><ActionIcon variant="light" color="blue"><Eye size={16} /></ActionIcon></Tooltip>
                                                            <Tooltip label="Endorse Policy"><ActionIcon variant="light" color="yellow"><Pencil size={16} /></ActionIcon></Tooltip>
                                                            <Tooltip label="Void Policy"><ActionIcon variant="light" color="red"><Trash size={16} /></ActionIcon></Tooltip>
                                                        </Group>
                                                    </Table.Td>
                                                </Table.Tr>
                                            ))}
                                        </Table.Tbody>
                                    </Table>
                                </Table.ScrollContainer>
                            </Stack>
                        </Tabs.Panel>

                        <Tabs.Panel value="claims">
                            <Stack gap="md">
                                <Table.ScrollContainer minWidth={800}>
                                    <Table verticalSpacing="md">
                                        <Table.Thead>
                                            <Table.Tr>
                                                <Table.Th>Claim #</Table.Th>
                                                <Table.Th>Linked Policy</Table.Th>
                                                <Table.Th>Incident Insight</Table.Th>
                                                <Table.Th>Assessment</Table.Th>
                                                <Table.Th>State</Table.Th>
                                                <Table.Th />
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {claims.map((claim) => (
                                                <Table.Tr key={claim.id}>
                                                    <Table.Td><Text fw={700} size="sm">{claim.claim_number}</Text></Table.Td>
                                                    <Table.Td>
                                                        <Stack gap={0}>
                                                            <Text size="sm" fw={600}>{claim.policy.policy_number}</Text>
                                                            <Text size="xs" color="dimmed">{claim.policy.user.name}</Text>
                                                        </Stack>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Stack gap={4}>
                                                            <Text size="xs" fw={700} color="dimmed">{new Date(claim.incident_date).toDateString()}</Text>
                                                            <Text size="sm" lineClamp={1}>{claim.incident_description}</Text>
                                                        </Stack>
                                                    </Table.Td>
                                                    <Table.Td><Text size="sm" fw={800} color="orange.8">{formatCurrency(claim.claim_amount)}</Text></Table.Td>
                                                    <Table.Td>
                                                        <Badge color="yellow" variant="filled" size="sm">PENDING REVIEW</Badge>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Group gap="sm" justify="flex-end">
                                                            <Button size="xs" variant="filled" color="green">Approve</Button>
                                                            <Button size="xs" variant="light" color="red">Reject</Button>
                                                        </Group>
                                                    </Table.Td>
                                                </Table.Tr>
                                            ))}
                                        </Table.Tbody>
                                    </Table>
                                </Table.ScrollContainer>
                            </Stack>
                        </Tabs.Panel>
                    </Tabs>
                </Paper>
            </Stack>
        </AdminLayout>
    );
};

export default InsuranceManagement;