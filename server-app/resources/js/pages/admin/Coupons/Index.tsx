import AdminLayout from '@/layouts/AdminLayout';
import { router, useForm } from '@inertiajs/react';
import React from 'react';
import {
    ActionIcon, Badge, Button, Card, Checkbox, Group, Modal, NumberInput, Paper,
    Select, SimpleGrid, Stack, Switch, Table, Text, TextInput, Textarea, ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Edit3, Pause, Play, Plus, ReceiptText, Tags, TicketPercent, WalletCards } from 'lucide-react';

type ServiceType = 'ride' | 'tour' | 'rental';
type Coupon = {
    id: number; code: string; name: string; description: string | null;
    discount_type: 'fixed' | 'percent'; discount_value: string;
    max_discount_amount: string | null; min_order_amount: string;
    service_types: ServiceType[]; usage_limit: number | null; per_customer_limit: number;
    used_count: number; starts_at: string | null; ends_at: string | null; is_active: boolean;
    redemptions_count: number; redemptions_sum_discount_amount: string | null;
};
type Redemption = {
    id: number; service_type: ServiceType; subtotal_amount: string; discount_amount: string;
    final_amount: string; redeemed_at: string; redeemable_id: number | null;
    coupon: { code: string; name: string }; customer: { name: string; phone: string };
};

interface Props {
    title: string;
    coupons: Coupon[];
    summary: { total: number; active: number; redemptions: number; discount_granted: number };
    recentRedemptions: Redemption[];
}

const initialForm = {
    code: '', name: '', description: '', discount_type: 'percent' as 'fixed' | 'percent',
    discount_value: 10, max_discount_amount: '' as string | number, min_order_amount: 0,
    service_types: ['ride', 'tour', 'rental'] as ServiceType[], usage_limit: '' as string | number,
    per_customer_limit: 1, starts_at: '', ends_at: '', is_active: true,
};

