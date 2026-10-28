// Fallback for using icons on Android and web.
import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: string;
  size?: number;
  color: string;
  style?: StyleProp<TextStyle>;
  weight?: string;
}) {
  return <Text style={[{ fontSize: size, color }, style]}>●</Text>;
}
