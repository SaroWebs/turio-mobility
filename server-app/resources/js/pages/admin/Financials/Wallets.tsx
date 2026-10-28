import React, { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import {
    Table,
    Badge,
    Text,
    Group,
    ActionIcon,
    Button,
    Paper,
    Pagination,
    Stack,
    Modal,
    TextInput,
    NumberInput,
    Select,
    SegmentedControl,
    Collapse,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Coins, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownLeft, Settings2 } from 'lucide-react';

interface Transaction {
    id: number;
    type: 'credit' | 'debit';
    amount: number;
    balance_before: number;
    balance_after: number;
    description: string;
    created_at: string;
}

interface Wallet {
    id: number;
    owner_type: string;
    owner_id: number;
    balance: number;
    currency: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    owner?: {
        id: number;
        name: string;
        email: string;
        phone?: string;
    };
    transactions?: Transaction[];
}

interface Props {
    title: string;
    wallets: {
        data: Wallet[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: {
        owner_type: string;
    };
}

export default function WalletsIndex({ title, wallets, filters }: Props) {
    const [opened, { open, close }] = useDisclosure(false);
    const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
    const [expandedWalletId, setExpandedWalletId] = useState<number | null>(null);

    const { data, setData, post, processing, errors, reset } = useForm({
        type: 'credit',
        amount: 0,
        description: '',
    });

    const handleAdjustClick = (wallet: Wallet) => {
        setSelectedWallet(wallet);
        reset();
        open();
    };

    const handleAdjustmentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedWallet) return;

        post(`/admin/financials/wallets/${selectedWallet.id}/adjust`, {
            onSuccess: () => {
                close();
                reset();
            },
        });
    };

    const toggleExpandWallet = (walletId: number) => {
        setExpandedWalletId(expandedWalletId === walletId ? null : walletId);
    };

    const handleFilterChange = (value: string) => {
        router.get('/admin/financials/wallets', { owner_type: value }, { preserveState: true });
    };

    return (
        <AdminLayout title={title}>
            <Head title="Driver & User Wallets" />

            <Stack gap="lg">
                {/* Filters */}
                <Paper p="md" radius="md" style={{ background: '#11111199', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Group justify="space-between">
                        <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.7)' }}>Filter wallets by type:</Text>
                        <SegmentedControl
                            value={filters.owner_type}
                            onChange={handleFilterChange}
                            data={[
                                { label: 'Drivers Only', value: 'driver' },
                                { label: 'Customers Only', value: 'customer' },
                            ]}
                            styles={{
                                root: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' },
                                control: { color: 'rgba(255,255,255,0.6)' },
                            }}
                            color="yellow"
                        />
                    </Group>
                </Paper>

                {/* Wallets Table */}
                <Paper p="xl" radius="md" style={{ background: '#11111199', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Table.ScrollContainer minWidth={800}>
                        <Table verticalSpacing="md" highlightOnHover>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th style={{ width: 40 }} />
                                    <Table.Th>Owner Details</Table.Th>
                                    <Table.Th>Account Type</Table.Th>
                                    <Table.Th>Wallet Balance</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {wallets.data.map((wallet) => {
                                    const isExpanded = expandedWalletId === wallet.id;
                                    const isDriver = wallet.owner_type.includes('Driver');
                                    return (
                                        <React.Fragment key={wallet.id}>
                                            <Table.Tr>
                                                <Table.Td>
                                                    <ActionIcon
                                                        variant="subtle"
                                                        color="gray"
                                                        onClick={() => toggleExpandWallet(wallet.id)}
                                                    >
                                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                    </ActionIcon>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Stack gap={2}>
                                                        <Text size="sm" fw={700} style={{ color: 'rgba(255,255,255,0.95)' }}>
                                                            {wallet.owner?.name || 'Unknown Owner'}
                                                        </Text>
                                                        <Text size="xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                                                            {wallet.owner?.email || 'N/A'} • {wallet.owner?.phone || 'N/A'}
                                                        </Text>
                                                    </Stack>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Badge
                                                        color={isDriver ? 'teal' : 'blue'}
                                                        variant="light"
                                                    >
                                                        {isDriver ? 'DRIVER' : 'CUSTOMER'}
                                                    </Badge>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Text fw={800} size="md" style={{ color: '#fbbf24' }}>
                                                        ₹{parseFloat(wallet.balance.toString()).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </Text>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Badge
                                                        color={wallet.is_active ? 'green' : 'red'}
                                                        variant="dot"
                                                    >
                                                        {wallet.is_active ? 'Active' : 'Suspended'}
                                                    </Badge>
                                                </Table.Td>
                                                <Table.Td style={{ textAlign: 'right' }}>
                                                    <Group gap="sm" justify="flex-end">
                                                        <Button
                                                            size="xs"
                                                            variant="outline"
                                                            color="yellow"
                                                            leftSection={<Settings2 size={13} />}
                                                            onClick={() => handleAdjustClick(wallet)}
                                                        >
                                                            Manual Adjustment
                                                        </Button>
                                                    </Group>
                                                </Table.Td>
                                            </Table.Tr>

                                            {/* Transaction Details Collapse */}
                                            <Table.Tr style={{ background: 'rgba(255,255,255,0.015)' }}>
                                                <Table.Td colSpan={6} style={{ padding: 0 }}>
                                                    <Collapse in={isExpanded}>
                                                        <Paper p="lg" radius={0} style={{ background: 'transparent', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                                            <Stack gap="xs">
                                                                <Text size="xs" fw={700} style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }} tt="uppercase">
                                                                    Recent Transactions
                                                                </Text>
                                                                {wallet.transactions && wallet.transactions.length > 0 ? (
                                                                    <Table verticalSpacing="xs">
                                                                        <Table.Thead>
                                                                            <Table.Tr style={{ background: 'transparent' }}>
                                                                                <Table.Th style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Type</Table.Th>
                                                                                <Table.Th style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Amount</Table.Th>
                                                                                <Table.Th style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Balance Run</Table.Th>
                                                                                <Table.Th style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Description</Table.Th>
                                                                                <Table.Th style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Date</Table.Th>
                                                                            </Table.Tr>
                                                                        </Table.Thead>
                                                                        <Table.Tbody>
                                                                            {wallet.transactions.map((tx) => {
                                                                                const isCredit = tx.type === 'credit';
                                                                                return (
                                                                                    <Table.Tr key={tx.id} style={{ background: 'transparent' }}>
                                                                                        <Table.Td>
                                                                                            <Badge
                                                                                                size="xs"
                                                                                                color={isCredit ? 'green' : 'red'}
                                                                                                variant="light"
                                                                                                leftSection={isCredit ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
                                                                                            >
                                                                                                {tx.type.toUpperCase()}
                                                                                            </Badge>
                                                                                        </Table.Td>
                                                                                        <Table.Td>
                                                                                            <Text size="xs" fw={700} style={{ color: isCredit ? '#10b981' : '#ef4444' }}>
                                                                                                {isCredit ? '+' : '-'}₹{tx.amount}
                                                                                            </Text>
                                                                                        </Table.Td>
                                                                                        <Table.Td>
                                                                                            <Text size="11px" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                                                                                                ₹{tx.balance_before} → ₹{tx.balance_after}
                                                                                            </Text>
                                                                                        </Table.Td>
                                                                                        <Table.Td>
                                                                                            <Text size="xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{tx.description}</Text>
                                                                                        </Table.Td>
                                                                                        <Table.Td>
                                                                                            <Text size="xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                                                                                                {new Date(tx.created_at).toLocaleString()}
                                                                                            </Text>
                                                                                        </Table.Td>
                                                                                    </Table.Tr>
                                                                                );
                                                                            })}
                                                                        </Table.Tbody>
                                                                    </Table>
                                                                ) : (
                                                                    <Text size="xs" style={{ color: 'rgba(255,255,255,0.3)', padding: '10px 0' }}>
                                                                        No transaction history found for this wallet.
                                                                    </Text>
                                                                )}
                                                            </Stack>
                                                        </Paper>
                                                    </Collapse>
                                                </Table.Td>
                                            </Table.Tr>
                                        </React.Fragment>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>

                    {wallets.data.length === 0 && (
                        <Stack align="center" py={60}>
                            <Coins size={48} strokeWidth={1} style={{ color: 'rgba(255,255,255,0.2)' }} />
                            <Text mt="md" style={{ color: 'rgba(255,255,255,0.4)' }}>No wallets found.</Text>
                        </Stack>
                    )}

                    {/* Pagination */}
                    {wallets.data.length > 0 && (
                        <Group justify="space-between" mt="xl">
                            <Text size="sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                Showing {wallets.data.length} of {wallets.total} wallets
                            </Text>
                            <Pagination
                                total={wallets.last_page}
                                value={wallets.current_page}
                                onChange={(page) => router.get(window.location.pathname, { ...filters, page }, { preserveState: true })}
                                radius="md"
                                color="yellow"
                            />
                        </Group>
                    )}
                </Paper>
            </Stack>

            {/* Manual Adjustment Modal */}
            <Modal
                opened={opened}
                onClose={close}
                title={
                    <Group gap="xs">
                        <Coins size={18} style={{ color: '#fbbf24' }} />
                        <Text fw={700} style={{ color: 'rgba(255,255,255,0.9)' }}>
                            Manual Wallet Adjustment
                        </Text>
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
                {selectedWallet && (
                    <form onSubmit={handleAdjustmentSubmit}>
                        <Stack gap="md" pt="xs">
                            <Stack gap={2}>
                                <Text size="xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Adjusting balance for:</Text>
                                <Text size="sm" fw={700} style={{ color: '#fbbf24' }}>
                                    {selectedWallet.owner?.name} ({selectedWallet.owner_type.includes('Driver') ? 'Driver' : 'Customer'})
                                </Text>
                                <Text size="xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                    Current balance: ₹{selectedWallet.balance}
                                </Text>
                            </Stack>

                            <Select
                                label="Adjustment Type"
                                value={data.type}
                                onChange={(val) => setData('type', val || 'credit')}
                                data={[
                                    { value: 'credit', label: 'Credit (Add Funds)' },
                                    { value: 'debit', label: 'Debit (Subtract Funds)' },
                                ]}
                                required
                                radius="md"
                                styles={{
                                    input: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' },
                                    label: { color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
                                    dropdown: { background: '#111', border: '1px solid rgba(255,255,255,0.08)' },
                                }}
                            />

                            <NumberInput
                                label="Amount (₹)"
                                placeholder="0"
                                min={0}
                                value={data.amount}
                                onChange={(val) => {
                                    let amt = Number(val);
                                    if(isNaN(amt) || amt < 0) {
                                        setData('amount', 0);
                                    };
                                    setData('amount', amt);
                                }}
                                error={errors.amount}
                                required
                                hideControls
                                radius="md"
                                styles={{
                                    input: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' },
                                    label: { color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
                                }}
                            />

                            <TextInput
                                label="Reason / Description"
                                placeholder="e.g. Compensation for ride cancellation"
                                value={data.description}
                                onChange={(e) => setData('description', e.currentTarget.value)}
                                error={errors.description}
                                required
                                radius="md"
                                styles={{
                                    input: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' },
                                    label: { color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
                                }}
                            />

                            <Button
                                type="submit"
                                radius="md"
                                loading={processing}
                                fullWidth
                                style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)', border: 'none', color: '#000', fontWeight: 600 }}
                            >
                                Apply Adjustment
                            </Button>
                        </Stack>
                    </form>
                )}
            </Modal>
        </AdminLayout>
    );
}
