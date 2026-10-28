import { create } from 'zustand';
import SecureStore from '../lib/secure-store';
import api from '../lib/api';
import { LocationService } from '../services/LocationService';

interface DriverUser {
    id: number;
    name: string;
    phone: string;
    status: string;
    is_approved: boolean;
    is_active: boolean;
    is_online: boolean;
    vehicle_number: string;
}

export interface DriverProfileInput {
    phone: string;
    registration_token: string;
    name: string;
    email: string | null;
    license_number?: string;
    license_expiry?: string | null;
    vehicle_type?: string;
    vehicle_number?: string;
    vehicle_model?: string | null;
    service_types: string[];
}

export type OtpLoginResult =
    | { success: false }
    | { success: true; requiresProfile: false }
    | { success: true; requiresProfile: true; registrationToken: string };

interface AuthState {
    token: string | null;
    user: DriverUser | null;
    isLoading: boolean;
    error: string | null;
    checkAuth: () => Promise<void>;
    loginWithOTP: (phone: string, code: string) => Promise<OtpLoginResult>;
    completeProfile: (profile: DriverProfileInput) => Promise<boolean>;
    logout: () => Promise<void>;
    setOnlineStatus: (status: boolean) => void;
    setDriver: (driver: DriverUser) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    user: null,
    isLoading: true,
    error: null,
    setDriver: (user) => set({ user }),

    checkAuth: async () => {
        set({ isLoading: true });
        try {
            const token = await SecureStore.getItemAsync('auth_token');
            if (token) {
                const response = await api.get('/me');
                set({ token, user: response.data.driver, isLoading: false });
            } else {
                set({ isLoading: false });
            }
        } catch {
            await SecureStore.deleteItemAsync('auth_token');
            set({ token: null, user: null, isLoading: false });
        }
    },

    loginWithOTP: async (phone, code) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post('/otp/verify', { phone, code });
            if (response.data.requires_profile) {
                const registrationToken = response.data.registration_token;
                if (!registrationToken) {
                    throw new Error('OTP verification did not return a registration session.');
                }

                set({ isLoading: false });
                return { success: true, requiresProfile: true, registrationToken };
            }

            const { token, driver } = response.data;
            if (!token || !driver) {
                throw new Error('OTP verification completed without an authenticated driver.');
            }

            await SecureStore.setItemAsync('auth_token', token);
            set({ token, user: driver, isLoading: false });
            return { success: true, requiresProfile: false };
        } catch (error: any) {
            set({ error: error.response?.data?.message || error.message || 'Login failed', isLoading: false });
            return { success: false };
        }
    },

    completeProfile: async (profile) => {
        // Keep the registration form mounted while saving, including on errors.
        set({ error: null });
        try {
            const response = await api.post('/otp/register-complete', profile);
            const { token, driver } = response.data;
            if (!token || !driver) {
                throw new Error('Profile completion did not return an authenticated driver.');
            }

            await SecureStore.setItemAsync('auth_token', token);
            set({ token, user: driver, isLoading: false });
            return true;
        } catch (error: any) {
            set({ error: error.response?.data?.message || error.message || 'Profile completion failed', isLoading: false });
            return false;
        }
    },

    logout: async () => {
        await LocationService.stopTracking().catch(() => undefined);
        try { await api.post('/logout'); } catch {}
        await SecureStore.deleteItemAsync('auth_token');
        set({ token: null, user: null });
    },

    setOnlineStatus: (is_online) => set((state) => ({
        user: state.user ? { ...state.user, is_online } : null
    }))
}));
