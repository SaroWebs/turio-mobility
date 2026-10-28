import { googleMapsMapId, loadGoogleMaps } from '@/lib/google-maps';
import { Loader, Text } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';

export interface ResolvedMapLocation {
    latitude: number;
    longitude: number;
    googlePlaceId?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
}

interface PlaceLocationMapProps {
    latitude: number;
    longitude: number;
    editable?: boolean;
    onLocationChange?: (location: ResolvedMapLocation) => void;
}

const componentValue = (result: google.maps.GeocoderResult, type: string) =>
    result.address_components.find((component) => component.types.includes(type))?.long_name;

export default function PlaceLocationMap({ latitude, longitude, editable = false, onLocationChange }: PlaceLocationMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
    const callbackRef = useRef(onLocationChange);
    const initialPositionRef = useRef({ lat: latitude, lng: longitude });
    const [status, setStatus] = useState('Loading Google map…');
    callbackRef.current = onLocationChange;

    useEffect(() => {
        let active = true;
        const listeners: google.maps.MapsEventListener[] = [];

        void loadGoogleMaps()
            .then(async (maps) => {
                if (!active || !containerRef.current) return;
                const { AdvancedMarkerElement } = await maps.maps.importLibrary('marker') as google.maps.MarkerLibrary;
                if (!active || !containerRef.current) return;
                const position = initialPositionRef.current;
                const map = new maps.maps.Map(containerRef.current, {
                    center: position,
                    zoom: 16,
                    mapId: googleMapsMapId(),
                    mapTypeControl: false,
                    fullscreenControl: true,
                    streetViewControl: true,
                    clickableIcons: true,
                    gestureHandling: editable ? 'greedy' : 'cooperative',
                });
                const marker = new AdvancedMarkerElement({
                    map,
                    position,
                    gmpDraggable: editable,
                    title: 'Exact place location',
                });
                const geocoder = new maps.maps.Geocoder();
                mapRef.current = map;
                markerRef.current = marker;
                setStatus(editable ? 'Drag the pin or click the map to set the exact location.' : 'Exact saved location');

                const resolvePosition = (next: google.maps.LatLngLiteral) => {
                    marker.position = next;
                    map.panTo(next);
                    geocoder.geocode({ location: next }, (results, geocodeStatus) => {
                        const result = geocodeStatus === 'OK' ? results?.[0] : undefined;
                        callbackRef.current?.({
                            latitude: next.lat,
                            longitude: next.lng,
                            googlePlaceId: result?.place_id,
                            address: result?.formatted_address,
                            city: result ? componentValue(result, 'locality') || componentValue(result, 'administrative_area_level_2') : undefined,
                            state: result ? componentValue(result, 'administrative_area_level_1') : undefined,
                            country: result ? componentValue(result, 'country') : undefined,
                        });
                        setStatus(result ? 'Pin resolved to Google place data. Save to synchronize.' : 'Coordinates updated; Google could not resolve this pin.');
                    });
                };

                if (editable) {
                    listeners.push(marker.addListener('dragend', () => {
                        const next = marker.position;
                        if (next) {
                            resolvePosition(next instanceof maps.maps.LatLng ? next.toJSON() : { lat: next.lat, lng: next.lng });
                        }
                    }));
                    listeners.push(map.addListener('click', (event: google.maps.MapMouseEvent) => {
                        if (event.latLng) resolvePosition(event.latLng.toJSON());
                    }));
                }
            })
            .catch(() => setStatus('Google map is unavailable. Coordinates can still be edited below.'));

        return () => {
            active = false;
            listeners.forEach((listener) => listener.remove());
            if (markerRef.current) markerRef.current.map = null;
        };
    }, [editable]);

    useEffect(() => {
        const position = { lat: latitude, lng: longitude };
        if (markerRef.current) markerRef.current.position = position;
        mapRef.current?.panTo(position);
    }, [latitude, longitude]);

    return (
        <div>
            <div
                ref={containerRef}
                className="h-72 w-full overflow-hidden rounded-xl border border-white/10 bg-neutral-950"
                role="img"
                aria-label={`Map pin at latitude ${latitude}, longitude ${longitude}`}
            />
            <div className="mt-2 flex min-h-6 items-center gap-2">
                {status.startsWith('Loading') ? <Loader size="xs" color="yellow" /> : null}
                <Text size="xs" c="dimmed">{status}</Text>
            </div>
        </div>
    );
}
