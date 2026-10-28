import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import DateTimeField from '../../components/DateTimeField';
import { localDateValue, parseLocalDate } from '../../src/lib/dates';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useRouter } from 'expo-router';
import {
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  CreditCard,
  FileClock,
  Heart,
  Image as LucideImage,
  LogOut,
  Mail,
  Pencil,
  Phone,
  Settings,
  ShieldCheck,
  User,
  Wallet,
  X,
} from 'lucide-react-native';
import { useAuthStore } from '../../src/store/auth';
import { CardShadow, Radius, Spacing, Typography, useTheme } from '../../src/constants/theme';
import api, { apiErrorMessage } from '../../src/lib/api';
import { useAccountData } from '../../src/lib/account';

const fetchWallet = async () => (await api.get('/wallet')).data.data as { balance: string; balance_minor?: number };

const getNativeImagePicker = async () => {
  try {
    if (!requireOptionalNativeModule('ExponentImagePicker')) return null;
    const ImagePicker = await import('expo-image-picker');
    return ImagePicker;
  } catch {
    return null;
  }
};

export default function AccountScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user, updateUser, logout } = useAuthStore();
  const { data: wallet, error: walletError, reload: reloadWallet } = useAccountData(fetchWallet);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoSheetVisible, setPhotoSheetVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Edit form state
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [gender, setGender] = useState<string>(user?.gender || '');
  const [dateOfBirth, setDateOfBirth] = useState<string>(user?.date_of_birth ? user.date_of_birth.split('T')[0] : '');
  const [emergencyContactName, setEmergencyContactName] = useState(user?.emergency_contact_name || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(user?.emergency_contact_phone || '');

  const initials = (user?.name || 'Turiya Mobility customer').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  const openEditModal = () => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setGender(user?.gender || '');
    setDateOfBirth(user?.date_of_birth ? user.date_of_birth.split('T')[0] : '');
    setEmergencyContactName(user?.emergency_contact_name || '');
    setEmergencyContactPhone(user?.emergency_contact_phone || '');
    setEditError(null);
    setEditModalVisible(true);
  };

  const uploadPhoto = async (data: { uri?: string; base64?: string }) => {
    setUploadingPhoto(true);
    try {
      let res;
      if (data.base64) {
        const cleanBase64 = data.base64.startsWith('data:')
          ? data.base64
          : `data:image/jpeg;base64,${data.base64}`;
        res = await api.post('/profile/photo', {
          photo_base64: cleanBase64,
        });
      } else if (data.uri) {
        const formData = new FormData();
        const filename = data.uri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        formData.append('photo', {
          uri: data.uri,
          name: filename,
          type,
        } as any);

        res = await api.post('/profile/photo', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      if (res?.data?.customer) {
        updateUser(res.data.customer);
        Alert.alert('Success', 'Profile photo updated successfully!');
      }
    } catch (err: any) {
      Alert.alert('Upload Error', apiErrorMessage(err, 'Failed to upload photo.'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const promptPhotoPicker = () => {
    setPhotoSheetVisible(true);
  };

  const pickImage = async (useCamera: boolean) => {
    try {
      if (Platform.OS === 'web') {
        if (typeof document !== 'undefined') {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          if (useCamera) {
            input.setAttribute('capture', 'user');
          }
          input.onchange = (e: any) => {
            const file = e.target?.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = async () => {
                const base64Url = (reader.result as string) || '';
                await uploadPhoto({ base64: base64Url });
              };
              reader.readAsDataURL(file);
            }
          };
          input.click();
          return;
        }
      }

      const ImagePicker = await getNativeImagePicker();
      if (!ImagePicker) {
        Alert.alert('Photo picker unavailable', 'Please update the app to a build that includes camera and gallery access.');
        return;
      }

      if (useCamera) {
        if (!ImagePicker.requestCameraPermissionsAsync || !ImagePicker.launchCameraAsync) {
          Alert.alert('Camera Unavailable', 'Camera is not supported on this device.');
          return;
        }
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Denied', 'Camera permission is required to capture your photo.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.8,
          base64: true,
        });
        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          await uploadPhoto({ uri: asset.uri, base64: asset.base64 || undefined });
        }
      } else {
        if (!ImagePicker.requestMediaLibraryPermissionsAsync || !ImagePicker.launchImageLibraryAsync) {
          Alert.alert('Gallery Unavailable', 'Media library is not supported on this device.');
          return;
        }
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Denied', 'Media library permission is required to select a photo.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.8,
          base64: true,
        });
        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          await uploadPhoto({ uri: asset.uri, base64: asset.base64 || undefined });
        }
      }
    } catch (err: any) {
      console.warn('Image picker error:', err);
      Alert.alert('Photo selection failed', 'Could not open the camera or gallery. Please try again.');
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      setEditError('Name cannot be empty.');
      return;
    }
    setSavingProfile(true);
    setEditError(null);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        email: email.trim() || null,
        gender: gender || null,
        date_of_birth: dateOfBirth.trim() || null,
        emergency_contact_name: emergencyContactName.trim() || null,
        emergency_contact_phone: emergencyContactPhone.trim() || null,
      };

      const res = await api.put('/profile', payload);
      if (res.data?.customer) {
        updateUser(res.data.customer);
      }
      setEditModalVisible(false);
      Alert.alert('Profile Updated', 'Your profile details have been successfully saved.');
    } catch (err: any) {
      setEditError(apiErrorMessage(err, 'Failed to update profile.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const menuItems = [
    { icon: FileClock, label: 'My journeys', detail: 'Bookings and travel history', color: '#2563EB', bg: isDark ? 'rgba(37,99,235,0.18)' : '#EFF6FF', onPress: () => router.push('/(tabs)/activity') },
    { icon: Wallet, label: 'Wallet', detail: walletError ? 'Balance unavailable' : wallet ? `₹${Number(wallet.balance_minor !== undefined ? wallet.balance_minor / 100 : wallet.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Loading balance…', color: '#10B981', bg: isDark ? 'rgba(16,185,129,0.18)' : '#ECFDF5', onPress: () => router.push('/wallet') },
    { icon: Heart, label: 'Saved places', detail: 'Tours and destinations', color: '#EC4899', bg: isDark ? 'rgba(236,72,153,0.18)' : '#FDF2F8', onPress: () => router.push('/saved-places') },
    { icon: CreditCard, label: 'Payment methods', detail: 'Cash, wallet and UPI', color: '#F59E0B', bg: isDark ? 'rgba(245,158,11,0.18)' : '#FEF3C7', onPress: () => router.push('/payment-methods') },
    { icon: ShieldCheck, label: 'Safety and privacy', detail: 'Protection and data controls', color: '#6366F1', bg: isDark ? 'rgba(99,102,241,0.18)' : '#EEF2FF', onPress: () => router.push('/safety-privacy') },
    { icon: Settings, label: 'Preferences', detail: 'Appearance and notifications', color: '#8B5CF6', bg: isDark ? 'rgba(139,92,246,0.18)' : '#F5F3FF', onPress: () => router.push('/preferences') },
    { icon: CircleHelp, label: 'Help centre', detail: 'Support for your journey', color: '#06B6D4', bg: isDark ? 'rgba(6,182,212,0.18)' : '#ECFEFF', onPress: () => router.push('/help-center') },
  ];

  const confirmLogout = () => setLogoutConfirmVisible(true);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.brand }]}>YOUR ACCOUNT</Text>
          <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!!walletError && (
          <Pressable accessibilityRole="button" onPress={() => void reloadWallet()}>
            <Text style={{ color: colors.error, fontSize: 12 }}>Could not refresh wallet balance. Tap to retry.</Text>
          </Pressable>
        )}
        <View style={[styles.profileCard, { backgroundColor: isDark ? '#18181B' : '#0F172A' }, CardShadow]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
            onPress={promptPhotoPicker}
            style={styles.avatarWrapper}
          >
            {user?.profile_photo_url ? (
              <Image source={{ uri: user.profile_photo_url }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials || 'H'}</Text>
              </View>
            )}
            <View style={[styles.cameraBadge, { backgroundColor: colors.brand }]}>
              {uploadingPhoto ? (
                <ActivityIndicator size={10} color="#fff" />
              ) : (
                <Camera size={11} color="#fff" />
              )}
            </View>
          </Pressable>

          <View style={styles.profileCopy}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.userName} numberOfLines={1}>{user?.name || 'Turiya Mobility Member'}</Text>
              <Text style={{ fontSize: 14 }}>👑</Text>
            </View>
            <Text style={styles.userPhone}>{user?.phone ? `+91 ${user.phone}` : 'Mobile number not available'}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tap to edit details"
              onPress={openEditModal}
              style={({ pressed }) => [
                styles.tapToEditBtn,
                pressed && styles.pressed,
              ]}
            >
              <Pencil size={11} color="#93C5FD" strokeWidth={2.4} />
              <Text style={styles.tapToEditText}>Tap to edit details</Text>
            </Pressable>
          </View>

          <View style={styles.cardActionsCol}>
            <View style={styles.verified}>
              <ShieldCheck size={11} color="#10B981" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          </View>
        </View>

        <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }, CardShadow]}>
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.menuRow,
                  index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
                  <Icon size={19} color={item.color} strokeWidth={2.2} />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.menuDetail, { color: colors.textSecondary }]}>{item.detail}</Text>
                </View>
                <ChevronRight size={17} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={confirmLogout}
          style={({ pressed }) => [
            styles.logout,
            { borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FCA5A5', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2' },
            pressed && styles.pressed,
          ]}
        >
          <LogOut size={18} color="#EF4444" />
          <Text style={[styles.logoutText, { color: '#EF4444' }]}>Sign out</Text>
        </Pressable>

        <Text style={[styles.version, { color: colors.textMuted }]}>Turiya Mobility 1.0.0</Text>
      </ScrollView>

      <Modal
        visible={logoutConfirmVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setLogoutConfirmVisible(false)}
      >
        <View style={[styles.modalOverlay, styles.logoutOverlay]}>
          <View style={[styles.logoutDialog, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Sign out?</Text>
            <Text style={[styles.logoutDescription, { color: colors.textSecondary }]}>
              You can sign back in anytime with your mobile number.
            </Text>
            <View style={styles.logoutActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setLogoutConfirmVisible(false)}
                style={({ pressed }) => [
                  styles.logoutAction,
                  styles.logoutCancelAction,
                  { borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.logoutActionText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setLogoutConfirmVisible(false);
                  void logout();
                }}
                style={({ pressed }) => [
                  styles.logoutAction,
                  styles.logoutConfirmAction,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.logoutActionText, { color: '#fff' }]}>Sign out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Profile</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setEditModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Photo Upload Section */}
              <View style={styles.modalAvatarSection}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change avatar"
                  onPress={promptPhotoPicker}
                  style={styles.modalAvatarWrapper}
                >
                  {user?.profile_photo_url ? (
                    <Image source={{ uri: user?.profile_photo_url ?? '' }} style={styles.modalAvatarImage} contentFit="cover" />
                  ) : (
                    <View style={[styles.modalAvatarPlaceholder, { backgroundColor: colors.brandSoft }]}>
                      <Text style={[styles.modalAvatarText, { color: colors.brand }]}>{initials || 'H'}</Text>
                    </View>
                  )}
                  <View style={[styles.modalCameraBadge, { backgroundColor: colors.brand }]}>
                    {uploadingPhoto ? (
                      <ActivityIndicator size={12} color="#fff" />
                    ) : (
                      <Camera size={14} color="#fff" />
                    )}
                  </View>
                </Pressable>
                <Pressable onPress={promptPhotoPicker} style={{ marginTop: 8 }}>
                  <Text style={[styles.changePhotoText, { color: colors.brand }]}>
                    {uploadingPhoto ? 'Uploading photo…' : 'Choose photo (Camera / Gallery)'}
                  </Text>
                </Pressable>
              </View>

              {/* Error Message */}
              {editError ? (
                <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2' }]}>
                  <Text style={styles.errorText}>{editError}</Text>
                </View>
              ) : null}

              {/* Name Field */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Full Name *</Text>
                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <User size={16} color={colors.textMuted} />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter your name"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.textInput, { color: colors.text }]}
                  />
                </View>
              </View>

              {/* Email Field */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email Address</Text>
                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Mail size={16} color={colors.textMuted} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="example@mail.com"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={[styles.textInput, { color: colors.text }]}
                  />
                </View>
              </View>

              {/* Phone Field (Read Only) */}
              <View style={styles.inputGroup}>
                <View style={styles.labelWithBadgeRow}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Mobile Number</Text>
                  <View style={styles.verifiedInlineBadge}>
                    <ShieldCheck size={11} color="#10B981" />
                    <Text style={styles.verifiedInlineText}>Verified</Text>
                  </View>
                </View>
                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: isDark ? '#27272A' : '#F1F5F9' }]}>
                  <Phone size={16} color={colors.textMuted} />
                  <Text style={[styles.textInput, { color: colors.textSecondary, paddingTop: 14 }]}>
                    {user?.phone ? `+91 ${user.phone}` : 'Not linked'}
                  </Text>
                </View>
              </View>

              {/* Gender Field */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Gender</Text>
                <View style={styles.genderRow}>
                  {[
                    { id: 'male', label: 'Male' },
                    { id: 'female', label: 'Female' },
                    { id: 'other', label: 'Other' },
                  ].map((item) => {
                    const isSelected = gender === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => setGender(item.id)}
                        style={[
                          styles.genderChip,
                          {
                            backgroundColor: isSelected ? colors.brandSoft : colors.background,
                            borderColor: isSelected ? colors.brand : colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.genderChipText, { color: isSelected ? colors.brand : colors.text }]}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <DateTimeField label="Date of birth" value={parseLocalDate(dateOfBirth)}
                  onChange={date => setDateOfBirth(date ? localDateValue(date) : '')}
                  maximumDate={new Date()} clearable />
              </View>

              {/* Emergency Contact */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Emergency Contact Name</Text>
                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <ShieldCheck size={16} color={colors.textMuted} />
                  <TextInput
                    value={emergencyContactName}
                    onChangeText={setEmergencyContactName}
                    placeholder="Contact person name"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.textInput, { color: colors.text }]}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Emergency Contact Phone</Text>
                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Phone size={16} color={colors.textMuted} />
                  <TextInput
                    value={emergencyContactPhone}
                    onChangeText={setEmergencyContactPhone}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    maxLength={15}
                    style={[styles.textInput, { color: colors.text }]}
                  />
                </View>
              </View>

              {/* Save Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save Profile Changes"
                disabled={savingProfile}
                onPress={handleSaveProfile}
                style={({ pressed }) => [
                  styles.saveBtn,
                  { backgroundColor: colors.brand },
                  savingProfile && { opacity: 0.6 },
                  pressed && styles.pressed,
                ]}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Check size={17} color="#fff" strokeWidth={2.4} />
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Photo Picker Action Sheet Modal */}
      <Modal
        visible={photoSheetVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setPhotoSheetVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPhotoSheetVisible(false)}
        >
          <View style={[styles.photoSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.photoSheetTitle, { color: colors.text }]}>Profile Picture</Text>
            <Text style={[styles.photoSheetSubtitle, { color: colors.textMuted }]}>Choose how you would like to set your photo</Text>

            <View style={styles.sheetOptionsList}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take Photo"
                onPress={() => {
                  setPhotoSheetVisible(false);
                  setTimeout(() => void pickImage(true), 250);
                }}
                style={({ pressed }) => [
                  styles.sheetOptionBtn,
                  { backgroundColor: isDark ? '#27272A' : '#F8FAFC', borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.sheetOptionIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Camera size={20} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetOptionTitle, { color: colors.text }]}>Take Photo</Text>
                  <Text style={[styles.sheetOptionSub, { color: colors.textMuted }]}>Capture photo using device camera</Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose from Gallery"
                onPress={() => {
                  setPhotoSheetVisible(false);
                  setTimeout(() => void pickImage(false), 250);
                }}
                style={({ pressed }) => [
                  styles.sheetOptionBtn,
                  { backgroundColor: isDark ? '#27272A' : '#F8FAFC', borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.sheetOptionIcon, { backgroundColor: '#ECFDF5' }]}>
                  <LucideImage size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetOptionTitle, { color: colors.text }]}>Choose from Gallery</Text>
                  <Text style={[styles.sheetOptionSub, { color: colors.textMuted }]}>Select from photo library</Text>
                </View>
              </Pressable>


            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={() => setPhotoSheetVisible(false)}
              style={[styles.sheetCancelBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.sheetCancelText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: { ...Typography.label, letterSpacing: 1 },
  title: { ...Typography.display, marginTop: 4 },
  content: { paddingHorizontal: Spacing.md, paddingBottom: 110, gap: Spacing.md },
  profileCard: { minHeight: 104, borderRadius: Radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, position: 'relative' },
  avatarWrapper: { width: 56, height: 56, position: 'relative' },
  avatarImage: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  cameraBadge: { position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  profileCopy: { flex: 1 },
  userName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  userPhone: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 3 },
  tapToEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(59, 130, 246, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.4)',
  },
  tapToEditText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cardActionsCol: { alignItems: 'flex-end', justifyContent: 'center' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.18)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  verifiedText: { color: '#10B981', fontSize: 10, fontWeight: '800' },
  menuCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  menuRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 13 },
  pressed: { opacity: 0.72 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1 },
  menuLabel: { fontSize: 14, fontWeight: '800' },
  menuDetail: { fontSize: 11, marginTop: 2 },
  logout: { minHeight: 52, borderWidth: 1, borderRadius: Radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoutText: { fontSize: 14, fontWeight: '800' },
  version: { textAlign: 'center', fontSize: 11, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  logoutOverlay: { justifyContent: 'center', padding: Spacing.lg },
  logoutDialog: { padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, gap: 10 },
  logoutDescription: { fontSize: 14, lineHeight: 20 },
  logoutActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  logoutAction: { flex: 1, minHeight: 46, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  logoutCancelAction: { backgroundColor: 'transparent' },
  logoutConfirmAction: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  logoutActionText: { fontSize: 14, fontWeight: '800' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%', paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modalBody: { paddingHorizontal: 20, paddingVertical: 16, gap: 14 },
  modalAvatarSection: { alignItems: 'center', marginVertical: 8 },
  modalAvatarWrapper: { width: 88, height: 88, position: 'relative' },
  modalAvatarImage: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: '#2563EB' },
  modalAvatarPlaceholder: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#2563EB' },
  modalAvatarText: { fontSize: 32, fontWeight: '900' },
  modalCameraBadge: { position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  changePhotoText: { fontSize: 13, fontWeight: '800' },
  errorBox: { padding: 12, borderRadius: Radius.md },
  errorText: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: '700' },
  labelWithBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  verifiedInlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  verifiedInlineText: { color: '#10B981', fontSize: 11, fontWeight: '700' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12, minHeight: 48, gap: 10 },
  textInput: { flex: 1, fontSize: 14, height: 48 },
  genderRow: { flexDirection: 'row', gap: 10 },
  genderChip: { flex: 1, height: 42, borderWidth: 1, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  genderChipText: { fontSize: 13, fontWeight: '700' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: Radius.pill, marginTop: 12, marginBottom: 16 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  photoSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, gap: 10 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(150,150,150,0.4)', alignSelf: 'center', marginBottom: 6 },
  photoSheetTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  photoSheetSubtitle: { fontSize: 12, textAlign: 'center', marginBottom: 6 },
  sheetOptionsList: { gap: 10 },
  sheetOptionBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: Radius.lg, borderWidth: 1, gap: 12 },
  sheetOptionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sheetOptionTitle: { fontSize: 14, fontWeight: '800' },
  sheetOptionSub: { fontSize: 11, marginTop: 2 },
  sheetCancelBtn: { height: 46, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  sheetCancelText: { fontSize: 14, fontWeight: '800' },
});
