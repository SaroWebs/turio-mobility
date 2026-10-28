import axios from './axios';

// API service functions to replace TypeScript action controllers
export const api = {
    // Authentication
    auth: {
        login: (credentials: { email: string; password: string }) =>
            axios.post('/login', credentials),
        logout: () =>
            axios.post('/logout'),
        dashboard: () =>
            axios.get('/dashboard'),
    },

    // Tours
    tours: {
        index: (params?: { [key: string]: any }) =>
            axios.get('/tours', { params }),
    },

    // Places
    places: {
        index: (params?: { [key: string]: any }) =>
            axios.get('/places', { params }),
    },

    // Car Categories
    carCategories: {
        index: (params?: { type?: string }) =>
            axios.get('/car-categories', { params }),
    },

    // Destinations
    destinations: {
        index: (params?: { state?: string; type?: string }) =>
            axios.get('/destinations', { params }),
    },

    // Admin routes (these would typically require authentication)
    admin: {
        dashboard: () =>
            axios.get('/admin/dashboard'),
        users: (params?: { [key: string]: any }) =>
            axios.get('/admin/users', { params }),
        tours: (params?: { [key: string]: any }) =>
            axios.get('/admin/tours', { params }),
        bookings: (params?: { [key: string]: any }) =>
            axios.get('/admin/bookings', { params }),
        places: (params?: { [key: string]: any }) =>
            axios.get('/admin/places', { params }),
        settings: () =>
            axios.get('/admin/settings'),
    },
};

export default api;