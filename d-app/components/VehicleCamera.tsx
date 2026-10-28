export type CameraPhoto = { uri: string; name: string; type: string; file?: File; size?: number };
export type CameraProps = { onCapture: (photo: CameraPhoto) => void; onClose: () => void };

// Native capture uses expo-image-picker; the web implementation uses a webcam.
export default function VehicleCamera(_props: CameraProps) { return null; }
