import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import VehicleCamera, { type CameraPhoto } from './VehicleCamera';

export const photoSides = ['front', 'rear', 'left', 'right'] as const;
export type PhotoSide = typeof photoSides[number];
export type VehiclePhoto = CameraPhoto;
export type PhotoDrafts = Partial<Record<PhotoSide, VehiclePhoto>>;

export default function VehiclePhotos({ drafts, saved, onChange, disabled, editable = true }: {
  drafts: PhotoDrafts; saved: Partial<Record<PhotoSide, string>>; onChange: (side: PhotoSide, photo?: VehiclePhoto) => void; disabled: boolean; editable?: boolean;
}) {
  const [busy, setBusy] = useState<PhotoSide | null>(null);
  const picking = useRef(false);
  const [camera, setCamera] = useState<PhotoSide | null>(null);
  const [error, setError] = useState('');
  const accept = (side: PhotoSide, photo: VehiclePhoto) => {
    if ((photo.size || 0) > 10 * 1024 * 1024) { setError('Choose a photo no larger than 10 MB.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) { setError('Choose a JPG, PNG, or WebP photo.'); return; }
    setError('');
    onChange(side, photo);
  };
  const pick = async (side: PhotoSide, source: 'camera' | 'upload') => {
    if (picking.current || disabled) return;
    setError('');
    if (source === 'camera' && Platform.OS === 'web') { setCamera(side); return; }
    picking.current = true;
    setBusy(side);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { setError('Camera permission is needed to take a photo. You can upload one instead.'); return; }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9, allowsEditing: false };
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      accept(side, { uri: asset.uri, name: asset.fileName || `${side}.jpg`, type: asset.mimeType || 'image/jpeg', size: asset.fileSize, file: asset.file });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not select a photo. Please try again.'); }
    finally { picking.current = false; setBusy(null); }
  };
  const count = photoSides.filter((side) => drafts[side] || saved[side]).length;
  return <View style={styles.section}>
    <Text style={styles.heading}>Car photos</Text>
    <Text style={styles.copy}>Front, rear, left and right sides · {count} of 4 added</Text>
    {editable && <Text style={styles.copy}>Include the whole car in good light. JPG, PNG or WebP, up to 10 MB each.</Text>}
    <View style={styles.grid}>{photoSides.map((side) => {
      const uri = drafts[side]?.uri || saved[side];
      return <View key={side} style={styles.card}>
        <Text style={styles.label}>{side === 'left' || side === 'right' ? `${side} side` : side}</Text>
        {uri ? <Image source={{ uri }} accessibilityLabel={`${side} view of your car`} style={styles.image} /> : <View style={[styles.image, styles.placeholder]}><Text style={styles.copy}>No photo yet</Text></View>}
        {busy === side && <ActivityIndicator color="#0f766e" />}
        {editable && <>
          <Pressable accessibilityRole="button" accessibilityLabel={`Capture ${side} photo`} disabled={disabled || busy !== null} onPress={() => void pick(side, 'camera')} style={styles.button}><Text style={styles.buttonText}>Take photo</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Upload ${side} photo`} disabled={disabled || busy !== null} onPress={() => void pick(side, 'upload')} style={styles.button}><Text style={styles.buttonText}>{uri ? 'Replace photo' : 'Upload photo'}</Text></Pressable>
          {drafts[side] && <Pressable accessibilityRole="button" accessibilityLabel={`Undo ${side} photo selection`} disabled={disabled} onPress={() => onChange(side)} style={styles.button}><Text style={styles.copy}>Undo selection</Text></Pressable>}
        </>}
      </View>;
    })}</View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {camera && <VehicleCamera onClose={() => setCamera(null)} onCapture={(photo) => { accept(camera, photo); setCamera(null); }} />}
  </View>;
}
const styles = StyleSheet.create({ section: { marginTop: 20 }, heading: { fontSize: 20, fontWeight: '700', color: '#0f172a' }, copy: { fontSize: 14, lineHeight: 20, color: '#475569', marginTop: 5 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }, card: { width: '47%', flexGrow: 1, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' }, label: { fontSize: 16, fontWeight: '700', color: '#0f172a', textTransform: 'capitalize', marginBottom: 8 }, image: { width: '100%', aspectRatio: 1.5, borderRadius: 10, backgroundColor: '#e2e8f0' }, placeholder: { justifyContent: 'center', alignItems: 'center' }, button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1' }, buttonText: { fontSize: 14, fontWeight: '700', color: '#0f766e' }, error: { marginTop: 12, fontSize: 14, color: '#b91c1c' } });
