import React, { useMemo, useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import {
    ActionIcon,
    Badge,
    Button,
    Checkbox,
    FileInput,
    Group,
    Image,
    Modal,
    NumberInput,
    Pagination,
    Paper,
    Select,
    SimpleGrid,
    Stack,
    Table,
    Text,
    TextInput,
    Textarea,
    Title,
    Tooltip,
} from '@mantine/core';
import { FileImage, Pencil, Plus, Trash2 } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';

type ContentType = 'text' | 'image' | 'url' | 'json';

interface CmsContent {
    id: number;
    app: string;
    page: string;
    section: string;
    key: string;
    type: ContentType;
    value: string | null;
    sort_order: number;
    is_active: boolean;
}

interface Props {
    contents: {
        data: CmsContent[];
        current_page: number;
        last_page: number;
        total: number;
    };
    apps: string[];
    filters: { app: string };
}

const emptyForm = {
    _method: 'post',
    app: 'customer-web',
    page: 'home',
    section: 'hero',
    key: '',
    type: 'text' as ContentType,
    value: '',
    image: null as File | null,
    sort_order: 0,
    is_active: true,
};

function previewUrl(content: CmsContent) {
    if (content.type !== 'image' || !content.value) return null;
    if (/^https?:\/\//i.test(content.value)) return content.value;
    return content.value.startsWith('/storage/')
        ? content.value
        : `/storage/${content.value.replace(/^storage\//, '')}`;
}

export default function CmsIndex({ contents, apps, filters }: Props) {
    const [opened, setOpened] = useState(false);
    const [editing, setEditing] = useState<CmsContent | null>(null);
    const form = useForm({ ...emptyForm });
    const appOptions = useMemo(
        () => Array.from(new Set(['common', 'customer-web', 'customer-mobile', 'driver-app', ...apps]))
            .map((value) => ({ value, label: value })),
        [apps],
    );

    const openCreate = () => {
        setEditing(null);
        form.clearErrors();
        form.setData({ ...emptyForm });
        setOpened(true);
    };

    const openEdit = (content: CmsContent) => {
        setEditing(content);
        form.clearErrors();
        form.setData({
            _method: 'put',
            app: content.app,
            page: content.page,
            section: content.section,
            key: content.key,
            type: content.type,
            value: content.value || '',
            image: null,
            sort_order: content.sort_order,
            is_active: content.is_active,
        });
        setOpened(true);
    };

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.post(editing ? `/admin/cms/${editing.id}` : '/admin/cms', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setOpened(false);
                setEditing(null);
                form.reset();
            },
        });
    };

    return (
        <AdminLayout title="Frontend CMS">
            <Head title="Frontend CMS" />
            <Stack gap="lg">
                <Group justify="space-between" align="flex-end">
                    <div>
                        <Text size="xs" fw={800} c="yellow" tt="uppercase">Content delivery</Text>
                        <Title order={2}>Frontend CMS</Title>
                        <Text c="dimmed">Manage banners, launch screens, labels, links, and structured section content without a frontend deployment.</Text>
                    </div>
                    <Button leftSection={<Plus size={16} />} onClick={openCreate}>Add content</Button>
                </Group>

                <Paper p="lg" withBorder>
                    <Group justify="space-between" mb="lg">
                        <Select
                            clearable
                            searchable
                            label="Application"
                            placeholder="All applications"
                            data={appOptions}
                            value={filters.app || null}
                            onChange={(app) => router.get('/admin/cms', { app: app || undefined }, { preserveState: true, replace: true })}
                            w={260}
                        />
                        <Text size="sm" c="dimmed">{contents.total} content entries</Text>
                    </Group>

                    <Table.ScrollContainer minWidth={940}>
                        <Table highlightOnHover verticalSpacing="sm">
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Application</Table.Th>
                                    <Table.Th>Location</Table.Th>
                                    <Table.Th>Key</Table.Th>
                                    <Table.Th>Value</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {contents.data.map((content) => {
                                    const image = previewUrl(content);
                                    return (
                                        <Table.Tr key={content.id}>
                                            <Table.Td><Badge variant="light">{content.app}</Badge></Table.Td>
                                            <Table.Td>
                                                <Text size="sm" fw={700}>{content.page}</Text>
                                                <Text size="xs" c="dimmed">{content.section}</Text>
                                            </Table.Td>
                                            <Table.Td><Text size="sm" ff="monospace">{content.key}</Text></Table.Td>
                                            <Table.Td maw={430}>
                                                {image ? (
                                                    <Group wrap="nowrap">
                                                        <Image src={image} alt="" w={72} h={48} radius="sm" fit="cover" fallbackSrc="" />
                                                        <Text size="xs" c="dimmed" lineClamp={2}>{content.value}</Text>
                                                    </Group>
                                                ) : (
                                                    <Text size="sm" lineClamp={2}>{content.value || '—'}</Text>
                                                )}
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge color={content.is_active ? 'green' : 'gray'} variant="light">
                                                    {content.is_active ? 'Published' : 'Draft'}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap={6} justify="flex-end" wrap="nowrap">
                                                    <Tooltip label="Edit">
                                                        <ActionIcon variant="light" onClick={() => openEdit(content)}><Pencil size={15} /></ActionIcon>
                                                    </Tooltip>
                                                    <Tooltip label="Delete">
                                                        <ActionIcon
                                                            color="red"
                                                            variant="light"
                                                            onClick={() => confirm(`Delete ${content.key}?`) && router.delete(`/admin/cms/${content.id}`, { preserveScroll: true })}
                                                        >
                                                            <Trash2 size={15} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>

                    {contents.last_page > 1 && (
                        <Group justify="flex-end" mt="lg">
                            <Pagination
                                total={contents.last_page}
                                value={contents.current_page}
                                onChange={(page) => router.get('/admin/cms', { app: filters.app || undefined, page }, { preserveState: true })}
                            />
                        </Group>
                    )}
                </Paper>
            </Stack>

            <Modal opened={opened} onClose={() => !form.processing && setOpened(false)} title={editing ? 'Edit CMS content' : 'Add CMS content'} size="xl">
                <form onSubmit={submit}>
                    <Stack>
                        <SimpleGrid cols={{ base: 1, sm: 2 }}>
                            <Select label="Application" required searchable data={appOptions} value={form.data.app} onChange={(value) => form.setData('app', value || 'customer-web')} error={form.errors.app} />
                            <TextInput label="Page" required placeholder="home" value={form.data.page} onChange={(event) => form.setData('page', event.currentTarget.value.toLowerCase())} error={form.errors.page} />
                            <TextInput label="Section" required placeholder="hero" value={form.data.section} onChange={(event) => form.setData('section', event.currentTarget.value.toLowerCase())} error={form.errors.section} />
                            <TextInput label="Key" required placeholder="title" value={form.data.key} onChange={(event) => form.setData('key', event.currentTarget.value.toLowerCase())} error={form.errors.key} />
                            <Select label="Content type" required data={['text', 'image', 'url', 'json']} value={form.data.type} onChange={(value) => form.setData('type', (value || 'text') as ContentType)} error={form.errors.type} />
                            <NumberInput label="Sort order" min={0} value={form.data.sort_order} onChange={(value) => form.setData('sort_order', Number(value) || 0)} error={form.errors.sort_order} />
                        </SimpleGrid>

                        <Textarea
                            label={form.data.type === 'image' ? 'External image URL or stored path' : form.data.type === 'json' ? 'JSON value' : 'Value'}
                            description={form.data.type === 'image' ? 'HTTP/HTTPS URLs are used directly. Other values are resolved through public storage.' : undefined}
                            minRows={form.data.type === 'json' ? 6 : 3}
                            value={form.data.value}
                            onChange={(event) => form.setData('value', event.currentTarget.value)}
                            error={form.errors.value}
                        />

                        {form.data.type === 'image' && (
                            <FileInput
                                label="Or upload an image"
                                placeholder="Choose image"
                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                leftSection={<FileImage size={16} />}
                                value={form.data.image}
                                onChange={(file) => form.setData('image', file)}
                                error={form.errors.image}
                                clearable
                            />
                        )}

                        <Checkbox label="Published" checked={form.data.is_active} onChange={(event) => form.setData('is_active', event.currentTarget.checked)} />
                        <Group justify="flex-end">
                            <Button variant="default" onClick={() => setOpened(false)} disabled={form.processing}>Cancel</Button>
                            <Button type="submit" loading={form.processing}>{editing ? 'Save changes' : 'Create content'}</Button>
                        </Group>
                    </Stack>
                </form>
            </Modal>
        </AdminLayout>
    );
}
