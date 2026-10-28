import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Compass } from 'lucide-react-native';

export const MapView = ({ children, style }: any) => (
  <View style={[style, styles.placeholder]}>
    <Compass color="#64748b" size={48} />
    <Text style={styles.title}>Live Map Available on Mobile</Text>
    <Text style={styles.subtitle}>Native mapping components are not supported in web browsers.</Text>
  </View>
);

export const Marker = ({ children }: any) => null;
export const Polyline = () => null;
export const PROVIDER_GOOGLE = 'google';

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  title: {
    marginTop: 12,
    color: '#1e293b',
    fontWeight: '700',
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4
  }
});
