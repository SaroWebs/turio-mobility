import React from 'react';
import { Head, useForm } from '@inertiajs/react';
import AdminLayout from '../../layouts/AdminLayout';
import { 
    Paper, 
    Stack, 
    TextInput, 
    Textarea, 
    Button, 
    Group, 
    Text, 
    Divider, 
    Tabs, 
    rem,
    SimpleGrid,
    Box,
    ThemeIcon
} from '@mantine/core';
import { 
    Settings as SettingsIcon, 
    Globe, 
    Mail, 
    Phone, 
    MapPin, 
    Facebook, 
    Twitter, 
    Instagram, 
    Save, 
    Database, 
    Bell, 
    ShieldCheck
} from 'lucide-react';

interface SettingsProps {
    title: string;
    settings?: {
        site_name?: string;
        site_description?: string;
        contact_email?: string;
        contact_phone?: string;
        address?: string;
        social_links?: {
            facebook?: string;
            twitter?: string;
            instagram?: string;
        };
    };
}

export default function Settings({ title, settings = {} }: SettingsProps) {
    const { data, setData, post, processing, errors } = useForm({
        site_name: settings.site_name || '',
        site_description: settings.site_description || '',
        contact_email: settings.contact_email || '',
        contact_phone: settings.contact_phone || '',
        address: settings.address || '',
        facebook_url: settings.social_links?.facebook || '',
        twitter_url: settings.social_links?.twitter || '',
        instagram_url: settings.social_links?.instagram || '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/settings');
    };

    const iconStyle = { width: rem(14), height: rem(14) };

    return (
        <AdminLayout title={title}>
            <Head title="System Settings" />

            <Stack gap="lg" maw={1000} mx="auto">
                <Paper p="xl" radius="md" withBorder shadow="sm">
                    <Stack gap="xs" mb="xl">
                        <Group gap="sm">
                            <ThemeIcon variant="light" color="blue" size="lg" radius="md">
                                <SettingsIcon size={20} />
                            </ThemeIcon>
                            <Text size="xl" fw={800}>Administrative Settings</Text>
                        </Group>
                        <Text size="sm" color="dimmed">Configure your platform core parameters, contact info, and integrations.</Text>
                    </Stack>

                    <form onSubmit={handleSubmit}>
                        <Tabs defaultValue="general" variant="outline" radius="md">
                            <Tabs.List mb="xl">
                                <Tabs.Tab value="general" leftSection={<Globe style={iconStyle} />}>General Information</Tabs.Tab>
                                <Tabs.Tab value="contact" leftSection={<Mail style={iconStyle} />}>Contact & Location</Tabs.Tab>
                                <Tabs.Tab value="social" leftSection={<Facebook style={iconStyle} />}>Social Media</Tabs.Tab>
                                <Tabs.Tab value="notifications" leftSection={<Bell style={iconStyle} />} disabled>Notifications</Tabs.Tab>
                            </Tabs.List>

                            <Tabs.Panel value="general">
                                <Stack gap="lg">
                                    <TextInput
                                        label="Platform Name"
                                        placeholder="Turiya Mobility"
                                        required
                                        value={data.site_name}
                                        onChange={(e) => setData('site_name', e.currentTarget.value)}
                                        error={errors.site_name}
                                        radius="md"
                                    />
                                    <Textarea
                                        label="Platform Description"
                                        placeholder="A brief tagline or description for your platform..."
                                        rows={4}
                                        value={data.site_description}
                                        onChange={(e) => setData('site_description', e.currentTarget.value)}
                                        error={errors.site_description}
                                        radius="md"
                                    />
                                </Stack>
                            </Tabs.Panel>

                            <Tabs.Panel value="contact">
                                <Stack gap="lg">
                                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                                        <TextInput
                                            label="Support Email"
                                            placeholder="support@skyslope.com"
                                            leftSection={<Mail size={16} color="gray" />}
                                            value={data.contact_email}
                                            onChange={(e) => setData('contact_email', e.currentTarget.value)}
                                            error={errors.contact_email}
                                            radius="md"
                                        />
                                        <TextInput
                                            label="Support Phone"
                                            placeholder="+91 XXXXX XXXXX"
                                            leftSection={<Phone size={16} color="gray" />}
                                            value={data.contact_phone}
                                            onChange={(e) => setData('contact_phone', e.currentTarget.value)}
                                            error={errors.contact_phone}
                                            radius="md"
                                        />
                                    </SimpleGrid>
                                    <TextInput
                                        label="Business Address"
                                        placeholder="123 Tourism Way, Guwahati, Assam"
                                        leftSection={<MapPin size={16} color="gray" />}
                                        value={data.address}
                                        onChange={(e) => setData('address', e.currentTarget.value)}
                                        error={errors.address}
                                        radius="md"
                                    />
                                </Stack>
                            </Tabs.Panel>

                            <Tabs.Panel value="social">
                                <Stack gap="lg">
                                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                                        <TextInput
                                            label="Facebook Page"
                                            placeholder="https://facebook.com/skyslope"
                                            leftSection={<Facebook size={16} color="#1877F2" />}
                                            value={data.facebook_url}
                                            onChange={(e) => setData('facebook_url', e.currentTarget.value)}
                                            error={errors.facebook_url}
                                            radius="md"
                                        />
                                        <TextInput
                                            label="Twitter / X Profile"
                                            placeholder="https://twitter.com/skyslope"
                                            leftSection={<Twitter size={16} color="#1DA1F2" />}
                                            value={data.twitter_url}
                                            onChange={(e) => setData('twitter_url', e.currentTarget.value)}
                                            error={errors.twitter_url}
                                            radius="md"
                                        />
                                    </SimpleGrid>
                                    <TextInput
                                        label="Instagram Profile"
                                        placeholder="https://instagram.com/skyslope"
                                        leftSection={<Instagram size={16} color="#E4405F" />}
                                        value={data.instagram_url}
                                        onChange={(e) => setData('instagram_url', e.currentTarget.value)}
                                        error={errors.instagram_url}
                                        radius="md"
                                    />
                                </Stack>
                            </Tabs.Panel>
                        </Tabs>

                        <Divider my="xl" />

                        <Group justify="flex-end">
                            <Button 
                                type="submit" 
                                color="blue" 
                                size="md" 
                                radius="md" 
                                leftSection={<Save size={18} />}
                                loading={processing}
                            >
                                Save Changes
                            </Button>
                        </Group>
                    </form>
                </Paper>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                    <Paper p="lg" radius="md" withBorder shadow="xs">
                        <Group mb="md">
                            <ThemeIcon variant="light" color="teal">
                                <Database size={18} />
                            </ThemeIcon>
                            <Text fw={700}>System Health</Text>
                        </Group>
                        <Text size="sm" color="dimmed">Database connection is active. All migrations are up to date.</Text>
                    </Paper>
                    <Paper p="lg" radius="md" withBorder shadow="xs">
                        <Group mb="md">
                            <ThemeIcon variant="light" color="indigo">
                                <ShieldCheck size={18} />
                            </ThemeIcon>
                            <Text fw={700}>Security</Text>
                        </Group>
                        <Text size="sm" color="dimmed">Two-factor authentication is enforced for all administrative accounts.</Text>
                    </Paper>
                </SimpleGrid>
            </Stack>
        </AdminLayout>
    );
}
