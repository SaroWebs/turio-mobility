import React from 'react';
import { Head, Link } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import { 
    Table, 
    Text, 
    Group, 
    Paper, 
    ActionIcon,
    Stack,
    Badge,
    Grid,
    Avatar,
    Card,
    ThemeIcon,
    Title
} from '@mantine/core';
import { 
    ArrowLeft,
    Phone,
    Mail,
    Star,
    Calendar,
    Map
} from 'lucide-react';

interface Guide {
    id: number;
    name: string;
    email: string;
    phone: string;
    status: 'pending' | 'active' | 'suspended';
    rating: number;
    specialties: string[];
    languages: string[];
    created_at: string;
    tour_guide_assignments?: {
        id: number;
        status: string;
        fee: string;
        schedule: {
            departure_date: string;
            tour: {
                title: string;
            }
        }
    }[];
}

interface GuideShowProps {
    title: string;
    guide: Guide;
    stats: {
        total_tours: number;
        rating: number;
    };
}

export default function GuideShow({ title, guide, stats }: GuideShowProps) {
    return (
        <AdminLayout title={title}>
            <Head title={`Guide: ${guide.name}`} />

            <Stack gap="lg">
                <Group gap="md">
                    <ActionIcon component={Link} href="/admin/guides" variant="light" size="lg">
                        <ArrowLeft size={18} />
                    </ActionIcon>
                    <div>
                        <Text size="lg" fw={600}>Guide Details</Text>
                        <Text size="sm" color="dimmed">View all details and assignments for {guide.name}</Text>
                    </div>
                </Group>

                <Grid>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                        <Card shadow="sm" p="xl" radius="md" withBorder>
                            <Stack align="center" gap="md" mb="xl">
                                <Avatar size={120} radius={120} color="blue">{guide.name.charAt(0)}</Avatar>
                                <Stack gap={4} align="center">
                                    <Title order={3}>{guide.name}</Title>
                                    <Badge 
                                        color={
                                            guide.status === 'active' ? 'green' : 
                                            guide.status === 'pending' ? 'yellow' : 'red'
                                        }
                                    >
                                        {guide.status}
                                    </Badge>
                                </Stack>
                            </Stack>

                            <Stack gap="sm">
                                <Group wrap="nowrap">
                                    <ThemeIcon variant="light" color="gray" size="md">
                                        <Mail size={14} />
                                    </ThemeIcon>
                                    <Text size="sm">{guide.email || 'No email provided'}</Text>
                                </Group>
                                <Group wrap="nowrap">
                                    <ThemeIcon variant="light" color="gray" size="md">
                                        <Phone size={14} />
                                    </ThemeIcon>
                                    <Text size="sm">{guide.phone}</Text>
                                </Group>
                            </Stack>

                            {guide.languages && guide.languages.length > 0 && (
                                <>
                                    <Text size="sm" fw={600} mt="xl" mb="xs">Languages</Text>
                                    <Group gap="xs">
                                        {guide.languages.map((lang, idx) => (
                                            <Badge key={idx} variant="outline" size="sm">{lang}</Badge>
                                        ))}
                                    </Group>
                                </>
                            )}
                        </Card>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 8 }}>
                        <Grid mb="lg">
                            <Grid.Col span={6}>
                                <Paper p="md" radius="md" withBorder>
                                    <Group>
                                        <ThemeIcon size={40} radius="md" variant="light" color="blue">
                                            <Map size={20} />
                                        </ThemeIcon>
                                        <div>
                                            <Text size="xs" color="dimmed" tt="uppercase" fw={700}>Total Tours Hosted</Text>
                                            <Text fw={700} size="xl">{stats.total_tours || 0}</Text>
                                        </div>
                                    </Group>
                                </Paper>
                            </Grid.Col>
                            <Grid.Col span={6}>
                                <Paper p="md" radius="md" withBorder>
                                    <Group>
                                        <ThemeIcon size={40} radius="md" variant="light" color="orange">
                                            <Star size={20} />
                                        </ThemeIcon>
                                        <div>
                                            <Text size="xs" color="dimmed" tt="uppercase" fw={700}>Average Rating</Text>
                                            <Text fw={700} size="xl">{stats.rating || 'N/A'}</Text>
                                        </div>
                                    </Group>
                                </Paper>
                            </Grid.Col>
                        </Grid>

                        <Paper p="xl" radius="md" withBorder shadow="sm">
                            <Text size="lg" fw={600} mb="md">Recent Tour Assignments</Text>
                            
                            {(!guide.tour_guide_assignments || guide.tour_guide_assignments.length === 0) ? (
                                <Text size="sm" color="dimmed" fs="italic">No tours assigned yet.</Text>
                            ) : (
                                <Table.ScrollContainer minWidth={500}>
                                    <Table verticalSpacing="sm" highlightOnHover>
                                        <Table.Thead>
                                            <Table.Tr>
                                                <Table.Th>Tour</Table.Th>
                                                <Table.Th>Departure</Table.Th>
                                                <Table.Th>Fee</Table.Th>
                                                <Table.Th>Status</Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {guide.tour_guide_assignments.map((assignment) => (
                                                <Table.Tr key={assignment.id}>
                                                    <Table.Td>
                                                        <Text fw={500} size="sm">{assignment.schedule?.tour?.title}</Text>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Group gap="xs" wrap="nowrap">
                                                            <Calendar size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
                                                            <Text size="sm">{assignment.schedule?.departure_date}</Text>
                                                        </Group>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Text size="sm">₹{assignment.fee || '0.00'}</Text>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Badge 
                                                            variant="light" 
                                                            color={
                                                                assignment.status === 'completed' ? 'gray' : 
                                                                assignment.status === 'accepted' ? 'green' : 
                                                                assignment.status === 'declined' ? 'red' : 'yellow'
                                                            }
                                                        >
                                                            {assignment.status}
                                                        </Badge>
                                                    </Table.Td>
                                                </Table.Tr>
                                            ))}
                                        </Table.Tbody>
                                    </Table>
                                </Table.ScrollContainer>
                            )}
                        </Paper>
                    </Grid.Col>
                </Grid>
            </Stack>
        </AdminLayout>
    );
}
