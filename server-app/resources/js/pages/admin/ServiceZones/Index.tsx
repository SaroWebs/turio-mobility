import { Head, router, useForm } from '@inertiajs/react';
import { Button, Group, NumberInput, Paper, SimpleGrid, Stack, Switch, Table, Text, TextInput } from '@mantine/core';
import React, { useState } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';

type Zone = {
    id: number;
    name: string;
    description?: string;
    center_lat: number;
    center_lng: number;
    radius_km: number;
    priority: number;
    is_active: boolean;
};
type ZoneFormData = Omit<Zone, 'id'>;
export default function Index({ title, zones }: { title: string; zones: Zone[] }) {
    const [editing, setEditing] = useState<number | null>(null);
    const { data, setData, post, put, processing, reset } = useForm<ZoneFormData>({
        name: '',
        description: '',
        center_lat: 0,
        center_lng: 0,
        radius_km: 10,
        priority: 0,
        is_active: true,
    });
    const edit = (zone: Zone) => {
        setEditing(zone.id);
        setData({
            name: zone.name,
            description: zone.description ?? '',
            center_lat: zone.center_lat,
            center_lng: zone.center_lng,
            radius_km: zone.radius_km,
            priority: zone.priority,
            is_active: zone.is_active,
        });
    };
    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        editing
            ? put(`/admin/service-zones/${editing}`, {
                  onSuccess: () => {
                      setEditing(null);
                      reset();
                  },
              })
            : post('/admin/service-zones', { onSuccess: () => reset() });
    };
    return (
        <AdminLayout title={title}>
            <Head title={title} />
            <Stack gap="lg">
                <Group justify="space-between">
                    <Text size="xl" fw={700}>
                        Service Zones
                    </Text>
                    <Button component="a" href="/admin/settings" variant="light">
                        Operational settings
                    </Button>
                </Group>
                <Paper p="lg" withBorder>
                    <form onSubmit={submit}>
                        <Stack>
                            <Text fw={600}>{editing ? 'Edit zone' : 'Create zone'}</Text>
                            <TextInput label="Name" required value={data.name} onChange={(e) => setData('name', e.currentTarget.value)} />
                            <TextInput label="Description" value={data.description} onChange={(e) => setData('description', e.currentTarget.value)} />
                            <SimpleGrid cols={{ base: 1, sm: 3 }}>
                                <NumberInput label="Center latitude" value={data.center_lat} onChange={(v) => setData('center_lat', Number(v))} />
                                <NumberInput label="Center longitude" value={data.center_lng} onChange={(v) => setData('center_lng', Number(v))} />
                                <NumberInput label="Radius (km)" min={0.1} value={data.radius_km} onChange={(v) => setData('radius_km', Number(v))} />
                            </SimpleGrid>
                            <Group>
                                <NumberInput label="Priority" min={0} value={data.priority} onChange={(v) => setData('priority', Number(v))} />
                                <Switch
                                    mt="xl"
                                    label="Active"
                                    checked={data.is_active}
                                    onChange={(e) => setData('is_active', e.currentTarget.checked)}
                                />
                            </Group>
                            <Group>
                                <Button type="submit" loading={processing}>
                                    {editing ? 'Update zone' : 'Create zone'}
                                </Button>
                                {editing && (
                                    <Button
                                        variant="default"
                                        onClick={() => {
                                            setEditing(null);
                                            reset();
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                )}
                            </Group>
                        </Stack>
                    </form>
                </Paper>
                <Table withTableBorder striped>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Name</Table.Th>
                            <Table.Th>Center</Table.Th>
                            <Table.Th>Radius</Table.Th>
                            <Table.Th>Actions</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {zones.map((zone) => (
                            <Table.Tr key={zone.id}>
                                <Table.Td>{zone.name}</Table.Td>
                                <Table.Td>
                                    {zone.center_lat}, {zone.center_lng}
                                </Table.Td>
                                <Table.Td>{zone.radius_km} km</Table.Td>
                                <Table.Td>
                                    <Group gap="xs">
                                        <Button size="xs" variant="light" onClick={() => edit(zone)}>
                                            Edit
                                        </Button>
                                        <Button
                                            size="xs"
                                            color="red"
                                            variant="subtle"
                                            onClick={() => router.delete(`/admin/service-zones/${zone.id}`)}
                                        >
                                            Delete
                                        </Button>
                                    </Group>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </Stack>
        </AdminLayout>
    );
}
