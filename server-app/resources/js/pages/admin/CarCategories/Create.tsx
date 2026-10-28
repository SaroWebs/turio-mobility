import React from 'react';
import { Link, useForm } from '@inertiajs/react';
import AdminLayout from '@/layouts/AdminLayout';

interface CreateCarCategoryProps {
    title: string;
    user: any;
}

export default function CreateCarCategory({ title, user }: CreateCarCategoryProps) {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        description: '',
        vehicle_type: '',
        seats: '4',
        has_ac: true,
        has_driver: false,
        base_price_per_day: '',
        included_km_per_day: '',
        extra_km_charge: '',
        price_per_km: '',
        features: [] as string[],
        images: [] as string[],
        fuel_type: '',
        year: '',
        is_active: true,
        sort_order: '0',
    });

    const [featuresInput, setFeaturesInput] = React.useState('');
    const [imagesInput, setImagesInput] = React.useState('');
    const [customFeature, setCustomFeature] = React.useState('');
    const [customImage, setCustomImage] = React.useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Process features and images arrays
        const features = featuresInput.split(',').map(f => f.trim()).filter(f => f);
        const images = imagesInput.split(',').map(i => i.trim()).filter(i => i);

        setData('features', features);
        setData('images', images);

        post('/admin/car-categories');
    };

    const addCustomFeature = () => {
        if (customFeature.trim() && !data.features.includes(customFeature.trim())) {
            setData('features', [...data.features, customFeature.trim()]);
            setCustomFeature('');
        }
    };

    const removeFeature = (index: number) => {
        setData('features', data.features.filter((_, i) => i !== index));
    };

    const addCustomImage = () => {
        if (customImage.trim() && !data.images.includes(customImage.trim())) {
            setData('images', [...data.images, customImage.trim()]);
            setCustomImage('');
        }
    };

    const removeImage = (index: number) => {
        setData('images', data.images.filter((_, i) => i !== index));
    };

    return (
        <AdminLayout title={title}>
            <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-medium text-gray-900">Create New Car Category</h2>
                        <Link
                            href="/admin/car-categories"
                            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm font-medium"
                        >
                            Back to Categories
                        </Link>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 gap-6">
                            {/* Basic Information */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                        Name *
                                    </label>
                                    <input
                                        type="text"
                                        id="name"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    />
                                    {errors.name && <div className="text-red-600 text-sm mt-1">{errors.name}</div>}
                                </div>

                                <div>
                                    <label htmlFor="vehicle_type" className="block text-sm font-medium text-gray-700">
                                        Vehicle Type *
                                    </label>
                                    <select
                                        id="vehicle_type"
                                        value={data.vehicle_type}
                                        onChange={(e) => setData('vehicle_type', e.target.value)}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    >
                                        <option value="">Select Vehicle Type</option>
                                        <option value="sedan">Sedan</option>
                                        <option value="suv">SUV</option>
                                        <option value="hatchback">Hatchback</option>
                                        <option value="convertible">Convertible</option>
                                        <option value="van">Van</option>
                                        <option value="truck">Truck</option>
                                    </select>
                                    {errors.vehicle_type && <div className="text-red-600 text-sm mt-1">{errors.vehicle_type}</div>}
                                </div>
                            </div>

                            <div>
                                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                                    Description
                                </label>
                                <textarea
                                    id="description"
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                    rows={3}
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                                {errors.description && <div className="text-red-600 text-sm mt-1">{errors.description}</div>}
                            </div>

                            {/* Specifications */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label htmlFor="seats" className="block text-sm font-medium text-gray-700">
                                        Number of Seats *
                                    </label>
                                    <input
                                        type="number"
                                        id="seats"
                                        value={data.seats}
                                        onChange={(e) => setData('seats', e.target.value)}
                                        min="1"
                                        max="20"
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    />
                                    {errors.seats && <div className="text-red-600 text-sm mt-1">{errors.seats}</div>}
                                </div>

                                <div>
                                    <label htmlFor="fuel_type" className="block text-sm font-medium text-gray-700">
                                        Fuel Type
                                    </label>
                                    <select
                                        id="fuel_type"
                                        value={data.fuel_type}
                                        onChange={(e) => setData('fuel_type', e.target.value)}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Select Fuel Type</option>
                                        <option value="petrol">Petrol</option>
                                        <option value="diesel">Diesel</option>
                                        <option value="electric">Electric</option>
                                        <option value="hybrid">Hybrid</option>
                                    </select>
                                    {errors.fuel_type && <div className="text-red-600 text-sm mt-1">{errors.fuel_type}</div>}
                                </div>

                                <div>
                                    <label htmlFor="year" className="block text-sm font-medium text-gray-700">
                                        Year
                                    </label>
                                    <input
                                        type="number"
                                        id="year"
                                        value={data.year}
                                        onChange={(e) => setData('year', e.target.value)}
                                        min="1900"
                                        max={new Date().getFullYear() + 1}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    {errors.year && <div className="text-red-600 text-sm mt-1">{errors.year}</div>}
                                </div>
                            </div>

                            {/* Features */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Features
                                </label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {['Air Conditioning', 'Power Steering', 'Power Windows', 'Music System', 'GPS Navigation', 'Bluetooth', 'USB Charging', 'Leather Seats', 'Sunroof', 'Backup Camera'].map((feature) => (
                                        <button
                                            key={feature}
                                            type="button"
                                            onClick={() => {
                                                if (data.features.includes(feature)) {
                                                    setData('features', data.features.filter(f => f !== feature));
                                                } else {
                                                    setData('features', [...data.features, feature]);
                                                }
                                            }}
                                            className={`px-3 py-1 rounded-full text-sm ${data.features.includes(feature)
                                                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                                                }`}
                                        >
                                            {feature}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Add custom feature..."
                                        value={customFeature}
                                        onChange={(e) => setCustomFeature(e.target.value)}
                                        className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addCustomFeature();
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={addCustomFeature}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                    >
                                        Add
                                    </button>
                                </div>
                                {data.features.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {data.features.map((feature, index) => (
                                            <span
                                                key={index}
                                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                            >
                                                {feature}
                                                <button
                                                    type="button"
                                                    onClick={() => removeFeature(index)}
                                                    className="ml-1 text-blue-600 hover:text-blue-800"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Pricing */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="base_price_per_day" className="block text-sm font-medium text-gray-700">
                                        Base Price Per Day (₹) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        id="base_price_per_day"
                                        value={data.base_price_per_day}
                                        onChange={(e) => setData('base_price_per_day', e.target.value)}
                                        min="0"
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    />
                                    {errors.base_price_per_day && <div className="text-red-600 text-sm mt-1">{errors.base_price_per_day}</div>}
                                </div>

                                <div>
                                    <label htmlFor="price_per_km" className="block text-sm font-medium text-gray-700">
                                        Price Per KM (₹) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        id="price_per_km"
                                        value={data.price_per_km}
                                        onChange={(e) => setData('price_per_km', e.target.value)}
                                        min="0"
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    />
                                    {errors.price_per_km && <div className="text-red-600 text-sm mt-1">{errors.price_per_km}</div>}
                                </div>
                                <div>
                                    <label htmlFor="included_km_per_day">Rental included kilometres per day</label>
                                    <input id="included_km_per_day" type="number" min="0" value={data.included_km_per_day} onChange={e => setData('included_km_per_day', e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md" />
                                    <p>Leave blank to disable distance surcharges.</p>
                                    {errors.included_km_per_day && <p className="text-red-600">{errors.included_km_per_day}</p>}
                                </div>
                                <div>
                                    <label htmlFor="extra_km_charge">Rental charge per extra kilometre (INR)</label>
                                    <input id="extra_km_charge" type="number" min="0" step="0.01" value={data.extra_km_charge} onChange={e => setData('extra_km_charge', e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md" />
                                    {errors.extra_km_charge && <p className="text-red-600">{errors.extra_km_charge}</p>}
                                </div>
                            </div>

                            {/* Images */}
                            <div>
                                <label htmlFor="images" className="block text-sm font-medium text-gray-700">
                                    Image URLs (comma separated)
                                </label>
                                <textarea
                                    id="images"
                                    value={imagesInput}
                                    onChange={(e) => setImagesInput(e.target.value)}
                                    rows={3}
                                    placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                                {errors.images && <div className="text-red-600 text-sm mt-1">{errors.images}</div>}
                            </div>

                            {/* Options */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex items-center">
                                    <input
                                        id="has_ac"
                                        type="checkbox"
                                        checked={!!data.has_ac}
                                        onChange={(e) => setData('has_ac' as any, e.target.checked)}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="has_ac" className="ml-2 block text-sm text-gray-900">
                                        Air Conditioning
                                    </label>
                                </div>

                                <div className="flex items-center">
                                    <input
                                        id="has_driver"
                                        type="checkbox"
                                        checked={!!data.has_driver}
                                        onChange={(e) => setData('has_driver' as any, e.target.checked)}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="has_driver" className="ml-2 block text-sm text-gray-900">
                                        Driver Available
                                    </label>
                                </div>

                                <div className="flex items-center">
                                    <input
                                        id="is_active"
                                        type="checkbox"
                                        checked={!!data.is_active}
                                        onChange={(e) => setData('is_active' as any, e.target.checked)}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                                        Active
                                    </label>
                                </div>

                                <div>
                                    <label htmlFor="sort_order" className="block text-sm font-medium text-gray-700">
                                        Sort Order
                                    </label>
                                    <input
                                        type="number"
                                        id="sort_order"
                                        value={data.sort_order}
                                        onChange={(e) => setData('sort_order', e.target.value)}
                                        min="0"
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    {errors.sort_order && <div className="text-red-600 text-sm mt-1">{errors.sort_order}</div>}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Link
                                href="/admin/car-categories"
                                className="mr-3 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 text-sm font-medium"
                            >
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={processing}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                            >
                                {processing ? 'Creating...' : 'Create Category'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </AdminLayout>
    );
}
