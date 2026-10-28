import React from 'react';
import { Link } from '@inertiajs/react';
import AdminLayout from '../../../../layouts/AdminLayout';
import { resolveMediaUrl } from '@/lib/utils';

interface Place {
    id: number;
    name: string;
    description: string;
    media: Array<{
        id: number;
        file_path: string;
        url?: string;
        file_type: string;
    }>;
}

interface Tour {
    id: number;
    title: string;
    description: string;
}

interface Itinerary {
    id: number;
    day_index: number;
    time: string | null;
    details: string;
    place: Place;
}

interface ShowItineraryProps {
    title: string;
    tour: Tour;
    itinerary: Itinerary;
}

export default function ShowItinerary({ title, tour, itinerary }: ShowItineraryProps) {
    return (
        <AdminLayout title={title}>
            <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-medium text-gray-900">
                            Itinerary Details for: {tour.title}
                        </h2>
                        <div className="flex space-x-3">
                            <Link
                                href={`/admin/tours/${tour.id}/itineraries`}
                                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm font-medium"
                            >
                                Back to Itineraries
                            </Link>
                            <Link
                                href={`/admin/tours/${tour.id}/itineraries/${itinerary.id}/edit`}
                                className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 text-sm font-medium"
                            >
                                Edit Itinerary
                            </Link>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main Content */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Basic Information */}
                            <div className="bg-gray-50 rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Itinerary Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Day</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{itinerary.day_index}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Time</dt>
                                        <dd className="mt-1 text-sm text-gray-900">
                                            {itinerary.time || 'Not specified'}
                                        </dd>
                                    </div>
                                </div>
                            </div>

                            {/* Place Information */}
                            {itinerary.place && (
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Place Information</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Place Name</dt>
                                            <dd className="mt-1 text-sm text-gray-900">{itinerary.place.name}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Description</dt>
                                            <dd className="mt-1 text-sm text-gray-900">{itinerary.place.description}</dd>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Details */}
                            {itinerary.details && (
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Details</h3>
                                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{itinerary.details}</p>
                                </div>
                            )}

                            {/* Media */}
                            {itinerary.place && itinerary.place.media && itinerary.place.media.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Media Gallery</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {itinerary.place.media.map((media) => (
                                            <div key={media.id} className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
                                                {media.file_type === 'image' ? (
                                                    <img
                                                        src={resolveMediaUrl(media.url || media.file_path)}
                                                        alt="Place media"
                                                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                                        <div className="text-center">
                                                            <div className="text-2xl mb-2">📹</div>
                                                            <div className="text-xs">Video</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Actions */}
                            <div className="bg-gray-50 rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Actions</h3>
                                <div className="space-y-3">
                                    <Link
                                        href={`/admin/tours/${tour.id}/itineraries/${itinerary.id}/edit`}
                                        className="block w-full bg-yellow-600 text-white text-center px-4 py-2 rounded-md hover:bg-yellow-700 text-sm font-medium"
                                    >
                                        Edit This Itinerary
                                    </Link>
                                    <Link
                                        href={`/admin/tours/${tour.id}/itineraries`}
                                        className="block w-full bg-blue-600 text-white text-center px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
                                    >
                                        View All Itineraries
                                    </Link>
                                    <Link
                                        href={`/admin/tours/${tour.id}`}
                                        className="block w-full bg-gray-600 text-white text-center px-4 py-2 rounded-md hover:bg-gray-700 text-sm font-medium"
                                    >
                                        Back to Tour Details
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
