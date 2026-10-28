import AdminLayout from '@/layouts/AdminLayout';
import { Link } from '@inertiajs/react';
import { Button, Group, Paper, Table, Text } from '@mantine/core';

type Booking = { id: number; booking_number: string; customer_name: string; customer_phone: string; number_of_adults: number; number_of_children: number; status: string };

export default function Manifest({ tour, schedule, bookings }: { tour: { id: number; title: string }; schedule: { id: number; departure_date: string }; bookings: Booking[] }) {
  return <AdminLayout title="Departure manifest">
    <Paper p="lg" radius="md">
      <Group justify="space-between" mb="lg">
        <div><Text fw={700} size="xl">{tour.title}</Text><Text>{schedule.departure_date.slice(0, 10)} · {bookings.reduce((total, booking) => total + Number(booking.number_of_adults) + Number(booking.number_of_children), 0)} travellers</Text></div>
        <Button component="a" href={`/admin/tours/${tour.id}/schedules/${schedule.id}/manifest?download=1`}>Export CSV</Button>
      </Group>
      <Text mb="md">Lead travellers and group sizes, including pending reservations. Confirmed bookings are labelled below.</Text>
      <Table.ScrollContainer minWidth={650}><Table><Table.Thead><Table.Tr>{['Booking', 'Lead traveller', 'Phone', 'Adults', 'Children', 'Status'].map(label => <Table.Th key={label}>{label}</Table.Th>)}</Table.Tr></Table.Thead><Table.Tbody>
        {bookings.map(booking => <Table.Tr key={booking.id}><Table.Td>{booking.booking_number}</Table.Td><Table.Td>{booking.customer_name}</Table.Td><Table.Td>{booking.customer_phone}</Table.Td><Table.Td>{booking.number_of_adults}</Table.Td><Table.Td>{booking.number_of_children}</Table.Td><Table.Td>{booking.status}</Table.Td></Table.Tr>)}
      </Table.Tbody></Table></Table.ScrollContainer>
      {!bookings.length && <Text>No active bookings for this departure.</Text>}
      <Button component={Link} href={`/admin/tours/${tour.id}/schedules`} variant="subtle" mt="md">Back to departures</Button>
    </Paper>
  </AdminLayout>;
}
