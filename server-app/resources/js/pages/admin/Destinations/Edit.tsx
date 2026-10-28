import React from 'react';
import { Link, useForm } from '@inertiajs/react';
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
}

interface EditDestinationProps {
    title: string;
    destination: Destination;
}

export default function EditDestination({ title, destination }: EditDestinationProps) {
    const { data, setData, put, processing, errors } = useForm({
        name: destination.name || '',
        description: destination.description || '',
        state: destination.state || '',
        region: destination.region || '',
        type: destination.type || '',
        latitude: destination.latitude?.toString() || '',
        longitude: destination.longitude?.toString() || '',
        popular_routes: destination.popular_routes || [],
        distance_from_guwahati: destination.distance_from_guwahati?.toString() || '',
        estimated_travel_time: destination.estimated_travel_time?.toString() || '',
        best_time_to_visit: destination.best_time_to_visit || [],
        attractions: destination.attractions || [],
        images: destination.images || [],
        is_active: destination.is_active || false,
        sort_order: destination.sort_order?.toString() || '0',
    });

    const [popularRoutesInput, setPopularRoutesInput] = React.useState('');
    const [bestTimeInput, setBestTimeInput] = React.useState('');
    const [attractionsInput, setAttractionsInput] = React.useState('');
    const [imagesInput, setImagesInput] = React.useState('');

    const [customPopularRoute, setCustomPopularRoute] = React.useState('');
    const [customBestTime, setCustomBestTime] = React.useState('');
    const [customAttraction, setCustomAttraction] = React.useState('');
    const [customImage, setCustomImage] = React.useState('');

    React.useEffect(() => {
        setPopularRoutesInput((destination.popular_routes || []).join(', '));
        setBestTimeInput((destination.best_time_to_visit || []).join(', '));
        setAttractionsInput((destination.attractions || []).join(', '));
        setImagesInput((destination.images || []).join(', '));
    }, [destination]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Process arrays
        const popularRoutes = popularRoutesInput.split(',').map(r => r.trim()).filter(r => r);
        const bestTime = bestTimeInput.split(',').map(t => t.trim()).filter(t => t);
        const attractions = attractionsInput.split(',').map(a => a.trim()).filter(a => a);
        const images = imagesInput.split(',').map(i => i.trim()).filter(i => i);
        
        setData('popular_routes', popularRoutes);
        setData('best_time_to_visit', bestTime);
        setData('attractions', attractions);
        setData('images', images);
        
        put(`/admin/destinations/${destination.id}`);
    };

    const addCustomPopularRoute = () => {
        if (customPopularRoute.trim() && !data.popular_routes.includes(customPopularRoute.trim())) {
            setData('popular_routes', [...data.popular_routes, customPopularRoute.trim()]);
            setCustomPopularRoute('');
        }
    };

    const removePopularRoute = (index: number) => {
        setData('popular_routes', data.popular_routes.filter((_, i) => i !== index));
    };

    const addCustomBestTime = () => {
        if (customBestTime.trim() && !data.best_time_to_visit.includes(customBestTime.trim())) {
            setData('best_time_to_visit', [...data.best_time_to_visit, customBestTime.trim()]);
            setCustomBestTime('');
        }
    };

    const removeBestTime = (index: number) => {
        setData('best_time_to_visit', data.best_time_to_visit.filter((_, i) => i !== index));
    };

    const addCustomAttraction = () => {
        if (customAttraction.trim() && !data.attractions.includes(customAttraction.trim())) {
            setData('attractions', [...data.attractions, customAttraction.trim()]);
            setCustomAttraction('');
        }
    };

    const removeAttraction = (index: number) => {
        setData('attractions', data.attractions.filter((_, i) => i !== index));
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
                        <h2 className="text-lg font-medium text-gray-900">Edit Destination</h2>
                        <Link
                            href="/admin/destinations"
                            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm font-medium"
                        >
                            Back to Destinations
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
                                    <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                                        Type *
                                    </label>
                                    <select
                                        id="type"
                                        value={data.type}
                                        onChange={(e) => setData('type', e.target.value)}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    >
                                        <option value="">Select Type</option>
                                        <option value="city">City</option>
                                        <option value="hill_station">Hill Station</option>
                                        <option value="beach">Beach</option>
                                        <option value="historical">Historical</option>
                                        <option value="cultural">Cultural</option>
                                        <option value="nature">Nature</option>
                                        <option value="adventure">Adventure</option>
                                        <option value="religious">Religious</option>
                                    </select>
                                    {errors.type && <div className="text-red-600 text-sm mt-1">{errors.type}</div>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                                        State *
                                    </label>
                                    <select
                                        id="state"
                                        value={data.state}
                                        onChange={(e) => setData('state', e.target.value)}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    >
                                        <option value="">Select State</option>
                                        <option value="assam">Assam</option>
                                        <option value="meghalaya">Meghalaya</option>
                                        <option value="manipur">Manipur</option>
                                        <option value="mizoram">Mizoram</option>
                                        <option value="nagaland">Nagaland</option>
                                        <option value="sikkim">Sikkim</option>
                                        <option value="tripura">Tripura</option>
                                        <option value="arunachal_pradesh">Arunachal Pradesh</option>
                                    </select>
                                    {errors.state && <div className="text-red-600 text-sm mt-1">{errors.state}</div>}
                                </div>

                                <div>
                                    <label htmlFor="region" className="block text-sm font-medium text-gray-700">
                                        Region
                                    </label>
                                    <select
                                        id="region"
                                        value={data.region}
                                        onChange={(e) => setData('region', e.target.value)}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Select Region</option>
                                        <option value="northeast_india">Northeast India</option>
                                        <option value="north_india">North India</option>
                                        <option value="east_india">East India</option>
                                        <option value="central_india">Central India</option>
                                    </select>
                                    {errors.region && <div className="text-red-600 text-sm mt-1">{errors.region}</div>}
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

                            {/* Location Information */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label htmlFor="latitude" className="block text-sm font-medium text-gray-700">
                                        Latitude
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        id="latitude"
                                        value={data.latitude}
                                        onChange={(e) => setData('latitude', e.target.value)}
                                        min="-90"
                                        max="90"
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    {errors.latitude && <div className="text-red-600 text-sm mt-1">{errors.latitude}</div>}
                                </div>

                                <div>
                                    <label htmlFor="longitude" className="block text-sm font-medium text-gray-700">
                                        Longitude
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        id="longitude"
                                        value={data.longitude}
                                        onChange={(e) => setData('longitude', e.target.value)}
                                        min="-180"
                                        max="180"
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    {errors.longitude && <div className="text-red-600 text-sm mt-1">{errors.longitude}</div>}
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

                            {/* Travel Information */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="distance_from_guwahati" className="block text-sm font-medium text-gray-700">
                                        Distance from Guwahati (km)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        id="distance_from_guwahati"
                                        value={data.distance_from_guwahati}
                                        onChange={(e) => setData('distance_from_guwahati', e.target.value)}
                                        min="0"
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    {errors.distance_from_guwahati && <div className="text-red-600 text-sm mt-1">{errors.distance_from_guwahati}</div>}
                                </div>

                                <div>
                                    <label htmlFor="estimated_travel_time" className="block text-sm font-medium text-gray-700">
                                        Estimated Travel Time (hours)
                                    </label>
                                    <input
                                        type="number"
                                        id="estimated_travel_time"
                                        value={data.estimated_travel_time}
                                        onChange={(e) => setData('estimated_travel_time', e.target.value)}
                                        min="0"
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    {errors.estimated_travel_time && <div className="text-red-600 text-sm mt-1">{errors.estimated_travel_time}</div>}
                                </div>
                            </div>

                            {/* Popular Routes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Popular Routes (comma separated)
                                </label>
                                <textarea
                                    value={popularRoutesInput}
                                    onChange={(e) => setPopularRoutesInput(e.target.value)}
                                    rows={2}
                                    placeholder="Guwahati to Shillong, Kaziranga to Jorhat"
                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                                <div className="flex gap-2 mt-2">
                                    <input
                                        type="text"
                                        placeholder="Add custom route..."
                                        value={customPopularRoute}
                                        onChange={(e) => setCustomPopularRoute(e.target.value)}
                                        className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addCustomPopularRoute();
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={addCustomPopularRoute}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                    >
                                        Add
                                    </button>
                                </div>
                                {data.popular_routes.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {data.popular_routes.map((route, index) => (
                                            <span
                                                key={index}
                                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                            >
                                                {route}
                                                <button
                                                    type="button"
                                                    onClick={() => removePopularRoute(index)}
                                                    className="ml-1 text-blue-600 hover:text-blue-800"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Best Time to Visit */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Best Time to Visit (comma separated)
                                </label>
                                <textarea
                                    value={bestTimeInput}
                                    onChange={(e) => setBestTimeInput(e.target.value)}
                                    rows={2}
                                    placeholder="October to March, April to June"
                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                                <div className="flex gap-2 mt-2">
                                    <input
                                        type="text"
                                        placeholder="Add custom time..."
                                        value={customBestTime}
                                        onChange={(e) => setCustomBestTime(e.target.value)}
                                        className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addCustomBestTime();
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={addCustomBestTime}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                    >
                                        Add
                                    </button>
                                </div>
                                {data.best_time_to_visit.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {data.best_time_to_visit.map((time, index) => (
                                            <span
                                                key={index}
                                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                                            >
                                                {time}
                                                <button
                                                    type="button"
                                                    onClick={() => removeBestTime(index)}
                                                    className="ml-1 text-green-600 hover:text-green-800"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Attractions */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Attractions (comma separated)
                                </label>
                                <textarea
                                    value={attractionsInput}
                                    onChange={(e) => setAttractionsInput(e.target.value)}
                                    rows={3}
                                    placeholder="Umiam Lake, Don Bosco Museum, Elephant Falls"
                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                                <div className="flex gap-2 mt-2">
                                    <input
                                        type="text"
                                        placeholder="Add custom attraction..."
                                        value={customAttraction}
                                        onChange={(e) => setCustomAttraction(e.target.value)}
                                        className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addCustomAttraction();
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={addCustomAttraction}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                    >
                                        Add
                                    </button>
                                </div>
                                {data.attractions.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {data.attractions.map((attraction, index) => (
                                            <span
                                                key={index}
                                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                                            >
                                                {attraction}
                                                <button
                                                    type="button"
                                                    onClick={() => removeAttraction(index)}
                                                    className="ml-1 text-purple-600 hover:text-purple-800"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
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

                            {/* Status */}
                            <div className="flex items-center">
                                <input
                                    id="is_active"
                                    type="checkbox"
                                    checked={data.is_active}
                                    onChange={(e) => setData('is_active' as any, e.target.checked)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                                    Active
                                </label>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Link
                                href="/admin/destinations"
                                className="mr-3 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 text-sm font-medium"
                            >
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={processing}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                            >
                                {processing ? 'Updating...' : 'Update Destination'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </AdminLayout>
    );
}