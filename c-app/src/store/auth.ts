import { create } from 'zustand';
import SecureStore from '../lib/secure-store';
import api from '../lib/api';

let authCheckRevision = 0;

export interface CustomerUser {
    id: number;
    name: string;
    phone: string;
    email: string;
    profile_photo?: string | null;
    profile_photo_url?: string | null;
    gender?: 'male' | 'female' | 'other' | string | null;
    date_of_birth?: string | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
    wallet_balance: number;
}

interface AuthState {
    token: string | null;
    user: CustomerUser | null;
    isLoading: boolean;
    error: string | null;
    checkAuth:       () => Promise<void>;
    loginWithOTP:    (phone: string, code: string) => Promise<boolean>;
    registerWithOTP: (phone: string, code: string, name: string) => Promise<boolean>;
    updateUser:      (user: CustomerUser) => void;
    logout:          () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    user: null,
    isLoading: true,
    error: null,
    updateUser: (user) => set({ user }),

    checkAuth: async () => {
        const revision = ++authCheckRevision;
        set({ isLoading: true });
        try {
            const token = await SecureStore.getItemAsync('auth_token');
            if (revision !== authCheckRevision) return;
            if (token) {
                const response = await api.get('/me');
                if (revision !== authCheckRevision) return;
                if (await SecureStore.getItemAsync('auth_token') !== token) {
                    set({ token: null, user: null, isLoading: false });
                    return;
                }
                set({ token, user: response.data.customer, isLoading: false });
            } else {
                set({ token: null, user: null, isLoading: false });
            }
        } catch {
            if (revision !== authCheckRevision) return;
            await SecureStore.deleteItemAsync('auth_token');
            set({ token: null, user: null, isLoading: false });
        }
    },

    loginWithOTP: async (phone, code) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post('/otp/verify', { phone, code, action: 'login' });
            const { token, customer } = response.data;
            await SecureStore.setItemAsync('auth_token', token);
            set({ token, user: customer, isLoading: false });
            return true;
        } catch (error: any) {
            set({ error: error.response?.data?.message || 'Verification failed', isLoading: false });
            return false;
        }
    },

    registerWithOTP: async (phone, code, name) => {
        set({ isLoading: true, error: null });
        try {
            const verification = await api.post('/otp/verify', {
                phone,
                code,
                action: 'register',
                name,
            });

            const response = verification.data.requires_registration
                ? await api.post('/otp/register-complete', {
                    phone,
                    name,
                    registration_token: verification.data.registration_token,
                })
                : verification;

            const { token, customer } = response.data;
            if (!token || !customer) {
                throw new Error('Registration completed without an authentication token.');
            }
            await SecureStore.setItemAsync('auth_token', token);
            set({ token, user: customer, isLoading: false });
            return true;
        } catch (error: any) {
            set({ error: error.response?.data?.message || 'Registration failed', isLoading: false });
            return false;
        }
    },

    logout: async () => {
        authCheckRevision++;
        try { await api.post('/logout'); } catch {}
        await SecureStore.deleteItemAsync('auth_token');
        set({ token: null, user: null, isLoading: false, error: null });
    }
}));
