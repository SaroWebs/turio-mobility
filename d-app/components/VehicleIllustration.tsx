import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

const paint: Record<string, string> = { White: '#f8fafc', Silver: '#cbd5e1', Grey: '#64748b', Black: '#1e293b', Blue: '#2563eb', Red: '#dc2626', Brown: '#854d0e', Beige: '#d6c5a3', Green: '#15803d', Yellow: '#facc15', Orange: '#ea580c', Gold: '#ca8a04', Purple: '#9333ea' };

export default function VehicleIllustration({ make, model, year, color, fuel, seats, bodyType }: {
  make: string; model: string; year: string; color: string; fuel: string; seats: string; bodyType?: string;
}) {
  const tall = bodyType === 'suv' || bodyType === 'tempo_traveller' || Number(seats) > 5;
  const fill = paint[color] || '#94a3b8';
  return <View style={styles.card}>
    <Text style={styles.eyebrow}>YOUR CAR · ILLUSTRATED PREVIEW</Text>
    <Svg width="100%" height={170} viewBox="0 0 400 190" accessibilityLabel={`${color || ''} ${make || 'car'} ${model || ''} illustration`}>
      <Ellipse cx="200" cy="162" rx="168" ry="12" fill="#cbd5e1" opacity={0.5} />
      <Path d={tall ? 'M35 115 L55 55 Q60 45 82 45 L255 45 Q276 46 312 98 L359 108 Q373 112 373 140 L364 151 L34 151 L27 132 Z' : 'M28 119 L79 103 L123 62 Q130 54 148 54 L237 54 Q260 57 301 102 L356 113 Q373 118 373 142 L360 151 L32 151 L26 136 Z'} fill={fill} stroke="#475569" strokeWidth="2" />
      <Path d={tall ? 'M74 56 L151 56 L151 98 L59 98 Z M161 56 L249 56 Q265 56 295 98 L161 98 Z' : 'M130 66 L181 66 L181 99 L94 99 Z M191 66 L237 66 Q251 69 283 99 L191 99 Z'} fill="#bae6fd" stroke="#475569" strokeWidth="2" />
      <Path d="M184 107 L184 143 M84 108 L308 108" stroke="#64748b" strokeWidth="2" />
      <Rect x="159" y="115" width="15" height="4" rx="2" fill="#475569" />
      <Rect x="269" y="115" width="15" height="4" rx="2" fill="#475569" />
      <Rect x="344" y="116" width="23" height="10" rx="3" fill="#fef3c7" />
      <Rect x="32" y="119" width="13" height="9" rx="2" fill="#ef4444" />
      {[91, 307].map((cx) => <React.Fragment key={cx}><Circle cx={cx} cy="148" r="26" fill="#0f172a" /><Circle cx={cx} cy="148" r="15" fill="#94a3b8" /><Circle cx={cx} cy="148" r="7" fill="#e2e8f0" /></React.Fragment>)}
    </Svg>
    <Text style={styles.title}>{[year, make, model].filter(Boolean).join(' ') || 'Choose your car details'}</Text>
    <Text style={styles.copy}>{[color, fuel, seats ? `${seats} seats` : ''].filter(Boolean).join(' · ')}</Text>
    <Text style={styles.caption}>Illustration based on your selections. Exact model appearance may differ.</Text>
  </View>;
}
const styles = StyleSheet.create({ card: { marginTop: 16, borderRadius: 20, padding: 16, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' }, eyebrow: { fontSize: 12, fontWeight: '800', color: '#065f46' }, title: { fontSize: 18, fontWeight: '700', color: '#0f172a' }, copy: { marginTop: 5, fontSize: 14, color: '#334155' }, caption: { marginTop: 10, fontSize: 12, color: '#475569', lineHeight: 18 } });
