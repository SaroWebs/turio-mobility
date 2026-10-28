import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import SecureStore from './secure-store';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
const developmentHost = Constants.expoConfig?.hostUri?.replace(/:\d+$/, '')
    || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');

export const API_URL = configuredApiUrl || `http://${developmentHost}:8000/api/customer-app`;

export function apiErrorMessage(error: any, fallback = 'Something went wrong. Please try again.'): string {
    const message = error?.response?.data?.message;
    if (typeof message === 'string' && message.trim()) return message;
    const validationErrors = error?.response?.data?.errors;
    if (validationErrors && typeof validationErrors === 'object') {
        const firstValidationError = Object.values(validationErrors)
            .flat()
            .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
        if (firstValidationError) return firstValidationError;
    }
    if (error?.request) {
        return `Could not reach ${API_URL}. Keep your phone and development server on the same Wi-Fi.`;
    }
    return error?.message || fallback;
}

const api = axios.create({
    baseURL: API_URL,
    timeout: 15000,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
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
