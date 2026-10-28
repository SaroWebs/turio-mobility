import { Head, Link } from '@inertiajs/react';
import { Badge, Box, Button, Group, Paper, Progress, SimpleGrid, Stack, Text, ThemeIcon, Timeline } from '@mantine/core';
import { ArrowLeft, CalendarDays, CarFront, IndianRupee, MapPin, Pencil, Route, Users } from 'lucide-react';
import AdminLayout from '../../../layouts/AdminLayout';
import TourBrochurePanel from '../../../components/TourBrochurePanel';

type Assignment = { id: number; role: string; status: string; driver?: { name: string; phone?: string }; vehicle?: { registration_number: string; make?: string; model?: string } };
type Schedule = { id: number; departure_date: string; return_date: string; departure_time?: string; departure_point?: string; total_seats: number; booked_seats: number; reserved_seats: number; status: string; driver_assignments?: Assignment[] };
type Itinerary = { id: number; day_index?: number; day_number: number; time?: string; title: string; details?: string; description?: string; place?: { name: string } };
type Booking = { id: number; booking_number?: string; status: string; total_price: number; created_at: string; customer?: { name: string; phone?: string } };
type Tour = {
    brochure_name?: string | null; brochure_uploaded_at?: string | null;
    id: number; title: string; short_description?: string; description?: string; region?: string; start_location?: string; end_location?: string;
    duration_days: number; duration_nights: number; min_group_size: number; max_group_size: number; price_per_person: number; child_price: number;
    discount: number; available_from?: string; available_to?: string; is_active: boolean; is_featured: boolean; difficulty: string;
    category?: { name: string }; itineraries: Itinerary[]; schedules: Schedule[]; bookings: Booking[];
};

const money = (value: number | string) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const date = (value?: string) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set';

