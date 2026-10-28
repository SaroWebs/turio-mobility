import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CameraProps } from './VehicleCamera';

export default function VehicleCamera({ onCapture, onClose }: CameraProps) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera needs HTTPS or localhost. You can upload a photo instead.');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        if (video.current) { video.current.srcObject = stream; await video.current.play(); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Camera unavailable. Upload a photo instead.');
      }
    })();
    return () => { cancelled = true; stream?.getTracks().forEach((track) => track.stop()); };
  }, []);
  const capture = () => {
    if (!video.current?.videoWidth) return;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1920 / video.current.videoWidth);
    canvas.width = video.current.videoWidth * scale;
    canvas.height = video.current.videoHeight * scale;
    canvas.getContext('2d')?.drawImage(video.current, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) { setError('Could not capture the photo. Please try again.'); return; }
      const file = new File([blob], 'car.jpg', { type: 'image/jpeg' });
      onCapture({ uri: URL.createObjectURL(file), name: file.name, type: file.type, file, size: file.size });
    }, 'image/jpeg', 0.9);
  };
  return <Modal visible onRequestClose={onClose} animationType="slide"><View style={styles.screen}>
    <Text style={styles.title}>Capture your car</Text>
    <Text style={styles.copy}>Keep the whole side of the car in view.</Text>
    <video ref={video} autoPlay muted playsInline onLoadedData={() => setReady(true)} style={{ width: '100%', maxHeight: '65vh', background: '#0f172a', borderRadius: 16 }} />
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={!ready || Boolean(error)} onPress={capture} style={[styles.button, (!ready || error) && { opacity: 0.5 }]}><Text style={styles.buttonText}>Take photo</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancel}><Text style={styles.copy}>Cancel</Text></Pressable>
  </View></Modal>;
}
const styles = StyleSheet.create({ screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: '#fff' }, title: { fontSize: 24, fontWeight: '700', color: '#0f172a' }, copy: { fontSize: 16, color: '#475569' }, error: { color: '#b91c1c', fontSize: 16 }, button: { minHeight: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f766e', borderRadius: 12 }, buttonText: { color: '#fff', fontWeight: '700' }, cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center' } });
