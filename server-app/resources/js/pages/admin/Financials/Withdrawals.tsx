import React, { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import {
    Table,
    Badge,
    Text,
    Group,
    Button,
    Paper,
    Pagination,
    Stack,
    Modal,
    TextInput,
    Textarea,
    SegmentedControl,
    SimpleGrid,
    Card,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Coins, Check, X, CreditCard, Clock, Calendar, AlertCircle } from 'lucide-react';

interface WithdrawalRequest {
    id: number;
    owner_type: string;
    owner_id: number;
    amount: number;
    method: string;
    account_details: {
        account_number?: string;
        bank?: string;
        name?: string;
        ifsc?: string;
        upi_id?: string;
    };
    status: 'pending' | 'processing' | 'approved' | 'completed' | 'rejected';
    admin_notes: string | null;
    rejection_reason: string | null;
    utr_number: string | null;
    processed_at: string | null;
    created_at: string;
    owner?: {
        id: number;
        name: string;
        email: string;
        phone?: string;
    };
}

interface Props {
    title: string;
    withdrawals: {
        data: WithdrawalRequest[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: {
        status: string;
    };
    stats: {
        pending_count: number;
        processing_count: number;
        completed_sum: number;
    };
}

export default function WithdrawalsIndex({ title, withdrawals, filters, stats }: Props) {
    const [rejectOpened, { open: openReject, close: closeReject }] = useDisclosure(false);
    const [completeOpened, { open: openComplete, close: closeComplete }] = useDisclosure(false);
    
    const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);

    const rejectForm = useForm({
        rejection_reason: '',
        admin_notes: '',
    });

    const completeForm = useForm({
        utr_number: '',
    });

    const handleFilterChange = (value: string) => {
        router.get('/admin/financials/withdrawals', { status: value }, { preserveState: true });
    };

    const handleApprove = (reqId: number) => {
        if (confirm('Approve and initiate the payout to the driver\'s account?')) {
            router.post(`/admin/financials/withdrawals/${reqId}/approve`, {}, { preserveScroll: true });
        }
    };

    const handleRejectClick = (req: WithdrawalRequest) => {
        setSelectedRequest(req);
        rejectForm.reset();
        openReject();
    };

    const handleRejectSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRequest) return;

        rejectForm.post(`/admin/financials/withdrawals/${selectedRequest.id}/reject`, {
            onSuccess: () => {
                closeReject();
                rejectForm.reset();
            },
        });
    };

    const handleCompleteClick = (req: WithdrawalRequest) => {
        setSelectedRequest(req);
        completeForm.reset();
        openComplete();
    };

    const handleCompleteSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRequest) return;

        completeForm.post(`/admin/financials/withdrawals/${selectedRequest.id}/complete`, {
            onSuccess: () => {
                closeComplete();
                completeForm.reset();
            },
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'yellow';
            case 'processing': return 'indigo';
            case 'approved': return 'blue';
            case 'completed': return 'green';
            case 'rejected': return 'red';
            default: return 'gray';
        }
    };

    return (
        <AdminLayout title={title}>
            <Head title="Payout & Withdrawal Requests" />

            <Stack gap="lg">
                {/* Stats Grid */}
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
                    <Card padding="lg" radius="md" withBorder style={{ background: '#11111199', borderColor: 'rgba(255,255,255,0.06)' }}>
                        <Stack gap={4}>
                            <Text size="xs" color="dimmed" fw={700} tt="uppercase">Pending Requests</Text>
                            <Group gap="xs">
                                <Clock size={18} color="var(--mantine-color-yellow-6)" />
                                <Text size="xl" fw={800}>{stats.pending_count} pending</Text>
                            </Group>
                        </Stack>
                    </Card>
                    <Card padding="lg" radius="md" withBorder style={{ background: '#11111199', borderColor: 'rgba(255,255,255,0.06)' }}>
                        <Stack gap={4}>
                            <Text size="xs" color="dimmed" fw={700} tt="uppercase">In Process</Text>
                            <Group gap="xs">
                                <AlertCircle size={18} color="var(--mantine-color-indigo-6)" />
                                <Text size="xl" fw={800}>{stats.processing_count} active</Text>
                            </Group>
                        </Stack>
                    </Card>
                    <Card padding="lg" radius="md" withBorder style={{ background: '#11111199', borderColor: 'rgba(255,255,255,0.06)' }}>
                        <Stack gap={4}>
                            <Text size="xs" color="dimmed" fw={700} tt="uppercase">Total Paid out</Text>
                            <Group gap="xs">
                                <Coins size={18} color="var(--mantine-color-green-6)" />
                                <Text size="xl" fw={800} style={{ color: '#10b981' }}>
                                    ₹{parseFloat(stats.completed_sum.toString()).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </Text>
                            </Group>
                        </Stack>
                    </Card>
                </SimpleGrid>

                {/* Filter Control */}
                <Paper p="md" radius="md" style={{ background: '#11111199', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Group justify="space-between">
                        <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.7)' }}>Filter requests by status:</Text>
                        <SegmentedControl
                            value={filters.status}
                            onChange={handleFilterChange}
                            data={[
                                { label: 'All', value: 'all' },
                                { label: 'Pending', value: 'pending' },
                                { label: 'Processing', value: 'processing' },
                                { label: 'Completed', value: 'completed' },
                                { label: 'Rejected', value: 'rejected' },
                            ]}
                            styles={{
                                root: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' },
                                control: { color: 'rgba(255,255,255,0.6)' },
                            }}
                            color="yellow"
                        />
                    </Group>
                </Paper>

                {/* Requests Table */}
                <Paper p="xl" radius="md" style={{ background: '#11111199', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Table.ScrollContainer minWidth={900}>
                        <Table verticalSpacing="md" highlightOnHover>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>ID</Table.Th>
                                    <Table.Th>Driver/User</Table.Th>
                                    <Table.Th>Amount</Table.Th>
                                    <Table.Th>Payout Method</Table.Th>
                                    <Table.Th>Account Details</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Submitted At</Table.Th>
                                    <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {withdrawals.data.map((req) => {
                                    const details = req.account_details || {};
                                    return (
                                        <Table.Tr key={req.id}>
                                            <Table.Td>
                                                <Text size="xs" style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }}>
                                                    #{req.id}
                                                </Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Stack gap={2}>
                                                    <Text size="sm" fw={700} style={{ color: 'rgba(255,255,255,0.95)' }}>
                                                        {req.owner?.name || 'Unknown'}
                                                    </Text>
                                                    <Text size="xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                                                        {req.owner_type.includes('Driver') ? 'Driver' : 'Customer'}
                                                    </Text>
                                                </Stack>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text fw={800} size="sm" style={{ color: '#fbbf24' }}>
                                                    ₹{parseFloat(req.amount.toString()).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge variant="outline" color="gray" size="xs">
                                                    {req.method.replace('_', ' ').toUpperCase()}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                {req.method === 'upi' ? (
                                                    <Text size="xs" style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)' }}>
                                                        UPI ID: {details.upi_id || 'N/A'}
                                                    </Text>
                                                ) : (
                                                    <Stack gap={1}>
                                                        <Text size="xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                                            {details.bank || 'N/A'} • A/C: {details.account_number || 'N/A'}
                                                        </Text>
                                                        <Text size="10px" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                                                            IFSC: {details.ifsc || 'N/A'} • Name: {details.name || 'N/A'}
                                                        </Text>
                                                    </Stack>
                                                )}
                                            </Table.Td>
                                            <Table.Td>
                                                <Stack gap={2} align="flex-start">
                                                    <Badge color={getStatusColor(req.status)} variant="filled">
                                                        {req.status.toUpperCase()}
                                                    </Badge>
                                                    {req.utr_number && (
                                                        <Text size="10px" style={{ fontFamily: 'monospace', color: 'rgba(16,185,129,0.7)' }}>
                                                            UTR: {req.utr_number}
                                                        </Text>
                                                    )}
                                                    {req.rejection_reason && (
                                                        <Text size="10px" style={{ color: 'rgba(239,68,68,0.7)' }} lineClamp={1}>
                                                            Reason: {req.rejection_reason}
                                                        </Text>
                                                    )}
                                                </Stack>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap={4} wrap="nowrap">
                                                    <Calendar size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
                                                    <Text size="xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                                                        {new Date(req.created_at).toLocaleDateString()}
                                                    </Text>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td style={{ textAlign: 'right' }}>
                                                <Group gap="xs" justify="flex-end" wrap="nowrap">
                                                    {req.status === 'pending' && (
                                                        <>
                                                            <Button
                                                                size="xs"
                                                                color="green"
                                                                variant="light"
                                                                leftSection={<Check size={12} />}
                                                                onClick={() => handleApprove(req.id)}
                                                            >
                                                                Approve
                                                            </Button>
                                                            <Button
                                                                size="xs"
                                                                color="red"
                                                                variant="light"
                                                                leftSection={<X size={12} />}
                                                                onClick={() => handleRejectClick(req)}
                                                            >
                                                                Reject
                                                            </Button>
                                                        </>
                                                    )}
                                                    {req.status === 'processing' && (
                                                        <Button
                                                            size="xs"
                                                            color="green"
                                                            variant="outline"
                                                            leftSection={<CreditCard size={12} />}
                                                            onClick={() => handleCompleteClick(req)}
                                                        >
                                                            Mark Completed
                                                        </Button>
                                                    )}
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>

                    {withdrawals.data.length === 0 && (
                        <Stack align="center" py={60}>
                            <Coins size={48} strokeWidth={1} style={{ color: 'rgba(255,255,255,0.2)' }} />
                            <Text mt="md" style={{ color: 'rgba(255,255,255,0.4)' }}>No withdrawal requests found.</Text>
                        </Stack>
                    )}

                    {/* Pagination */}
                    {withdrawals.data.length > 0 && (
                        <Group justify="space-between" mt="xl">
                            <Text size="sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                Showing {withdrawals.data.length} of {withdrawals.total} requests
                            </Text>
                            <Pagination
                                total={withdrawals.last_page}
                                value={withdrawals.current_page}
                                onChange={(page) => router.get(window.location.pathname, { ...filters, page }, { preserveState: true })}
                                radius="md"
                                color="yellow"
                            />
                        </Group>
                    )}
                </Paper>
            </Stack>

            {/* Reject Modal */}
            <Modal
                opened={rejectOpened}
                onClose={closeReject}
                title={
                    <Group gap="xs">
                        <X size={18} style={{ color: '#ef4444' }} />
                        <Text fw={700} style={{ color: 'rgba(255,255,255,0.9)' }}>
                            Reject Payout Request
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
                {selectedRequest && (
                    <form onSubmit={handleRejectSubmit}>
                        <Stack gap="md" pt="xs">
                            <Stack gap={2}>
                                <Text size="xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Rejecting payout request for:</Text>
                                <Text size="sm" fw={700} style={{ color: '#fbbf24' }}>
                                    {selectedRequest.owner?.name} (₹{selectedRequest.amount})
                                </Text>
                            </Stack>

                            <TextInput
                                label="Rejection Reason"
                                placeholder="e.g. Bank details incorrect or invalid IFSC code"
                                value={rejectForm.data.rejection_reason}
                                onChange={(e) => rejectForm.setData('rejection_reason', e.currentTarget.value)}
                                error={rejectForm.errors.rejection_reason}
                                required
                                radius="md"
                                styles={{
                                    input: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' },
                                    label: { color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
                                }}
                            />

                            <Textarea
                                label="Admin Notes"
                                placeholder="Internal logs or comments"
                                value={rejectForm.data.admin_notes}
                                onChange={(e) => rejectForm.setData('admin_notes', e.currentTarget.value)}
                                error={rejectForm.errors.admin_notes}
                                radius="md"
                                styles={{
                                    input: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' },
                                    label: { color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
                                }}
                            />

                            <Button
                                type="submit"
                                radius="md"
                                color="red"
                                loading={rejectForm.processing}
                                fullWidth
                                style={{ fontWeight: 600 }}
                            >
                                Reject & Refund Wallet
                            </Button>
                        </Stack>
                    </form>
                )}
            </Modal>

            {/* Complete Payout Modal */}
            <Modal
                opened={completeOpened}
                onClose={closeComplete}
                title={
                    <Group gap="xs">
                        <Check size={18} style={{ color: '#10b981' }} />
                        <Text fw={700} style={{ color: 'rgba(255,255,255,0.9)' }}>
                            Confirm Bank/UPI Transfer
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
                {selectedRequest && (
                    <form onSubmit={handleCompleteSubmit}>
                        <Stack gap="md" pt="xs">
                            <Stack gap={2}>
                                <Text size="xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Completing payout for:</Text>
                                <Text size="sm" fw={700} style={{ color: '#fbbf24' }}>
                                    {selectedRequest.owner?.name} (₹{selectedRequest.amount})
                                </Text>
                                <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                    Method: {selectedRequest.method.replace('_', ' ').toUpperCase()}
                                </Text>
                            </Stack>

                            <TextInput
                                label="UTR / Transaction reference ID"
                                placeholder="Enter reference ID from your bank/UPI transaction"
                                value={completeForm.data.utr_number}
                                onChange={(e) => completeForm.setData('utr_number', e.currentTarget.value)}
                                error={completeForm.errors.utr_number}
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
                                color="green"
                                loading={completeForm.processing}
                                fullWidth
                                style={{ fontWeight: 600 }}
                            >
                                Complete Request
                            </Button>
                        </Stack>
                    </form>
                )}
            </Modal>
        </AdminLayout>
    );
}