const dateInput = (value: string | null) => value ? value.slice(0, 16) : '';
const money = (value: number | string) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function CouponIndex({ title, coupons, summary, recentRedemptions }: Props) {
    const [opened, { open, close }] = useDisclosure(false);
    const [editing, setEditing] = React.useState<Coupon | null>(null);
    const form = useForm(initialForm);

    const openCreate = () => { setEditing(null); form.setData(initialForm); form.clearErrors(); open(); };
    const openEdit = (coupon: Coupon) => {
        setEditing(coupon);
        form.setData({
            code: coupon.code, name: coupon.name, description: coupon.description || '',
            discount_type: coupon.discount_type, discount_value: Number(coupon.discount_value),
            max_discount_amount: coupon.max_discount_amount || '', min_order_amount: Number(coupon.min_order_amount),
            service_types: coupon.service_types || [], usage_limit: coupon.usage_limit ?? '',
            per_customer_limit: coupon.per_customer_limit, starts_at: dateInput(coupon.starts_at),
            ends_at: dateInput(coupon.ends_at), is_active: coupon.is_active,
        });
        form.clearErrors(); open();
    };
    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => close() };
        if (editing) {
            form.put(`/admin/coupons/${editing.id}`, options);
        } else {
            form.post('/admin/coupons', options);
        }
    };
    const toggleService = (service: ServiceType, checked: boolean) => form.setData(
        'service_types', checked ? [...form.data.service_types, service] : form.data.service_types.filter(item => item !== service),
    );

    const cards = [
        ['Total offers', summary.total, Tags], ['Active now', summary.active, TicketPercent],
        ['Redemptions', summary.redemptions, ReceiptText], ['Discount granted', money(summary.discount_granted), WalletCards],
    ] as const;

    return <AdminLayout title={title}>
        <Stack gap="lg">
            <Group justify="space-between">
                <div><Text c="dimmed" size="sm">Create offers and control customer eligibility from one independent module.</Text></div>
                <Button leftSection={<Plus size={16} />} color="yellow" c="dark" onClick={openCreate}>New coupon</Button>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                {cards.map(([label, value, Icon]) => <Card key={label} bg="#111" withBorder style={{ borderColor: 'rgba(255,255,255,.08)' }}>
                    <Group justify="space-between"><div><Text size="xs" c="dimmed" tt="uppercase">{label}</Text><Text size="xl" fw={700} c="white">{value}</Text></div><ThemeIcon color="yellow" variant="light"><Icon size={18} /></ThemeIcon></Group>
                </Card>)}
            </SimpleGrid>
            <Paper bg="#111" withBorder p="md" style={{ borderColor: 'rgba(255,255,255,.08)', overflowX: 'auto' }}>
                <Table verticalSpacing="md" highlightOnHover>
                    <Table.Thead><Table.Tr><Table.Th>Offer</Table.Th><Table.Th>Benefit</Table.Th><Table.Th>Applies to</Table.Th><Table.Th>Usage</Table.Th><Table.Th>Validity</Table.Th><Table.Th>Status</Table.Th><Table.Th /></Table.Tr></Table.Thead>
                    <Table.Tbody>{coupons.map(coupon => <Table.Tr key={coupon.id}>
                        <Table.Td><Text fw={700} c="yellow">{coupon.code}</Text><Text size="xs" c="dimmed">{coupon.name}</Text></Table.Td>
                        <Table.Td>{coupon.discount_type === 'percent' ? `${Number(coupon.discount_value)}%` : money(coupon.discount_value)}{coupon.max_discount_amount && <Text size="xs" c="dimmed">Cap {money(coupon.max_discount_amount)}</Text>}</Table.Td>
                        <Table.Td><Group gap={4}>{coupon.service_types.map(type => <Badge key={type} variant="light" color="gray">{type}</Badge>)}</Group></Table.Td>
                        <Table.Td><Text size="sm">{coupon.redemptions_count}{coupon.usage_limit ? ` / ${coupon.usage_limit}` : ''}</Text><Text size="xs" c="dimmed">{money(coupon.redemptions_sum_discount_amount || 0)} granted</Text></Table.Td>
                        <Table.Td><Text size="xs">{coupon.starts_at ? new Date(coupon.starts_at).toLocaleDateString() : 'Immediately'} — {coupon.ends_at ? new Date(coupon.ends_at).toLocaleDateString() : 'No expiry'}</Text></Table.Td>
                        <Table.Td><Badge color={coupon.is_active ? 'green' : 'gray'}>{coupon.is_active ? 'Active' : 'Paused'}</Badge></Table.Td>
                        <Table.Td><Group gap={4} wrap="nowrap"><ActionIcon variant="subtle" onClick={() => openEdit(coupon)} aria-label="Edit coupon"><Edit3 size={16} /></ActionIcon><ActionIcon color={coupon.is_active ? 'orange' : 'green'} variant="subtle" aria-label={coupon.is_active ? 'Pause coupon' : 'Activate coupon'} onClick={() => router.patch(`/admin/coupons/${coupon.id}/toggle`, {}, { preserveScroll: true })}>{coupon.is_active ? <Pause size={16} /> : <Play size={16} />}</ActionIcon></Group></Table.Td>
                    </Table.Tr>)}</Table.Tbody>
                </Table>
                {!coupons.length && <Text ta="center" c="dimmed" py="xl">No coupons yet. Create the first customer offer.</Text>}
            </Paper>
            <Paper bg="#111" withBorder p="md" style={{ borderColor: 'rgba(255,255,255,.08)', overflowX: 'auto' }}>
                <Text fw={700} c="white" mb="md">Recent customer redemptions</Text>
                <Table verticalSpacing="sm" highlightOnHover>
                    <Table.Thead><Table.Tr><Table.Th>Customer</Table.Th><Table.Th>Coupon</Table.Th><Table.Th>Service</Table.Th><Table.Th>Booking</Table.Th><Table.Th>Discount</Table.Th><Table.Th>Final total</Table.Th><Table.Th>Used at</Table.Th></Table.Tr></Table.Thead>
                    <Table.Tbody>{recentRedemptions.map(item => <Table.Tr key={item.id}>
                        <Table.Td><Text size="sm" fw={600}>{item.customer?.name ?? 'Customer'}</Text><Text size="xs" c="dimmed">{item.customer?.phone}</Text></Table.Td>
                        <Table.Td><Badge color="yellow" variant="light">{item.coupon?.code}</Badge></Table.Td>
                        <Table.Td tt="capitalize">{item.service_type}</Table.Td><Table.Td>#{item.redeemable_id ?? '—'}</Table.Td>
                        <Table.Td c="green">−{money(item.discount_amount)}</Table.Td><Table.Td>{money(item.final_amount)}</Table.Td>
                        <Table.Td><Text size="xs">{new Date(item.redeemed_at).toLocaleString()}</Text></Table.Td>
                    </Table.Tr>)}</Table.Tbody>
                </Table>
                {!recentRedemptions.length && <Text ta="center" c="dimmed" py="xl">No coupon redemptions recorded yet.</Text>}
            </Paper>
        </Stack>

        <Modal opened={opened} onClose={close} title={editing ? 'Edit coupon' : 'Create coupon'} size="lg" centered>
            <form onSubmit={submit}><Stack>
                <SimpleGrid cols={{ base: 1, sm: 2 }}><TextInput label="Coupon code" required value={form.data.code} onChange={e => form.setData('code', e.currentTarget.value.toUpperCase())} error={form.errors.code} /><TextInput label="Offer name" required value={form.data.name} onChange={e => form.setData('name', e.currentTarget.value)} error={form.errors.name} /></SimpleGrid>
                <Textarea label="Description" value={form.data.description} onChange={e => form.setData('description', e.currentTarget.value)} error={form.errors.description} />
                <SimpleGrid cols={{ base: 1, sm: 2 }}><Select label="Discount type" data={[{ value: 'percent', label: 'Percentage' }, { value: 'fixed', label: 'Fixed amount' }]} value={form.data.discount_type} onChange={value => form.setData('discount_type', value as 'fixed' | 'percent')} /><NumberInput label={form.data.discount_type === 'percent' ? 'Discount (%)' : 'Discount amount (₹)'} required min={0.01} max={form.data.discount_type === 'percent' ? 100 : undefined} value={form.data.discount_value} onChange={value => form.setData('discount_value', Number(value))} error={form.errors.discount_value} /></SimpleGrid>
                <SimpleGrid cols={{ base: 1, sm: 2 }}><NumberInput label="Maximum discount (optional)" min={0} value={form.data.max_discount_amount} onChange={value => form.setData('max_discount_amount', value as string)} error={form.errors.max_discount_amount} /><NumberInput label="Minimum order" min={0} value={form.data.min_order_amount} onChange={value => form.setData('min_order_amount', Number(value))} error={form.errors.min_order_amount} /></SimpleGrid>
                <div><Text size="sm" fw={500} mb={6}>Services</Text><Group>{(['ride', 'tour', 'rental'] as ServiceType[]).map(service => <Checkbox key={service} label={service[0].toUpperCase() + service.slice(1)} checked={form.data.service_types.includes(service)} onChange={event => toggleService(service, event.currentTarget.checked)} />)}</Group>{form.errors.service_types && <Text c="red" size="xs">{form.errors.service_types}</Text>}</div>
                <SimpleGrid cols={{ base: 1, sm: 2 }}><NumberInput label="Global usage limit (optional)" min={1} value={form.data.usage_limit} onChange={value => form.setData('usage_limit', value as string)} error={form.errors.usage_limit} /><NumberInput label="Uses per customer" min={1} required value={form.data.per_customer_limit} onChange={value => form.setData('per_customer_limit', Number(value))} error={form.errors.per_customer_limit} /></SimpleGrid>
                <SimpleGrid cols={{ base: 1, sm: 2 }}><TextInput type="datetime-local" label="Starts at (optional)" value={form.data.starts_at} onChange={e => form.setData('starts_at', e.currentTarget.value)} error={form.errors.starts_at} /><TextInput type="datetime-local" label="Ends at (optional)" value={form.data.ends_at} onChange={e => form.setData('ends_at', e.currentTarget.value)} error={form.errors.ends_at} /></SimpleGrid>
                <Switch label="Active and available to customers" checked={form.data.is_active} onChange={e => form.setData('is_active', e.currentTarget.checked)} />
                <Group justify="flex-end"><Button variant="default" onClick={close}>Cancel</Button><Button type="submit" color="yellow" c="dark" loading={form.processing}>{editing ? 'Save changes' : 'Create coupon'}</Button></Group>
            </Stack></form>
        </Modal>
    </AdminLayout>;
}
