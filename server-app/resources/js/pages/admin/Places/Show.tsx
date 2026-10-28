import React from 'react';
import { Link, useForm, router } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';
import PlaceLocationMap from '@/components/places/PlaceLocationMap';
import { RefreshCw } from 'lucide-react';

interface Place {
    id: number;
    name: string;
    description: string | null;
    short_description: string | null;
    location: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    longitude: number | string | null;
    latitude: number | string | null;
    tags: string[] | null;
    google_place_id: string | null;
    google_rating: number | string | null;
    google_review_count: number | null;
    google_synced_at: string | null;
    is_active: boolean;
    is_featured: boolean;
    media: Array<{
        id: number;
        path: string;
        url: string;
        type: string;
        caption: string | null;
        source: 'admin' | 'customer';
        approval_status: 'pending' | 'approved' | 'rejected';
        rejection_reason?: string | null;
        customer?: { id: number; name: string; phone?: string | null } | null;
    }>;
}

interface ShowPlaceProps {
    title: string;
    place: Place;
}

export default function Show({ title, place }: ShowPlaceProps) {
    const { data, setData, post, processing, errors, reset } = useForm({
        file: null as File | null,
        url: '',
        caption: '',
        type: 'image',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/admin/places/${place.id}/media`, {
            forceFormData: true,
            onSuccess: () => reset(),
        });
    };

    const handleDeleteMedia = (mediaId: number) => {
        if (confirm('Are you sure you want to delete this media?')) {
            router.delete(`/admin/media/${mediaId}`, {
                onSuccess: () => {
                    // Optionally refresh the page or update state
                },
            });
        }
    };

    const approveMedia = (mediaId: number) => router.patch(`/admin/media/${mediaId}/approve`, {}, { preserveScroll: true });
    const rejectMedia = (mediaId: number) => {
        const reason = prompt('Why is this customer photo being rejected?');
        if (reason?.trim()) router.patch(`/admin/media/${mediaId}/reject`, { reason: reason.trim() }, { preserveScroll: true });
    };
    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);
    const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude) && place.latitude !== null && place.longitude !== null;

    return (
        <AdminLayout title={title}>
            <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-medium text-gray-900">Place Details</h2>
                        <div className="space-x-2">
                            <Link
                                href={`/admin/places/${place.id}/edit`}
                                className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 text-sm font-medium"
                            >
                                Edit Place
                            </Link>
                            <Link
                                href="/admin/places"
                                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm font-medium"
                            >
                                Back to Places
                            </Link>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div>
                            <h3 className="text-md font-medium text-gray-900 mb-4">Place Information</h3>
                            <dl className="space-y-3">
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Name</dt>
                                    <dd className="text-sm text-gray-900">{place.name}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Description</dt>
                                    <dd className="text-sm text-gray-900">{place.description || 'N/A'}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Short Description</dt>
                                    <dd className="text-sm text-gray-900">{place.short_description || 'N/A'}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Location</dt>
                                    <dd className="text-sm text-gray-900">{place.location || 'N/A'}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Coordinates</dt>
                                    <dd className="text-sm text-gray-900">
                                        {place.latitude && place.longitude ? `${place.latitude}, ${place.longitude}` : 'N/A'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Google Place ID</dt>
                                    <dd className="text-sm text-gray-900">{place.google_place_id || 'N/A'}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Google Rating Cache</dt>
                                    <dd className="text-sm text-gray-900">
                                        {place.google_rating || 'N/A'} ({place.google_review_count || 0} reviews)
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Last Google Sync</dt>
                                    <dd className="text-sm text-gray-900">
                                        {place.google_synced_at ? new Date(place.google_synced_at).toLocaleString() : 'Never'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Tags</dt>
                                    <dd className="text-sm text-gray-900">{place.tags?.join(', ') || 'N/A'}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Catalog Status</dt>
                                    <dd className="text-sm text-gray-900">
                                        {place.is_active ? 'Active' : 'Inactive'}{place.is_featured ? ' / Featured' : ''}
                                    </dd>
                                </div>
                            </dl>
                            <div className="mt-6">
                                <h3 className="mb-3 text-md font-medium text-gray-900">Exact map location</h3>
                                {hasCoordinates ? <PlaceLocationMap latitude={latitude} longitude={longitude} /> : <p className="text-sm text-gray-500">No coordinates saved yet.</p>}
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => router.post(`/admin/places/${place.id}/sync-google`, {}, { preserveScroll: true })}
                                        disabled={!place.google_place_id}
                                        className="inline-flex min-h-11 items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-extrabold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <RefreshCw size={16} /> Sync Google data
                                    </button>
                                    {hasCoordinates ? (
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}${place.google_place_id ? `&query_place_id=${encodeURIComponent(place.google_place_id)}` : ''}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex min-h-11 items-center rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/5"
                                        >
                                            Open in Google Maps
                                        </a>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-md font-medium text-gray-900 mb-4">Media Management</h3>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="file" className="block text-sm font-medium text-gray-700">
                                        Upload Media
                                    </label>
                                    <input
                                        type="file"
                                        id="file"
                                        onChange={(e) => setData('file', e.target.files?.[0] || null)}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                        accept="image/*,video/*"
                                    />
                                    {errors.file && <div className="text-red-600 text-sm mt-1">{errors.file}</div>}
                                </div>

                                <div>
                                    <label htmlFor="url" className="block text-sm font-medium text-gray-700">
                                        Or external media URL
                                    </label>
                                    <input
                                        type="url"
                                        id="url"
                                        value={data.url}
                                        onChange={(e) => setData('url', e.target.value)}
                                        placeholder="https://images.example.com/place.jpg"
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">HTTP/HTTPS URLs are loaded directly; uploaded files use public storage.</p>
                                    {errors.url && <div className="text-red-600 text-sm mt-1">{errors.url}</div>}
                                </div>

                                <div>
                                    <label htmlFor="type" className="block text-sm font-medium text-gray-700">Media type</label>
                                    <select id="type" value={data.type} onChange={(e) => setData('type', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                        <option value="image">Image</option>
                                        <option value="panorama">360° panorama image</option>
                                        <option value="video">Video</option>
                                    </select>
                                    {errors.type && <div className="text-red-600 text-sm mt-1">{errors.type}</div>}
                                </div>

                                <div>
                                    <label htmlFor="caption" className="block text-sm font-medium text-gray-700">
                                        Caption (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        id="caption"
                                        value={data.caption}
                                        onChange={(e) => setData('caption', e.target.value)}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    {errors.caption && <div className="text-red-600 text-sm mt-1">{errors.caption}</div>}
                                </div>

                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                                >
                                    {processing ? 'Uploading...' : 'Upload Media'}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-md font-medium text-gray-900 mb-4">Existing Media</h3>
                        {place.media.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {place.media.map((media) => (
                                    <div key={media.id} className="border border-gray-200 rounded-lg p-4">
                                        {media.type !== 'video' ? (
                                            <img
                                                src={media.url}
                                                alt={media.caption || 'Media'}
                                                className="w-full h-32 object-cover rounded-md mb-2"
                                            />
                                        ) : (
                                            <video
                                                src={media.url}
                                                className="w-full h-32 object-cover rounded-md mb-2"
                                                controls
                                            />
                                        )}
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{media.type === 'panorama' ? '360° panorama' : media.type}</span>
                                            <span className={`rounded-full px-2 py-1 text-xs font-bold ${media.approval_status === 'approved' ? 'bg-green-50 text-green-700' : media.approval_status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{media.approval_status}</span>
                                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700">{media.source}</span>
                                        </div>
                                        <p className="text-sm text-gray-600">{media.caption || 'No caption'}</p>
                                        {media.customer && <p className="mt-1 text-xs text-gray-500">Uploaded by {media.customer.name}{media.customer.phone ? ` · ${media.customer.phone}` : ''}</p>}
                                        {media.rejection_reason && <p className="mt-1 text-xs text-red-600">Reason: {media.rejection_reason}</p>}
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {media.source === 'customer' && media.approval_status !== 'approved' && <button type="button" onClick={() => approveMedia(media.id)} className="min-h-11 rounded-md bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-700">Approve</button>}
                                            {media.source === 'customer' && media.approval_status !== 'rejected' && <button type="button" onClick={() => rejectMedia(media.id)} className="min-h-11 rounded-md bg-amber-600 px-3 py-2 text-sm font-bold text-white hover:bg-amber-700">Reject</button>}
                                            <button type="button" onClick={() => handleDeleteMedia(media.id)} className="min-h-11 rounded-md bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-700">Delete</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500">No media uploaded yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
