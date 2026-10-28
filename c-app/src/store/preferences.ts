import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type Preferences = {
  appearance: 'system' | 'light' | 'dark';
  payment: 'cash' | 'wallet' | 'upi';
  setAppearance: (appearance: Preferences['appearance']) => void;
  setPayment: (payment: Preferences['payment']) => void;
};

export const usePreferences = create<Preferences>()(persist((set) => ({
  appearance: 'system',
  payment: 'cash',
  setAppearance: appearance => set({ appearance }),
  setPayment: payment => set({ payment }),
}), { name: 'customer-device-preferences', storage: createJSONStorage(() => AsyncStorage) }));
