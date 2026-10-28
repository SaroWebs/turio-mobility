import React, { useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import AdminLayout from '../../layouts/AdminLayout';
import { 
    Table, 
    Badge, 
    Text, 
    Group, 
    ActionIcon, 
    TextInput, 
    Button, 
    Paper, 
    Pagination, 
    Select, 
    Avatar,
    Menu,
    Tooltip,
    Stack,
    Indicator,
    Modal,
    Checkbox,
    Divider,
    SimpleGrid
} from '@mantine/core';
import { 
    Search, 
    MoreVertical, 
    Eye, 
    Check, 
    Ban,
    ShieldCheck,
    MapPin,
    Phone,
    UserPlus,
    Star,
    Pencil,
    RotateCcw,
    Trash2
} from 'lucide-react';

interface Driver {
    id: number;
    name: string;
    email: string | null;
    phone: string;
    status: 'pending' | 'active' | 'suspended' | 'rejected';
    vehicle_number: string | null;
    vehicle_type: string | null;
    vehicle_model?: string | null;
    vehicle_color?: string | null;
    vehicle_year?: number | null;
    vehicle?: {
        id: number;
        registration_number: string;
        make: string;
        model: string;
        category?: { name: string } | null;
    } | null;
    date_of_birth?: string | null;
    gender?: 'male' | 'female' | 'other' | null;
    license_number?: string | null;
    license_expiry?: string | null;
    can_short_ride?: boolean;
    can_long_ride?: boolean;
    can_tour_lead?: boolean;
    can_tour_transport?: boolean;
    can_rental_delivery?: boolean;
    assigned_ride_bookings_count: number;
    average_rating: number | null;
    ratings_count: number;
    created_at: string;
    deleted_at?: string | null;
    driver_availability?: {
        is_online: boolean;
        is_available: boolean;
        current_lat: number;
        current_lng: number;
        last_ping: string;
    };
}

type DriverForm = {
    name: string;
    email: string;
    phone: string;
    date_of_birth: string;
    gender: string;
    license_number: string;
    license_expiry: string;
    vehicle_type: string;
    vehicle_number: string;
    vehicle_model: string;
    vehicle_color: string;
    vehicle_year: string;
    vehicle_id: string;
    status: 'pending' | 'active' | 'suspended' | 'rejected';
    can_short_ride: boolean;
    can_long_ride: boolean;
    can_tour_lead: boolean;
    can_tour_transport: boolean;
    can_rental_delivery: boolean;
};

const emptyDriverForm: DriverForm = {
    name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    license_number: '',
    license_expiry: '',
    vehicle_type: '',
    vehicle_number: '',
    vehicle_model: '',
    vehicle_color: '',
    vehicle_year: '',
    vehicle_id: '',
    status: 'pending',
    can_short_ride: true,
    can_long_ride: true,
    can_tour_lead: false,
    can_tour_transport: false,
    can_rental_delivery: false,
};

interface DriversProps {
    title: string;
    drivers: {
        data: Driver[];
        current_page: number;
        last_page: number;
        total: number;
    };
    filters: {
        search: string;
        status: string;
        deleted: boolean;
    };
    vehicles: Array<{
        id: number;
        driver_id: number | null;
        registration_number: string;
        make: string;
        model: string;
        driver?: { id: number; name: string } | null;
    }>;
}

export default function Drivers({ title, drivers, filters, vehicles }: DriversProps) {
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || '');
    const [deleted, setDeleted] = useState(Boolean(filters.deleted));
    const [formOpened, setFormOpened] = useState(false);
    const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
    const form = useForm<DriverForm>({ ...emptyDriverForm });

    const handleSearch = (value: string) => {
        setSearch(value);
        router.get('/admin/drivers', { search: value, status, deleted }, { preserveState: true, replace: true });
    };

    const handleStatusFilter = (value: string | null) => {
        setStatus(value || '');
        router.get('/admin/drivers', { search, status: value, deleted }, { preserveState: true, replace: true });
    };

    const handlePageChange = (page: number) => {
        router.get('/admin/drivers', { search, status, deleted, page }, { preserveState: true });
    };

    const toggleDeleted = () => {
        const next = !deleted;
        setDeleted(next);
        router.get('/admin/drivers', { search, status, deleted: next }, { preserveState: true, replace: true });
    };

    const deleteDriver = (driver: Driver) => {
        if (window.confirm(`Move ${driver.name} to deleted drivers? They will be signed out immediately.`)) {
            router.delete(`/admin/drivers/${driver.id}`, { preserveScroll: true });
        }
    };

    const restoreDriver = (driver: Driver) => router.post(`/admin/drivers/deleted/${driver.id}/restore`, {}, { preserveScroll: true });
    const permanentlyDeleteDriver = (driver: Driver) => {
        if (window.confirm(`Permanently delete ${driver.name}? This cannot be undone.`)) {
            router.delete(`/admin/drivers/deleted/${driver.id}/force`, { preserveScroll: true });
        }
    };

    const handleApprove = (driver: Driver) => {
        router.post(`/admin/drivers/${driver.id}/approve`, {}, { preserveScroll: true });
    };

    const handleSuspend = (driver: Driver) => {
        router.post(`/admin/drivers/${driver.id}/suspend`, {}, { preserveScroll: true });
    };

    const handleActivate = (driver: Driver) => {
        router.post(`/admin/drivers/${driver.id}/activate`, {}, { preserveScroll: true });
    };

    const openCreateForm = () => {
        setEditingDriver(null);
        form.clearErrors();
        form.setData({ ...emptyDriverForm });
        setFormOpened(true);
    };

    const openEditForm = (driver: Driver) => {
        setEditingDriver(driver);
        form.clearErrors();
        form.setData({
            name: driver.name,
            email: driver.email || '',
            phone: driver.phone,
            date_of_birth: driver.date_of_birth || '',
            gender: driver.gender || '',
            license_number: driver.license_number || '',
            license_expiry: driver.license_expiry || '',
            vehicle_type: driver.vehicle_type || '',
            vehicle_number: driver.vehicle_number || '',
            vehicle_model: driver.vehicle_model || '',
            vehicle_color: driver.vehicle_color || '',
            vehicle_year: driver.vehicle_year ? String(driver.vehicle_year) : '',
            vehicle_id: driver.vehicle?.id ? String(driver.vehicle.id) : '',
            status: driver.status,
            can_short_ride: driver.can_short_ride ?? true,
            can_long_ride: driver.can_long_ride ?? true,
            can_tour_lead: driver.can_tour_lead ?? false,
            can_tour_transport: driver.can_tour_transport ?? false,
            can_rental_delivery: driver.can_rental_delivery ?? false,
        });
        setFormOpened(true);
    };

    const closeDriverForm = () => {
        if (form.processing) return;
        setFormOpened(false);
        setEditingDriver(null);
        form.clearErrors();
    };

    const submitDriver = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setFormOpened(false);
                setEditingDriver(null);
                form.reset();
            },
        };

        if (editingDriver) {
            form.put(`/admin/drivers/${editingDriver.id}`, options);
        } else {
            form.post('/admin/drivers', options);
        }
    };

    return (
        <AdminLayout title={title}>
            <Head title="Drivers" />

            <Stack gap="lg">
                <Paper p="xl" radius="md" withBorder shadow="sm">
                    <Group justify="space-between" mb="xl">
                        <Group gap="md" style={{ flex: 1 }}>
                            <TextInput
                                placeholder="Search by name, vehicle #, or phone..."
                                leftSection={<Search size={16} />}
                                value={search}
                                onChange={(e) => handleSearch(e.currentTarget.value)}
                                style={{ flex: 1, maxWidth: 400 }}
                                radius="md"
                            />
                            <Select
                                placeholder="Status"
                                data={[
                                    { value: 'pending', label: 'Pending Approval' },
                                    { value: 'active', label: 'Active' },
                                    { value: 'suspended', label: 'Suspended' }
                                ]}
                                value={status}
                                onChange={handleStatusFilter}
                                clearable
                                radius="md"
                                style={{ width: 180 }}
                            />
                        </Group>
                        <Group gap="sm">
                            <Button variant={deleted ? 'filled' : 'light'} color="red" radius="md" leftSection={<Trash2 size={16} />} onClick={toggleDeleted}>
                                {deleted ? 'Viewing deleted' : 'Deleted drivers'}
                            </Button>
                            {!deleted && <Button color="blue" radius="md" leftSection={<UserPlus size={16} />} onClick={openCreateForm}>Add Driver</Button>}
                        </Group>
                    </Group>

                    <Table.ScrollContainer minWidth={800}>
                        <Table verticalSpacing="md" highlightOnHover>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Driver</Table.Th>
                                    <Table.Th>Vehicle Details</Table.Th>
                                    <Table.Th>Live Status</Table.Th>
                                    <Table.Th>Total Rides</Table.Th>
                                    <Table.Th>Average Rating</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {drivers.data.map((driver) => {
                                    const isOnline = driver.driver_availability?.is_online;
                                    const isAvailable = driver.driver_availability?.is_available;
                                    
                                    return (
                                        <Table.Tr key={driver.id}>
                                            <Table.Td>
                                                <Group gap="sm">
                                                    <Indicator 
                                                        color={isOnline ? 'green' : 'gray'} 
                                                        offset={4} 
                                                        position="bottom-end" 
                                                        withBorder
                                                        processing={isOnline}
                                                    >
                                                        <Avatar color="blue" radius="xl">{driver.name.charAt(0)}</Avatar>
                                                    </Indicator>
                                                    <Stack gap={0}>
                                                        <Text size="sm" fw={600}>{driver.name}</Text>
                                                        <Text size="xs" color="dimmed">{driver.phone}</Text>
                                                    </Stack>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Stack gap={0}>
                                                    <Badge variant="outline" color="gray" size="sm" mb={4}>
                                                        {driver.vehicle?.registration_number || driver.vehicle_number || 'Unassigned'}
                                                    </Badge>
                                                    <Text size="xs" color="dimmed">
                                                        {driver.vehicle ? `${driver.vehicle.make} ${driver.vehicle.model}` : driver.vehicle_type || 'No fleet vehicle'}
                                                    </Text>
                                                </Stack>
                                            </Table.Td>
                                            <Table.Td>
                                                {isOnline ? (
                                                    <Group gap={4}>
                                                        <Badge variant="dot" color={isAvailable ? 'green' : 'orange'} size="sm">
                                                            {isAvailable ? 'Available' : 'On Ride'}
                                                        </Badge>
                                                    </Group>
                                                ) : (
                                                    <Text size="xs" color="dimmed">Offline</Text>
                                                )}
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm" fw={500}>{driver.assigned_ride_bookings_count}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                {driver.average_rating !== null ? (
                                                    <Group gap={6} wrap="nowrap" aria-label={`${driver.average_rating.toFixed(1)} out of 5 from ${driver.ratings_count} ratings`}>
                                                        <Star size={16} fill="var(--mantine-color-yellow-5)" color="var(--mantine-color-yellow-6)" aria-hidden="true" />
                                                        <Text size="sm" fw={700}>{driver.average_rating.toFixed(1)}</Text>
                                                        <Text size="xs" c="dimmed">({driver.ratings_count})</Text>
                                                    </Group>
                                                ) : (
                                                    <Text size="xs" c="dimmed">No ratings</Text>
                                                )}
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge 
                                                    variant="light" 
                                                    color={
                                                        driver.status === 'active' ? 'green' : 
                                                        driver.status === 'pending' ? 'yellow' : 'red'
                                                    }
                                                    radius="sm"
                                                >
                                                    {driver.status}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap={4} justify="flex-end">
                                                    {!deleted && <Tooltip label="View Dashboard">
                                                        <ActionIcon 
                                                            variant="light" 
                                                            color="blue" 
                                                            component={Link} 
                                                            href={`/admin/drivers/${driver.id}`}
                                                        >
                                                            <Eye size={16} />
                                                        </ActionIcon>
                                                    </Tooltip>}
                                                    
                                                    <Menu shadow="md" width={200} position="bottom-end">
                                                        <Menu.Target>
                                                            <ActionIcon variant="subtle" color="gray">
                                                                <MoreVertical size={16} />
                                                            </ActionIcon>
                                                        </Menu.Target>

                                                        <Menu.Dropdown>
                                                            {deleted ? (
                                                                <>
                                                                    <Menu.Label>Deleted driver</Menu.Label>
                                                                    <Menu.Item color="green" leftSection={<RotateCcw size={14} />} onClick={() => restoreDriver(driver)}>Restore driver</Menu.Item>
                                                                    <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={() => permanentlyDeleteDriver(driver)}>Delete permanently</Menu.Item>
                                                                </>
                                                            ) : <>
                                                            <Menu.Label>Driver profile</Menu.Label>
                                                            <Menu.Item
                                                                leftSection={<Pencil size={14} />}
                                                                onClick={() => openEditForm(driver)}
                                                            >
                                                                Edit Driver
                                                            </Menu.Item>
                                                            <Menu.Divider />
                                                            <Menu.Label>Verification</Menu.Label>
                                                            {driver.status === 'pending' && (
                                                                <Menu.Item 
                                                                    color="green" 
                                                                    leftSection={<ShieldCheck size={14} />}
                                                                    onClick={() => handleApprove(driver)}
                                                                >
                                                                    Approve Driver
                                                                </Menu.Item>
                                                            )}
                                                            
                                                            <Menu.Label>Status Actions</Menu.Label>
                                                            {driver.status === 'suspended' ? (
                                                                <Menu.Item 
                                                                    color="green" 
                                                                    leftSection={<Check size={14} />}
                                                                    onClick={() => handleActivate(driver)}
                                                                >
                                                                    Activate Driver
                                                                </Menu.Item>
                                                            ) : (
                                                                <Menu.Item 
                                                                    color="red" 
                                                                    leftSection={<Ban size={14} />}
                                                                    onClick={() => handleSuspend(driver)}
                                                                >
                                                                    Suspend Driver
                                                                </Menu.Item>
                                                            )}
                                                            
                                                            <Menu.Divider />
                                                            <Menu.Item leftSection={<MapPin size={14} />}>
                                                                Track Location
                                                            </Menu.Item>
                                                            <Menu.Item leftSection={<Phone size={14} />}>
                                                                Contact Driver
                                                            </Menu.Item>
                                                            <Menu.Divider />
                                                            <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={() => deleteDriver(driver)}>
                                                                Delete Driver
                                                            </Menu.Item>
                                                            </>}
                                                        </Menu.Dropdown>
                                                    </Menu>
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>

                    <Group justify="space-between" mt="xl">
                        <Text size="sm" color="dimmed">
                            Showing {drivers.data.length} of {drivers.total} drivers
                        </Text>
                        <Pagination 
                            total={drivers.last_page} 
                            value={drivers.current_page} 
                            onChange={handlePageChange}
                            color="blue"
                            radius="md"
                        />
                    </Group>
                </Paper>
            </Stack>

            <Modal
                opened={formOpened}
                onClose={closeDriverForm}
                title={editingDriver ? `Edit ${editingDriver.name}` : 'Add driver'}
                size="xl"
                centered
                closeOnClickOutside={!form.processing}
                closeOnEscape={!form.processing}
            >
                <form onSubmit={submitDriver}>
                    <Stack gap="lg">
                        <div>
                            <Text fw={700}>Contact and identity</Text>
                            <Text size="sm" c="dimmed">Fields marked required must be completed before saving.</Text>
                        </div>
                        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                            <TextInput
                                label="Full name"
                                placeholder="Driver's legal name"
                                required
                                value={form.data.name}
                                onChange={(event) => form.setData('name', event.currentTarget.value)}
                                error={form.errors.name}
                                autoComplete="name"
                            />
                            <TextInput
                                label="Phone number"
                                placeholder="+91 98765 43210"
                                required
                                value={form.data.phone}
                                onChange={(event) => form.setData('phone', event.currentTarget.value)}
                                error={form.errors.phone}
                                type="tel"
                                autoComplete="tel"
                            />
                            <TextInput
                                label="Email address"
                                placeholder="driver@example.com"
                                value={form.data.email}
                                onChange={(event) => form.setData('email', event.currentTarget.value)}
                                error={form.errors.email}
                                type="email"
                                autoComplete="email"
                            />
                            <Select
                                label="Account status"
                                description="Active drivers are approved immediately."
                                required
                                data={[
                                    { value: 'pending', label: 'Pending approval' },
                                    { value: 'active', label: 'Active and approved' },
                                    { value: 'suspended', label: 'Suspended' },
                                    { value: 'rejected', label: 'Rejected' },
                                ]}
                                value={form.data.status}
                                onChange={(value) => form.setData('status', (value || 'pending') as DriverForm['status'])}
                                error={form.errors.status}
                                allowDeselect={false}
                            />
                            <TextInput
                                label="Date of birth"
                                type="date"
                                value={form.data.date_of_birth}
                                onChange={(event) => form.setData('date_of_birth', event.currentTarget.value)}
                                error={form.errors.date_of_birth}
                            />
                            <Select
                                label="Gender"
                                placeholder="Select gender"
                                data={[
                                    { value: 'male', label: 'Male' },
                                    { value: 'female', label: 'Female' },
                                    { value: 'other', label: 'Other' },
                                ]}
                                value={form.data.gender}
                                onChange={(value) => form.setData('gender', value || '')}
                                error={form.errors.gender}
                                clearable
                            />
                        </SimpleGrid>

                        <Divider />
                        <div>
                            <Text fw={700}>Licence and vehicle summary</Text>
                            <Text size="sm" c="dimmed">Assign an available fleet vehicle here, or manage the same relationship under Vehicles.</Text>
                        </div>
                        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                            <Select
                                label="Assigned fleet vehicle"
                                placeholder="No vehicle assigned"
                                searchable
                                clearable
                                data={vehicles
                                    .filter((vehicle) => !vehicle.driver_id || vehicle.driver_id === editingDriver?.id)
                                    .map((vehicle) => ({
                                        value: String(vehicle.id),
                                        label: `${vehicle.registration_number} · ${vehicle.make} ${vehicle.model}${vehicle.driver ? ` · ${vehicle.driver.name}` : ''}`,
                                    }))}
                                value={form.data.vehicle_id || null}
                                onChange={(value) => form.setData('vehicle_id', value || '')}
                                error={form.errors.vehicle_id}
                            />
                            <TextInput
                                label="Driving licence number"
                                value={form.data.license_number}
                                onChange={(event) => form.setData('license_number', event.currentTarget.value.toUpperCase())}
                                error={form.errors.license_number}
                            />
                            <TextInput
                                label="Licence expiry"
                                type="date"
                                value={form.data.license_expiry}
                                onChange={(event) => form.setData('license_expiry', event.currentTarget.value)}
                                error={form.errors.license_expiry}
                            />
                            <TextInput
                                label="Vehicle type"
                                placeholder="Sedan, SUV, van..."
                                value={form.data.vehicle_type}
                                onChange={(event) => form.setData('vehicle_type', event.currentTarget.value)}
                                error={form.errors.vehicle_type}
                            />
                            <TextInput
                                label="Registration number"
                                value={form.data.vehicle_number}
                                onChange={(event) => form.setData('vehicle_number', event.currentTarget.value.toUpperCase())}
                                error={form.errors.vehicle_number}
                            />
                            <TextInput
                                label="Vehicle model"
                                placeholder="Make and model"
                                value={form.data.vehicle_model}
                                onChange={(event) => form.setData('vehicle_model', event.currentTarget.value)}
                                error={form.errors.vehicle_model}
                            />
                            <TextInput
                                label="Vehicle color"
                                value={form.data.vehicle_color}
                                onChange={(event) => form.setData('vehicle_color', event.currentTarget.value)}
                                error={form.errors.vehicle_color}
                            />
                            <TextInput
                                label="Vehicle year"
                                type="number"
                                min={1980}
                                max={new Date().getFullYear() + 1}
                                value={form.data.vehicle_year}
                                onChange={(event) => form.setData('vehicle_year', event.currentTarget.value)}
                                error={form.errors.vehicle_year}
                            />
                        </SimpleGrid>

                        <Divider />
                        <div>
                            <Text fw={700}>Service capabilities</Text>
                            <Text size="sm" c="dimmed">Choose every assignment type this driver is qualified to receive.</Text>
                        </div>
                        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                            <Checkbox
                                label="Short ride bookings"
                                checked={form.data.can_short_ride}
                                onChange={(event) => form.setData('can_short_ride', event.currentTarget.checked)}
                            />
                            <Checkbox
                                label="Long ride bookings"
                                checked={form.data.can_long_ride}
                                onChange={(event) => form.setData('can_long_ride', event.currentTarget.checked)}
                            />
                            <Checkbox
                                label="Tour lead"
                                checked={form.data.can_tour_lead}
                                onChange={(event) => form.setData('can_tour_lead', event.currentTarget.checked)}
                            />
                            <Checkbox
                                label="Tour transport"
                                checked={form.data.can_tour_transport}
                                onChange={(event) => form.setData('can_tour_transport', event.currentTarget.checked)}
                            />
                            <Checkbox
                                label="Car-rental delivery"
                                checked={form.data.can_rental_delivery}
                                onChange={(event) => form.setData('can_rental_delivery', event.currentTarget.checked)}
                            />
                        </SimpleGrid>
                        {(form.errors.can_short_ride || form.errors.can_long_ride || form.errors.can_tour_lead || form.errors.can_tour_transport || form.errors.can_rental_delivery) && (
                            <Text size="sm" c="red" role="alert">Please review the service capability selections.</Text>
                        )}

                        <Group justify="flex-end" mt="sm">
                            <Button variant="default" onClick={closeDriverForm} disabled={form.processing}>
                                Cancel
                            </Button>
                            <Button type="submit" loading={form.processing}>
                                {editingDriver ? 'Save changes' : 'Create driver'}
                            </Button>
                        </Group>
                    </Stack>
                </form>
            </Modal>
        </AdminLayout>
    );
}
