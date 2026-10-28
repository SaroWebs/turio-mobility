import React from 'react';
import { Link, usePage } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';

interface CarCategory {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    vehicle_type: string;
    seats: number;
    has_ac: boolean;
    has_driver: boolean;
    base_price_per_day: number;
    price_per_km: number;
    features: string[] | null;
    images: string[] | null;
    fuel_type: string | null;
    year: number | null;
    is_active: boolean;
    sort_order: number | null;
    created_at: string;
    updated_at: string;
    car_rentals?: Array<{
        id: number;
        user: {
            name: string;
            email: string;
        };
        status: string;
        total_amount: number;
        start_date: string;
        end_date: string;
    }>;
}

interface ShowCarCategoryProps {
    title: string;
    car_category: CarCategory;
}

export default function ShowCarCategory({ title, car_category }: ShowCarCategoryProps) {
    const { url } = usePage();

    const getVehicleTypeIcon = (type: string) => {
        const icons = {
            sedan: '🚗',
            suv: '🚙',
            hatchback: '🚗',
            convertible: '🏎️',
            van: '🚐',
            truck: '🚚'
        };
        return icons[type as keyof typeof icons] || '🚗';
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(price);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <AdminLayout title={title}>
            <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-medium text-gray-900">Car Category Details</h2>
                        <div className="flex space-x-2">
                            <Link
                                href="/admin/car-categories"
                                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm font-medium"
                            >
                                Back to Categories
                            </Link>
                            <Link
                                href={`/admin/car-categories/${car_category.id}/edit`}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
                            >
                                Edit Category
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
                                        <dd className="mt-1 text-sm text-gray-900">{car_category.name}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Vehicle Type</dt>
                                        <dd className="mt-1 text-sm text-gray-900 capitalize flex items-center">
                                            <span className="mr-2 text-lg">{getVehicleTypeIcon(car_category.vehicle_type)}</span>
                                            {car_category.vehicle_type}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Description</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{car_category.description || 'No description provided'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Status</dt>
                                        <dd className="mt-1">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                car_category.is_active 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : 'bg-red-100 text-red-800'
                                            }`}>
                                                {car_category.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </dd>
                                    </div>
                                </div>
                            </div>

                            {/* Specifications */}
                            <div className="bg-gray-50 rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Specifications</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Number of Seats</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{car_category.seats}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Fuel Type</dt>
                                        <dd className="mt-1 text-sm text-gray-900 capitalize">{car_category.fuel_type || 'Not specified'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Year</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{car_category.year || 'Not specified'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Sort Order</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{car_category.sort_order || 'Default'}</dd>
                                    </div>
                                </div>
                            </div>

                            {/* Features */}
                            <div className="bg-gray-50 rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Features & Options</h3>
                                <div className="space-y-4">
                                    <div className="flex flex-wrap gap-2">
                                        {car_category.has_ac && (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                Air Conditioning
                                            </span>
                                        )}
                                        {car_category.has_driver && (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                Driver Available
                                            </span>
                                        )}
                                        {car_category.fuel_type && (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 capitalize">
                                                {car_category.fuel_type}
                                            </span>
                                        )}
                                    </div>
                                    
                                    {car_category.features && car_category.features.length > 0 && (
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500 mb-2">Additional Features</dt>
                                            <div className="flex flex-wrap gap-2">
                                                {car_category.features.map((feature, index) => (
                                                    <span
                                                        key={index}
                                                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                                                    >
                                                        {feature}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Pricing */}
                            <div className="bg-gray-50 rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Pricing</h3>
                                <div className="space-y-3">
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Daily Rate</dt>
                                        <dd className="mt-1 text-lg font-semibold text-gray-900">{formatPrice(car_category.base_price_per_day)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Per KM</dt>
                                        <dd className="mt-1 text-sm text-gray-900">₹{car_category.price_per_km}</dd>
                                    </div>
                                </div>
                            </div>

                            {/* Images */}
                            {car_category.images && car_category.images.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Images</h3>
                                    <div className="space-y-3">
                                        {car_category.images.map((image, index) => (
                                            <div key={index} className="aspect-w-16 aspect-h-9">
                                                <img
                                                    src={image}
                                                    alt={`${car_category.name} - Image ${index + 1}`}
                                                    className="w-full h-32 object-cover rounded-lg"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Timestamps */}
                            <div className="bg-gray-50 rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Metadata</h3>
                                <div className="space-y-2 text-sm text-gray-600">
                                    <div>
                                        <dt className="font-medium">Created</dt>
                                        <dd>{formatDate(car_category.created_at)}</dd>
                                    </div>
                                    <div>
                                        <dt className="font-medium">Last Updated</dt>
                                        <dd>{formatDate(car_category.updated_at)}</dd>
                                    </div>
                                    <div>
                                        <dt className="font-medium">ID</dt>
                                        <dd>{car_category.id}</dd>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Car Rentals */}
                    {car_category.car_rentals && car_category.car_rentals.length > 0 && (
                        <div className="mt-8">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Associated Car Rentals</h3>
                            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                                <ul className="divide-y divide-gray-200">
                                    {car_category.car_rentals.map((rental) => (
                                        <li key={rental.id}>
                                            <div className="px-4 py-4 flex items-center justify-between">
                                                <div className="flex items-center">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {rental.user.name}
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            {rental.user.email}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-4">
                                                    <div className="text-right">
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {formatPrice(rental.total_amount)}
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            {formatDate(rental.start_date)} - {formatDate(rental.end_date)}
                                                        </p>
                                                    </div>
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                        rental.status === 'active' ? 'bg-green-100 text-green-800' :
                                                        rental.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                        {rental.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}