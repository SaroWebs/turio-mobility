import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from '@/lib/axios';
import { router } from '@inertiajs/react';

interface User {
    id: number;
    name: string;
    email?: string;
    phone?: string;
    avatar?: string;
    role: 'admin' | 'customer' | 'driver' | 'guide';
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (token: string, user: User, remember?: boolean) => void;
    logout: () => Promise<void>;
    updateUser: (user: User) => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
    const [isLoading, setIsLoading] = useState(true);

    const logout = useCallback(async () => {
        try {
            if (token) {
                // Determine logout endpoint based on role if needed, 
                // but usually one logout endpoint handles the current token.
                const endpoint = user?.role === 'driver' ? '/driver-app/logout' : '/customer-app/logout';
                await axios.post(endpoint);
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
            setToken(null);
            setUser(null);
            // Redirect to login if on admin routes
            if (window.location.pathname.startsWith('/admin')) {
                router.visit('/login');
            }
        }
    }, [token, user]);

    const login = useCallback((newToken: string, newUser: User, remember: boolean = true) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('auth_token', newToken);
        localStorage.setItem('auth_user', JSON.stringify(newUser));
        
        // Server app is admin panel only
        if (newUser.role === 'admin') {
            router.visit('/admin/dashboard');
            return;
        }

        router.visit('/login');
    }, []);

    const updateUser = useCallback((newUser: User) => {
        setUser(newUser);
        localStorage.setItem('auth_user', JSON.stringify(newUser));
    }, []);

    const refreshUser = useCallback(async () => {
        if (!token) {
            setIsLoading(false);
            return;
        }

        try {
            // Check session/token validity and get fresh user data
            // We'll try customer-app/me first, if it fails and role was driver, try driver-app/me
            const savedUser = localStorage.getItem('auth_user');
            const parsedUser = savedUser ? JSON.parse(savedUser) : null;
            
            const endpoint = parsedUser?.role === 'driver' ? '/driver-app/me' : '/customer-app/me';
            const response = await axios.get(endpoint);
            
            if (response.data.success) {
                const fetchedUser = response.data.customer || response.data.driver || response.data.user;
                // Ensure role is preserved or mapped
                const roleMappedUser = {
                    ...fetchedUser,
                    role: fetchedUser.role || parsedUser?.role || 'customer'
                };
                setUser(roleMappedUser);
                localStorage.setItem('auth_user', JSON.stringify(roleMappedUser));
            }
        } catch (error: any) {
            console.error('Session refresh failed:', error);
            if (error.response?.status === 401) {
                logout();
            }
        } finally {
            setIsLoading(false);
        }
    }, [token, logout]);

    useEffect(() => {
        const savedUser = localStorage.getItem('auth_user');
        if (savedUser && token) {
            setUser(JSON.parse(savedUser));
            // Verify token/user silently
            refreshUser();
        } else {
            setIsLoading(false);
        }
    }, []);

    return (
        <AuthContext.Provider 
            value={{ 
                user, 
                token, 
                isAuthenticated: !!token && !!user, 
                isLoading, 
                login, 
                logout, 
                updateUser,
                refreshUser
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
