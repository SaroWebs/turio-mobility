import React, { useState } from 'react';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/ModernCard';
import { Badge, Button, Card} from '@mantine/core';

import {
    AlertTriangle,
    Car,
    Heart,
    Scale,
    MapPin,
    Phone,
    Clock,
    CheckCircle,
    XCircle,
    Loader2
} from 'lucide-react';

interface ExtendedCareRequest {
    id: number;
    care_type: string;
    status: string;
    request_date: string;
    completion_date?: string;
    service_provider?: string;
    cost_incurred: number;
    coverage_applied: number;
    notes?: string;
}

const EmergencyButton: React.FC<{
    type: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
}> = ({ type, label, icon, onClick, disabled = false }) => {
    const getButtonClass = () => {
        switch (type) {
            case 'accident': return 'bg-red-600 hover:bg-red-700 text-white';
            case 'breakdown': return 'bg-yellow-600 hover:bg-yellow-700 text-white';
            case 'medical': return 'bg-green-600 hover:bg-green-700 text-white';
            case 'legal': return 'bg-blue-600 hover:bg-blue-700 text-white';
            default: return 'bg-gray-600 hover:bg-gray-700 text-white';
        }
    };

    return (
        <Button
            className={`${getButtonClass()} w-full py-6 text-lg font-semibold`}
            onClick={onClick}
            disabled={disabled}
        >
            {icon}
            <span className="ml-2">{label}</span>
        </Button>
    );
};

const LocationSelector: React.FC<{
    onLocationSelect: (location: any) => void;
}> = ({ onLocationSelect }) => {
    const [location, setLocation] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const getCurrentLocation = async () => {
        setLoading(true);
        try {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const locationData = {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            timestamp: new Date().toISOString()
                        };
                        setLocation(locationData);
                        onLocationSelect(locationData);
                        setLoading(false);
                    },
                    (error) => {
                        console.error('Error getting location:', error);
                        setLoading(false);
                    }
                );
            } else {
                alert('Geolocation is not supported by this browser.');
                setLoading(false);
            }
        } catch (error) {
            console.error('Error getting location:', error);
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <MapPin className="h-5 w-5" />
                    <span>Location</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {location ? (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded">
                            <span className="text-green-800">Location captured</span>
                            <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                            <div>Lat: {location.latitude.toFixed(6)}</div>
                            <div>Lng: {location.longitude.toFixed(6)}</div>
                            <div>Time: {new Date(location.timestamp).toLocaleTimeString()}</div>
                        </div>
                    </div>
                ) : (
                    <Button
                        onClick={getCurrentLocation}
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Getting Location...
                            </>
                        ) : (
                            <>
                                <MapPin className="mr-2 h-4 w-4" />
                                Get Current Location
                            </>
                        )}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
};

const EmergencyAssistance: React.FC = () => {
    const [emergencyType, setEmergencyType] = useState<string>('');
    const [location, setLocation] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [requests, setRequests] = useState<ExtendedCareRequest[]>([]);

    const handleEmergencyRequest = async () => {
        if (!emergencyType) {
            alert('Please select an emergency type');
            return;
        }

        if (!location) {
            alert('Please get your current location first');
            return;
        }

        setLoading(true);

        try {
            // Mock API call - replace with actual API
            const response = await fetch('/api/extended-care/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    care_type: emergencyType,
                    location: location,
                    notes: 'Emergency assistance requested'
                }),
            });

            if (response.ok) {
                const newRequest = {
                    id: Date.now(),
                    care_type: emergencyType,
                    status: 'active',
                    request_date: new Date().toISOString(),
                    cost_incurred: 0,
                    coverage_applied: 0,
                    notes: 'Emergency assistance requested'
                };

                setRequests([newRequest, ...requests]);
                setEmergencyType('');
                alert('Emergency assistance requested successfully!');
            } else {
                alert('Failed to request assistance. Please try again.');
            }
        } catch (error) {
            console.error('Error requesting assistance:', error);
            alert('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800';
            case 'in_progress': return 'bg-yellow-100 text-yellow-800';
            case 'completed': return 'bg-blue-100 text-blue-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active': return <CheckCircle className="h-4 w-4 text-green-600" />;
            case 'in_progress': return <Clock className="h-4 w-4 text-yellow-600" />;
            case 'completed': return <CheckCircle className="h-4 w-4 text-blue-600" />;
            case 'cancelled': return <XCircle className="h-4 w-4 text-red-600" />;
            default: return null;
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                            <span>Emergency Assistance</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <EmergencyButton
                                type="accident"
                                label="Accident Assistance"
                                icon={<Car className="h-5 w-5" />}
                                onClick={() => setEmergencyType('accident')}
                                disabled={loading}
                            />
                            <EmergencyButton
                                type="breakdown"
                                label="Breakdown Assistance"
                                icon={<Car className="h-5 w-5" />}
                                onClick={() => setEmergencyType('breakdown')}
                                disabled={loading}
                            />
                            <EmergencyButton
                                type="medical"
                                label="Medical Assistance"
                                icon={<Heart className="h-5 w-5" />}
                                onClick={() => setEmergencyType('medical')}
                                disabled={loading}
                            />
                            <EmergencyButton
                                type="legal"
                                label="Legal Assistance"
                                icon={<Scale className="h-5 w-5" />}
                                onClick={() => setEmergencyType('legal')}
                                disabled={loading}
                            />
                        </div>

                        <LocationSelector onLocationSelect={setLocation} />

                        <Button
                            onClick={handleEmergencyRequest}
                            disabled={!emergencyType || !location || loading}
                            className="w-full bg-red-600 hover:bg-red-700 text-white py-3 text-lg font-semibold"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Requesting Assistance...
                                </>
                            ) : (
                                <>
                                    <AlertTriangle className="mr-2 h-4 w-4" />
                                    Request Emergency Assistance
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Emergency Contacts</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
                                <div className="flex items-center space-x-3">
                                    <Phone className="h-5 w-5 text-blue-600" />
                                    <div>
                                        <div className="font-semibold">Ambulance</div>
                                        <div className="text-sm text-blue-600">108</div>
                                    </div>
                                </div>
                                <Button size="sm" variant="outline">Call</Button>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded">
                                <div className="flex items-center space-x-3">
                                    <Phone className="h-5 w-5 text-red-600" />
                                    <div>
                                        <div className="font-semibold">Police</div>
                                        <div className="text-sm text-red-600">100</div>
                                    </div>
                                </div>
                                <Button size="sm" variant="outline">Call</Button>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded">
                                <div className="flex items-center space-x-3">
                                    <Phone className="h-5 w-5 text-yellow-600" />
                                    <div>
                                        <div className="font-semibold">Fire</div>
                                        <div className="text-sm text-yellow-600">101</div>
                                    </div>
                                </div>
                                <Button size="sm" variant="outline">Call</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Assistance Requests</CardTitle>
                </CardHeader>
                <CardContent>
                    {requests.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No assistance requests found
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {requests.map((request) => (
                                <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center space-x-4">
                                        <div className="p-2 bg-gray-100 rounded-full">
                                            {getStatusIcon(request.status)}
                                        </div>
                                        <div>
                                            <div className="font-semibold capitalize">{request.care_type.replace('_', ' ')} Assistance</div>
                                            <div className="text-sm text-gray-600">Requested: {new Date(request.request_date).toLocaleString()}</div>
                                            {request.notes && <div className="text-xs text-gray-500 mt-1">{request.notes}</div>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <Badge className={getStatusColor(request.status)}>
                                            {request.status}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default EmergencyAssistance;