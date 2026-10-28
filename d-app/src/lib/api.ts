import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import SecureStore from './secure-store';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
const developmentHost = Constants.expoConfig?.hostUri?.replace(/:\d+$/, '')
    || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');

export const API_URL = configuredApiUrl || `http://${developmentHost}:8000/api/driver-app`;

export function apiErrorMessage(error: any, fallback = 'Something went wrong.'): string {
    const data = error?.response?.data;

    if (data?.errors && typeof data.errors === 'object') {
        const details = Object.values(data.errors as Record<string, unknown>)
            .flatMap((value) => Array.isArray(value) ? value : [value])
            .filter((value): value is string => typeof value === 'string')
            .join('\n');

        if (details) return details;
    }

    if (typeof data?.message === 'string') {
        const status = error?.response?.status;
        return __DEV__ && status ? `${data.message} (HTTP ${status})` : data.message;
    }

    if (error?.response) {
        return `${fallback} (HTTP ${error.response.status})`;
    }

    if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
        return 'The request timed out. Refresh to check whether your changes were saved before trying again.';
    }

    if (error?.request) {
        return Platform.OS === 'web'
            ? `Could not reach ${API_URL}. Check that the development API server is running and accessible from this browser.`
            : `Could not reach ${API_URL}. Keep your phone and development server on the same Wi-Fi.`;
    }

    return error?.message || fallback;
}

const api = axios.create({
    baseURL: API_URL,
    timeout: 15000,
    headers: {
        'Accept': 'application/json',
    },
});

api.interceptors.request.use(async (config) => {
    try {
        const token = await SecureStore.getItemAsync('auth_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch {}
    return config;
});

api.interceptors.response.use(response => response, async error => {
    if (error.response?.status === 401) {
        await SecureStore.deleteItemAsync('auth_token');
        const { useAuthStore } = await import('../store/auth');
        useAuthStore.setState({ token: null, user: null, isLoading: false });
    }
    return Promise.reject(error);
});

export default api;
