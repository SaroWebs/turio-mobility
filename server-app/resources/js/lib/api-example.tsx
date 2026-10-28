import React, { useState, useEffect } from 'react';
import api from './api';

/**
 * Example component showing how to use axios for API calls
 * instead of TypeScript action controllers
 */
export default function ApiExample() {
    const [tours, setTours] = useState([]);
    const [carCategories, setCarCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load tours
            const toursResponse = await api.tours.index();
            setTours(toursResponse.data);

            // Load car categories
            const categoriesResponse = await api.carCategories.index();
            setCarCategories(categoriesResponse.data);

        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (email: string, password: string) => {
        try {
            const response = await api.auth.login({ email, password });
            console.log('Login successful:', response.data);
            // Handle successful login (redirect, store token, etc.)
        } catch (error) {
            console.error('Login failed:', error);
        }
    };

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <h2>Tours ({tours.length})</h2>
            <ul>
                {tours.map((tour: any) => (
                    <li key={tour.id}>{tour.title}</li>
                ))}
            </ul>

            <h2>Car Categories ({carCategories.length})</h2>
            <ul>
                {carCategories.map((category: any) => (
                    <li key={category.id}>{category.name}</li>
                ))}
            </ul>
        </div>
    );
}