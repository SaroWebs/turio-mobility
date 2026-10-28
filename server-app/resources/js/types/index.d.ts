export interface Auth {
    user: User | null;
}

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    [key: string]: unknown;
}

export interface UsersIndexProps {
    title: string;
    users: {
        data: AdminUser[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    roles: Array<{
        id: number;
        name: string;
    }>;
}

export interface AdminUser {
    id: number;
    name: string;
    email: string;
    phone: string;
    roles: Array<{
        id: number;
        name: string;
    }>;
}

export interface AdminPermission {
    id: number;
    name: string;
    display_name: string;
    group: string;
}

export interface AdminRole {
    id: number;
    name: string;
    display_name: string;
    description?: string;
    permissions: AdminPermission[];
    users_count?: number;
    permissions_count?: number;
    users?: AdminUser[];
}

export interface RolesIndexProps {
    title: string;
    roles: {
        data: AdminRole[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}

export interface RoleFormProps {
    title: string;
    permissions: AdminPermission[];
    grouped_permissions: Record<string, AdminPermission[]>;
    role?: AdminRole;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // This allows for additional properties...
}

export interface Itinerary {
    id: number;
    tour_id: number;
    day_index: number;
    time: string;
    place_id: number | null;
    details: string;
    created_at: string;
    updated_at: string;
    place?: Place | null;
    tour?: Tour;
}

export interface TourGuide {
    id: number;
    tour_id: number;
    name: string;
    experience: string;
    languages: string[];
    created_at: string;
    updated_at: string;
}

export interface TourDriver {
    id: number;
    tour_id: number;
    name: string;
    experience: string;
    license_number: string;
    created_at: string;
    updated_at: string;
}

export interface Tour {
    id: number;
    title: string;
    description: string;
    price: number;
    discount?: number;
    available_from: string;
    available_to: string;
    image_path?: string;
    created_at: string;
    updated_at: string;
    itineraries?: Itinerary[];
    guides?: TourGuide[];
    drivers?: TourDriver[];
    [key: string]: unknown;
}

export interface PlaceMedia {
    id: number;
    place_id: number;
    file_path: string;
    file_type: string;
    description?: string;
    created_at: string;
    updated_at: string;
}

export interface Place {
    id: number;
    name: string;
    description: string;
    lng: number;
    lat: number;
    status: string;
    created_at: string;
    updated_at: string;
    media?: PlaceMedia[];
    itineraries?: Itinerary[];
    [key: string]: unknown;
}