export default function Show({ title, tour }: { title: string; tour: Tour }) {
    const assignments = tour.schedules.flatMap((schedule) => schedule.driver_assignments ?? []);
    const soldSeats = tour.schedules.reduce((sum, schedule) => sum + Number(schedule.booked_seats || 0) + Number(schedule.reserved_seats || 0), 0);
    const inventory = tour.schedules.reduce((sum, schedule) => sum + Number(schedule.total_seats || 0), 0);
    const effectivePrice = Number(tour.price_per_person) * (1 - Number(tour.discount || 0) / 100);

    return (
        <AdminLayout title={title}>
            <Head title={tour.title} />
            <Stack gap="lg">
                <Group justify="space-between" align="flex-end">
                    <Box>
                        <Group gap="xs" mb={6}><Badge variant="light">{tour.category?.name ?? 'Uncategorised'}</Badge><Badge color={tour.is_active ? 'green' : 'gray'}>{tour.is_active ? 'Published' : 'Draft'}</Badge>{tour.is_featured && <Badge color="orange">Featured</Badge>}</Group>
                        <Text size="xl" fw={900}>{tour.title}</Text>
                        <Text c="dimmed">{tour.region} · {tour.duration_days} days / {tour.duration_nights} nights · {tour.difficulty}</Text>
                    </Box>
                    <Group><Button component={Link} href="/admin/tours" variant="default" leftSection={<ArrowLeft size={16} />}>Tours</Button><Button component={Link} href={`/admin/tours/${tour.id}/edit`} leftSection={<Pencil size={16} />}>Edit package</Button></Group>
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                    <Metric icon={<IndianRupee size={18} />} label="Adult price" value={money(effectivePrice)} detail={tour.discount ? `${tour.discount}% off ${money(tour.price_per_person)}` : 'Base package price'} />
                    <Metric icon={<CalendarDays size={18} />} label="Departures" value={String(tour.schedules.length)} detail={`${date(tour.available_from)} – ${date(tour.available_to)}`} />
                    <Metric icon={<Users size={18} />} label="Seat inventory" value={`${soldSeats} / ${inventory}`} detail={`${tour.bookings.length} customer bookings`} />
                    <Metric icon={<CarFront size={18} />} label="Transport roles" value={String(assignments.length)} detail={assignments.length ? 'Assigned across departures' : 'Driver assignment required'} />
                </SimpleGrid>

                <TourBrochurePanel tour={tour} />

                <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
                    <Stack gap="lg">
                        <Paper p="xl" radius="lg" withBorder>
                            <Group justify="space-between" mb="lg"><div><Text fw={850} size="lg">Itinerary</Text><Text size="sm" c="dimmed">{tour.start_location} → {tour.end_location}</Text></div><Button component={Link} href={`/admin/tours/${tour.id}/itineraries`} variant="light" leftSection={<Route size={16} />}>Manage itinerary</Button></Group>
                            {tour.itineraries.length ? <Timeline bulletSize={28}>{tour.itineraries.map((item) => <Timeline.Item key={item.id} bullet={<MapPin size={14} />} title={`Day ${item.day_index ?? item.day_number} · ${item.title || item.place?.name}`}><Text size="xs" c="dimmed">{item.time ? `${item.time} · ` : ''}{item.place?.name}</Text><Text size="sm" mt={5}>{item.details ?? item.description}</Text></Timeline.Item>)}</Timeline> : <Empty text="No itinerary days have been added." />}
                        </Paper>

                        <Paper p="xl" radius="lg" withBorder>
                            <Text fw={850} size="lg">Package narrative</Text>
                            {tour.short_description && <Text fw={700} mt="md">{tour.short_description}</Text>}
                            <Text c="dimmed" mt="sm" style={{ whiteSpace: 'pre-wrap' }}>{tour.description || 'No description supplied.'}</Text>
                        </Paper>
                    </Stack>

                    <Stack gap="lg">
                        <Paper p="xl" radius="lg" withBorder>
                            <Group justify="space-between" mb="lg"><div><Text fw={850} size="lg">Departures & transport</Text><Text size="sm" c="dimmed">Each departure owns its seat inventory and assignment.</Text></div><Button component={Link} href={`/admin/tours/${tour.id}/schedules`} variant="light">Manage</Button></Group>
                            <Stack gap="sm">{tour.schedules.length ? tour.schedules.map((schedule) => {
                                const used = Number(schedule.booked_seats || 0) + Number(schedule.reserved_seats || 0);
                                const scheduleAssignments = schedule.driver_assignments ?? [];
                                return <Paper key={schedule.id} p="md" radius="md" bg="gray.0"><Group justify="space-between" align="flex-start"><div><Text fw={750}>{date(schedule.departure_date)} · {schedule.departure_time?.slice(0, 5)}</Text><Text size="xs" c="dimmed">{schedule.departure_point || 'Departure point not set'} · return {date(schedule.return_date)}</Text></div><Badge color={schedule.status === 'open' ? 'green' : 'gray'}>{schedule.status}</Badge></Group><Progress value={schedule.total_seats ? used / schedule.total_seats * 100 : 0} mt="md" /><Text size="xs" c="dimmed" mt={5}>{used} of {schedule.total_seats} seats held or booked</Text>{scheduleAssignments.map((assignment) => <Group key={assignment.id} mt="sm" gap="xs"><CarFront size={15} /><Text size="sm" fw={700}>{assignment.driver?.name}</Text><Text size="xs" c="dimmed">{assignment.role} · {assignment.vehicle?.registration_number ?? 'vehicle pending'}</Text></Group>)}</Paper>;
                            }) : <Empty text="No customer-bookable departure exists." />}</Stack>
                        </Paper>

                        <Paper p="xl" radius="lg" withBorder>
                            <Group justify="space-between" mb="lg"><div><Text fw={850} size="lg">Recent bookings</Text><Text size="sm" c="dimmed">Latest customer reservations for this package.</Text></div><Badge>{tour.bookings.length}</Badge></Group>
                            <Stack gap="xs">{tour.bookings.length ? tour.bookings.slice(0, 6).map((booking) => <Group key={booking.id} justify="space-between" p="sm"><div><Text size="sm" fw={700}>{booking.customer?.name ?? 'Customer'}</Text><Text size="xs" c="dimmed">{booking.booking_number ?? `Booking #${booking.id}`} · {date(booking.created_at)}</Text></div><div><Text ta="right" size="sm" fw={800}>{money(booking.total_price)}</Text><Badge size="xs" variant="light">{booking.status}</Badge></div></Group>) : <Empty text="No bookings recorded yet." />}</Stack>
                        </Paper>
                    </Stack>
                </SimpleGrid>
            </Stack>
        </AdminLayout>
    );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
    return <Paper p="lg" radius="lg" withBorder><Group align="flex-start"><ThemeIcon variant="light" radius="xl">{icon}</ThemeIcon><div><Text size="xs" c="dimmed" fw={800} tt="uppercase">{label}</Text><Text size="xl" fw={900}>{value}</Text><Text size="xs" c="dimmed">{detail}</Text></div></Group></Paper>;
}

function Empty({ text }: { text: string }) { return <Text c="dimmed" ta="center" py="xl">{text}</Text>; }
