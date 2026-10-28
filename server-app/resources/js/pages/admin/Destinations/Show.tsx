import React from 'react';
import { Link, usePage } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';

interface Destination {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    state: string;
    region: string | null;
    type: string;
    latitude: number | null;
    longitude: number | null;
    popular_routes: string[] | null;
    distance_from_guwahati: number | null;
    estimated_travel_time: number | null;
    best_time_to_visit: string[] | null;
    attractions: string[] | null;
    images: string[] | null;
    is_active: boolean;
    sort_order: number | null;
    created_at: string;
    updated_at: string;
}

interface ShowDestinationProps {
    title: string;
    destination: Destination;
}

export default function ShowDestination({ title, destination }: ShowDestinationProps) {
    const { url } = usePage();

    const getTypeIcon = (type: string) => {
        const icons = {
            city: '🏙️',
            hill_station: '⛰️',
            beach: '🏖️',
            historical: '🏛️',
            cultural: '🎭',
            nature: '🌿',
            adventure: '🏔️',
            religious: '🕌'
        };
        return icons[type as keyof typeof icons] || '📍';
    };

    const getTypeColor = (type: string) => {
        const colors = {
            city: 'bg-blue-100 text-blue-800',
            hill_station: 'bg-green-100 text-green-800',
            beach: 'bg-cyan-100 text-cyan-800',
            historical: 'bg-yellow-100 text-yellow-800',
            cultural: 'bg-purple-100 text-purple-800',
            nature: 'bg-emerald-100 text-emerald-800',
            adventure: 'bg-orange-100 text-orange-800',
            religious: 'bg-indigo-100 text-indigo-800'
        };
        return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
    };

    const formatDistance = (distance: number | null) => {
        if (!distance) return 'N/A';
        return `${distance} km`;
    };

    const formatTravelTime = (time: number | null) => {
        if (!time) return 'N/A';
        return `${time} hours`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const formatCoordinate = (coord: number | null, type: 'lat' | 'lng') => {
        if (!coord) return 'N/A';
        const hemisphere = type === 'lat' ? (coord >= 0 ? 'N' : 'S') : (coord >= 0 ? 'E' : 'W');
        return `${Math.abs(coord).toFixed(6)}° ${hemisphere}`;
    };

    return (
        <AdminLayout title={title}>
            <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-medium text-gray-900">Destination Details</h2>
                        <div className="flex space-x-2">
                            <Link
                                href="/admin/destinations"
                                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm font-medium"
                            >
                                Back to Destinations
                            </Link>
                            <Link
                                href={`/admin/destinations/${destination.id}/edit`}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
                            >
                                Edit Destination
                            </Link>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main Information */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Basic Details */}
                            <div className="bg-gray-50 rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Name</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{destination.name}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Type</dt>
                                        <dd className="mt-1 text-sm text-gray-900 flex items-center">
                                            <span className="mr-2 text-lg">{getTypeIcon(destination.type)}</span>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getTypeColor(destination.type)}`}>
                                                {destination.type.replace('_', ' ')}
                                            </span>
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">State</dt>
                                        <dd className="mt-1 text-sm text-gray-900 capitalize">{destination.state.replace('_', ' ')}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Region</dt>
                                        <dd className="mt-1 text-sm text-gray-900 capitalize">
                                            {destination.region ? destination.region.replace('_', ' ') : 'Not specified'}
                                        </dd>
                                    </div>
                                    <div className="md:col-span-2">
                                        <dt className="text-sm font-medium text-gray-500">Description</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{destination.description || 'No description provided'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Status</dt>
                                        <dd className="mt-1">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                destination.is_active 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : 'bg-red-100 text-red-800'
                                            }`}>
                                                {destination.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </dd>
                                    </div>
                                </div>
                            </div>

                            {/* Location Information */}
                            <div className="bg-gray-50 rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Location Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Latitude</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{formatCoordinate(destination.latitude, 'lat')}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Longitude</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{formatCoordinate(destination.longitude, 'lng')}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Distance from Guwahati</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{formatDistance(destination.distance_from_guwahati)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Estimated Travel Time</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{formatTravelTime(destination.estimated_travel_time)}</dd>
                                    </div>
                                </div>
                            </div>

                            {/* Travel Information */}
                            {destination.popular_routes && destination.popular_routes.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Popular Routes</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {destination.popular_routes.map((route, index) => (
                                            <span
                                                key={index}
                                                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                                            >
                                                {route}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Best Time to Visit */}
                            {destination.best_time_to_visit && destination.best_time_to_visit.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Best Time to Visit</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {destination.best_time_to_visit.map((time, index) => (
                                            <span
                                                key={index}
                                                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"
                                            >
                                                {time}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Attractions */}
                            {destination.attractions && destination.attractions.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Attractions</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {destination.attractions.map((attraction, index) => (
                                            <span
                                                key={index}
                                                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800"
                                            >
                                                {attraction}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Images */}
                            {destination.images && destination.images.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Images</h3>
                                    <div className="space-y-3">
                                        {destination.images.map((image, index) => (
                                            <div key={index} className="aspect-w-16 aspect-h-9">
                                                <img
                                                    src={image}
                                                    alt={`${destination.name} - Image ${index + 1}`}
                                                    className="w-full h-32 object-cover rounded-lg"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Quick Stats */}
                            <div className="bg-gray-50 rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Stats</h3>
                                <dl className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <dt className="text-gray-500">Sort Order</dt>
                                        <dd className="font-medium text-gray-900">{destination.sort_order || 'Default'}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-gray-500">Total Attractions</dt>
                                        <dd className="font-medium text-gray-900">{destination.attractions?.length || 0}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-gray-500">Popular Routes</dt>
                                        <dd className="font-medium text-gray-900">{destination.popular_routes?.length || 0}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-gray-500">Images</dt>
                                        <dd className="font-medium text-gray-900">{destination.images?.length || 0}</dd>
                                    </div>
                                </dl>
                            </div>

                            {/* Timestamps */}
                            <div className="bg-gray-50 rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Metadata</h3>
                                <div className="space-y-2 text-sm text-gray-600">
                                    <div>
                                        <dt className="font-medium">Created</dt>
                                        <dd>{formatDate(destination.created_at)}</dd>
                                    </div>
                                    <div>
                                        <dt className="font-medium">Last Updated</dt>
                                        <dd>{formatDate(destination.updated_at)}</dd>
                                    </div>
                                    <div>
                                        <dt className="font-medium">ID</dt>
                                        <dd>{destination.id}</dd>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}