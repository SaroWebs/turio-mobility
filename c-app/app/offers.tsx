import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Tag, Sparkles } from 'lucide-react-native';
import { AccountPage, Action, Copy, Panel } from '../components/AccountPage';
import api from '../src/lib/api';
import { useAccountData } from '../src/lib/account';
import { Radius, useTheme } from '../src/constants/theme';

const fetchOffers = async () => (await api.get('/public/coupons/deals')).data.data as {
  code: string; name: string; description: string; discount_type: string; discount_value: number; min_order_amount: number; max_discount_amount: number | null; service_types: string[]; ends_at: string | null;
}[];

export default function OffersScreen() {
  const { data, ...state } = useAccountData(fetchOffers);
  const router = useRouter();
  const { colors, isDark } = useTheme();

  return (
    <AccountPage title="Exclusive Offers" {...state}>
      <Copy>Use these verified promotional codes at checkout. Eligibility and final savings are calculated automatically.</Copy>
      {data?.length === 0 && (
        <Panel title="No offers right now">
          <Copy>Check back before your next journey for seasonal deals.</Copy>
        </Panel>
      )}
      {data?.map(offer => (
        <Panel key={offer.code} title={offer.name || offer.code}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 }}>
            <View style={{ backgroundColor: isDark ? 'rgba(245,158,11,0.2)' : '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Tag size={12} color="#F59E0B" />
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#D97706', letterSpacing: 0.8 }}>{offer.code}</Text>
            </View>
            <View style={{ backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#10B981' }}>
                {offer.discount_type === 'percent' ? `${offer.discount_value}% OFF` : `₹${offer.discount_value} OFF`}
              </Text>
            </View>
          </View>
          <Copy>{offer.description}</Copy>
          <Copy>Min booking ₹{offer.min_order_amount}{offer.max_discount_amount ? ` · Max savings ₹${offer.max_discount_amount}` : ''}</Copy>
          <Copy>Applies to: {offer.service_types.join(', ')}{offer.ends_at ? ` · Ends ${new Date(offer.ends_at).toLocaleDateString('en-IN')}` : ''}</Copy>
          <Action label="Book with this Offer" onPress={() => router.push('/(tabs)/services')} />
        </Panel>
      ))}
    </AccountPage>
  );
}
