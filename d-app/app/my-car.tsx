import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Car, Check, FileCheck2, ShieldCheck } from 'lucide-react-native';
import api, { API_URL, apiErrorMessage } from '../src/lib/api';
import VehicleSelect from '../components/VehicleSelect';
import VehicleIllustration from '../components/VehicleIllustration';
import VehiclePhotos, { photoSides, type PhotoDrafts, type PhotoSide, type VehiclePhoto } from '../components/VehiclePhotos';

type Category = {
  id: number;
  name: string;
  vehicle_type: string;
  seats: number;
  base_fare?: string | number;
  price_per_km?: string | number;
  price_per_minute?: string | number;
  min_fare?: string | number;
  base_price_per_day?: string | number;
  extra_km_charge?: string | number;
};
type Vehicle = {
  id: number;
  car_category_id?: number | null;
  category?: { id?: number } | null;
  registration_number?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  fuel_type?: string | null;
  seats?: number | null;
  is_ac?: boolean | number | null;
  is_available_for_rent?: boolean | number | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  photo_urls?: Partial<Record<PhotoSide, string>>;
};

type Readiness = {
  status: 'missing' | 'pending' | 'approved' | 'rejected' | 'unavailable' | 'documents_required' | 'documents_pending' | 'driver_pending';
  can_go_online: boolean;
  message: string;
};

type VehicleForm = typeof emptyForm;
type SetupOptions = { makes: Record<string, string[]>; colors: string[]; years: number[]; fuel_types: string[]; seats: number[] };

const fuelTypes = ['petrol', 'diesel', 'cng', 'electric', 'hybrid'] as const;

const emptyForm = {
  car_category_id: 0,
  registration_number: '',
  make: '',
  model: '',
  year: String(new Date().getFullYear()),
  color: '',
  fuel_type: 'petrol',
  seats: '4',
  is_ac: true,
};

export default function MyCarScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [updatingRentalAvailability, setUpdatingRentalAvailability] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [options, setOptions] = useState<SetupOptions | null>(null);
  const [photos, setPhotos] = useState<PhotoDrafts>({});
  const [detailsStep, setDetailsStep] = useState(false);
  const objectUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = objectUrls.current;
    return () => { if (Platform.OS === 'web') urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);
  const changePhoto = (side: PhotoSide, photo?: VehiclePhoto) => {
    if (savingRef.current) return;
    if (photo?.uri.startsWith('blob:')) objectUrls.current.add(photo.uri);
    setPhotos((current) => ({ ...current, [side]: photo }));
    setSaveError('');
  };
  const savedPhotos = Object.fromEntries(Object.entries(vehicle?.photo_urls || {}).map(([side, url]) => [side, new URL(url, API_URL).toString()]));
  const hasFourPhotos = photoSides.every((side) => photos[side] || savedPhotos[side]);
  const showDetails = Boolean(vehicle) || detailsStep;
  const choices = (values: string[], current: string) => current ? [...new Set([...values, current])] : values;

  const loadVehicle = useCallback((silent = false) => {
    if (!silent) {
      setLoading(true);
      setLoadError('');
    }

    return api.get('/vehicle')
      .then(({ data }) => {
        const current = data.vehicle as Vehicle | null;
        setVehicle(current);
        setOptions(data.setup_options || null);
        if (!silent) { setPhotos({}); setDetailsStep(Boolean(current)); }
        setReadiness(data.vehicle_readiness || null);
        setCategories(Array.isArray(data.categories) ? data.categories : []);
        if (!silent) setEditing(!current);
        if (current && !silent) {
          setForm({
            car_category_id: Number(current.car_category_id || current.category?.id || 0),
            registration_number: String(current.registration_number || ''),
            make: String(current.make || ''),
            model: String(current.model || ''),
            year: current.year ? String(current.year) : String(new Date().getFullYear()),
            color: String(current.color || ''),
            fuel_type: fuelTypes.includes(current.fuel_type as typeof fuelTypes[number]) ? String(current.fuel_type) : 'petrol',
            seats: current.seats ? String(current.seats) : '4',
            is_ac: Boolean(current.is_ac),
          });
        } else if (!current && !silent) {
          const soleCategory = data.categories?.length === 1 ? data.categories[0] as Category : null;
          setForm({ ...emptyForm, car_category_id: soleCategory?.id || 0, seats: String(soleCategory?.seats || 4) });
        }
      })
      .catch((error) => {
        if (!silent) {
          setLoadError(error.response?.data?.message || 'Check your connection and try again.');
        }
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, []);

  useFocusEffect(useCallback(() => {
    void loadVehicle();
    const refreshTimer = setInterval(() => void loadVehicle(true), 10_000);

    return () => clearInterval(refreshTimer);
  }, [loadVehicle]));

  const statusTone = useMemo(() => {
    if (readiness?.status === 'approved') return { bg: '#dcfce7', text: '#166534', label: 'Approved' };
    if (['rejected', 'documents_required', 'unavailable'].includes(readiness?.status || '')) return { bg: '#fee2e2', text: '#991b1b', label: 'Action needed' };
    return { bg: '#fef3c7', text: '#92400e', label: vehicle ? 'In review' : 'Setup required' };
  }, [readiness?.status, vehicle]);
  const selectedCategory = categories.find((category) => category.id === form.car_category_id);

  const update = <Key extends keyof VehicleForm>(key: Key, value: VehicleForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    if (savingRef.current) return;
    setSaveError('');
    setNotice('');
    if (!vehicle && !hasFourPhotos) {
      setSaveError('Add front, rear, left and right photos before submitting.');
      setDetailsStep(false);
      return;
    }
    if (!form.car_category_id || !form.registration_number.trim() || !form.make.trim() || !form.model.trim() || !form.color.trim()) {
      setSaveError('Choose a vehicle category and fill in registration, make, model, and color.');
      return;
    }

    const year = Number(form.year);
    const seats = Number(form.seats);
    if (!Number.isInteger(year) || year < 1980 || year > new Date().getFullYear() + 1) {
      setSaveError(`Enter a vehicle year from 1980 to ${new Date().getFullYear() + 1}.`);
      return;
    }
    if (!Number.isInteger(seats) || seats < 2 || seats > 12) {
      setSaveError('Seat capacity must be between 2 and 12.');
      return;
    }
    if (!fuelTypes.includes(form.fuel_type as typeof fuelTypes[number])) {
      setSaveError('Choose petrol, diesel, CNG, electric, or hybrid.');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const values = {
        ...form,
        registration_number: form.registration_number.replace(/\s+/g, '').toUpperCase(),
        year,
        seats,
      };
      const payload = new FormData();
      Object.entries(values).forEach(([key, value]) => payload.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value)));
      for (const side of photoSides) {
        const photo = photos[side];
        if (!photo) continue;
        if (Platform.OS === 'web') {
          const file = photo.file || await (await fetch(photo.uri)).blob();
          payload.append(`photos[${side}]`, file, photo.name);
        } else {
          payload.append(`photos[${side}]`, { uri: photo.uri, name: photo.name, type: photo.type } as unknown as Blob);
        }
      }
      const { data } = await api.post('/vehicle', payload, { timeout: 120000 });
      setPhotos({});
      setVehicle(data.vehicle);
      setReadiness(data.vehicle_readiness);
      setEditing(false);
      setNotice(data.message || 'Your car was submitted for admin approval.');
    } catch (error: any) {
      setSaveError(apiErrorMessage(error, 'Could not save your car. Please try again.'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const updateRentalAvailability = async (value: boolean) => {
    if (!vehicle || updatingRentalAvailability) return;

    setUpdatingRentalAvailability(true);
    setVehicle((current) => current ? { ...current, is_available_for_rent: value } : current);
    try {
      const { data } = await api.put('/vehicle/rental-availability', {
        is_available_for_rent: value,
      });
      setVehicle(data.vehicle);
      Alert.alert(value ? 'Listed for rent' : 'Rental listing paused', data.message);
    } catch (error: any) {
      setVehicle((current) => current ? { ...current, is_available_for_rent: !value } : current);
      Alert.alert('Could not update rental listing', error.response?.data?.message || 'Please try again.');
    } finally {
      setUpdatingRentalAvailability(false);
    }
  };

  if (loading) {
    return <SafeAreaView edges={['bottom']} style={styles.loading}><ActivityIndicator size="large" color="#0f766e" /><Text style={styles.loadingText}>Loading your car…</Text></SafeAreaView>;
  }

  if (loadError) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.errorScreen}>
        <View style={styles.errorIcon}><Car color="#be123c" size={28} /></View>
        <Text style={styles.errorTitle}>Couldn’t load your car</Text>
        <Text style={styles.errorMessage}>{loadError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void loadVehicle()} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.cancelText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
            <ArrowLeft color="#0f172a" size={22} />
          </TouchableOpacity>
          <View>
            <Text style={styles.eyebrow}>DRIVER ACCOUNT</Text>
            <Text style={styles.title}>My car</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {notice ? <Text accessibilityLiveRegion="polite" style={styles.statusMessage}>{notice}</Text> : null}
          <View style={styles.statusCard}>
            <View style={styles.carIcon}><Car color="#fff" size={26} /></View>
            <View style={styles.statusContent}>
              <View style={[styles.badge, { backgroundColor: statusTone.bg }]}>
                <Text style={[styles.badgeText, { color: statusTone.text }]}>{statusTone.label}</Text>
              </View>
              <Text style={styles.statusTitle}>{vehicle ? `${vehicle.make} ${vehicle.model}` : 'Add the car you drive'}</Text>
              <Text style={styles.statusMessage}>{readiness?.message || 'One approved car is required before you can go online.'}</Text>
            </View>
          </View>

          {editing && vehicle && <View style={styles.notice}>
            <ShieldCheck color="#0369a1" size={20} />
            <Text style={styles.noticeText}>Changed car details need a new review and take you offline. Saving without changes keeps your current approval.</Text>
          </View>}

          {!editing && vehicle && <TouchableOpacity accessibilityRole="button" style={styles.documentLink} onPress={() => setEditing(true)}>
            <Text style={styles.documentTitle}>{vehicle.approval_status === 'rejected' ? 'Correct car details' : 'Edit car details'}</Text>
          </TouchableOpacity>}

          <TouchableOpacity accessibilityRole="button" style={styles.documentLink} onPress={() => router.push('/documents')}>
            <View style={styles.documentIcon}><FileCheck2 color="#0f766e" size={21} /></View>
            <View style={styles.documentCopy}><Text style={styles.documentTitle}>Driver documents</Text><Text style={styles.documentCaption}>Upload license and identity documents for verification</Text></View>
            <Text style={styles.documentArrow}>›</Text>
          </TouchableOpacity>

          {vehicle && (
            <View style={styles.rentalCard}>
              <View style={styles.rentalCopy}>
                <Text style={styles.rentalTitle}>List this vehicle for rent</Text>
                <Text style={styles.rentalCaption}>
                  {readiness?.status === 'approved'
                    ? 'Customers can view and reserve this specific vehicle.'
                    : 'This option becomes available after the vehicle and driver are approved.'}
                </Text>
              </View>
              {updatingRentalAvailability
                ? <ActivityIndicator color="#0f766e" />
                : <Switch
                    accessibilityLabel="List this vehicle for rent"
                    value={Boolean(vehicle.is_available_for_rent)}
                    disabled={!vehicle.is_available_for_rent && readiness?.status !== 'approved'}
                    onValueChange={(value) => void updateRentalAvailability(value)}
                    trackColor={{ false: '#cbd5e1', true: '#99f6e4' }}
                    thumbColor={vehicle.is_available_for_rent ? '#0f766e' : '#f8fafc'}
                  />}
            </View>
          )}

          <VehiclePhotos drafts={photos} saved={savedPhotos} onChange={changePhoto} disabled={saving} editable={editing} />
          {!vehicle && editing && <Text style={styles.rateHelp}>{showDetails ? 'Step 2 of 2: select the details shown on your vehicle documents.' : 'Step 1 of 2: add all four views, then continue to car details.'}</Text>}
          {editing && showDetails && <>
          <Text style={styles.sectionTitle}>Vehicle category (required)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {categories.map((category) => {
              const selected = form.car_category_id === category.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  disabled={saving}
                  style={[styles.categoryCard, selected && styles.categorySelected]}
                  onPress={() => {
                    update('car_category_id', category.id);
                    update('seats', String(category.seats || 4));
                  }}
                >
                  <View style={styles.categoryHeader}>
                    <Car color={selected ? '#fff' : '#334155'} size={20} />
                    {selected && <Check color="#fff" size={18} />}
                  </View>
                  <Text style={[styles.categoryName, selected && styles.categoryNameSelected]}>{category.name}</Text>
                  <Text style={[styles.categoryMeta, selected && styles.categoryMetaSelected]}>{category.seats} seats</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {categories.length === 0 && <Text style={styles.categoryEmpty}>No active vehicle categories are available. Ask an administrator to enable one.</Text>}
          {selectedCategory && (
            <View style={styles.rateCard}>
              <Text style={styles.rateTitle}>Admin fare rates · {selectedCategory.name}</Text>
              <View style={styles.rateGrid}>
                <Rate label="Ride base" value={`₹${Number(selectedCategory.base_fare || 0).toLocaleString('en-IN')}`} />
                <Rate label="Per km" value={`₹${Number(selectedCategory.price_per_km || 0).toLocaleString('en-IN')}`} />
                <Rate label="Minimum fare" value={`₹${Number(selectedCategory.min_fare || 0).toLocaleString('en-IN')}`} />
                <Rate label="Rental / day" value={`₹${Number(selectedCategory.base_price_per_day || 0).toLocaleString('en-IN')}`} />
              </View>
              <Text style={styles.rateHelp}>These rates are configured by the administrator and are read-only.</Text>
            </View>
          )}

          <View style={styles.formCard}>
            <Field editable={!saving} label="Registration number" value={form.registration_number} onChangeText={(value) => update('registration_number', value.toUpperCase())} placeholder="KA01AB1234" autoCapitalize="characters" />
            <VehicleSelect label="Make" value={form.make} options={choices(Object.keys(options?.makes || {}), vehicle?.make || '')} disabled={saving || !options} onChange={(value) => setForm((current) => ({ ...current, make: value, model: current.make === value ? current.model : '' }))} />
            <VehicleSelect label="Model" value={form.model} options={choices(options?.makes[form.make] || [], form.make === vehicle?.make ? vehicle?.model || '' : '')} disabled={saving || !form.make} onChange={(value) => update('model', value)} />
            <VehicleSelect label="Year" value={form.year} options={(options?.years || []).map(String)} disabled={saving} onChange={(value) => update('year', value)} />
            <VehicleSelect label="Color" value={form.color} options={choices(options?.colors || [], vehicle?.color || '')} disabled={saving} onChange={(value) => update('color', value)} />
            <VehicleSelect label="Fuel" value={form.fuel_type} options={options?.fuel_types || [...fuelTypes]} disabled={saving} onChange={(value) => update('fuel_type', value)} />
            <VehicleSelect label="Seats" value={form.seats} options={(options?.seats || []).map(String)} disabled={saving} onChange={(value) => update('seats', value)} />
            {!options && <Text accessibilityRole="alert" style={styles.categoryEmpty}>Vehicle choices are unavailable. Reload this screen to try again.</Text>}
            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchTitle}>Air conditioned</Text>
                <Text style={styles.switchCaption}>Shown to customers before booking</Text>
              </View>
              <Switch disabled={saving} value={form.is_ac} onValueChange={(value) => update('is_ac', value)} trackColor={{ false: '#cbd5e1', true: '#bae6fd' }} thumbColor={form.is_ac ? '#0284c7' : '#f8fafc'} />
            </View>
          </View>
          </>}
          {showDetails && <VehicleIllustration make={editing ? form.make : vehicle?.make || ''} model={editing ? form.model : vehicle?.model || ''} year={editing ? form.year : String(vehicle?.year || '')} color={editing ? form.color : vehicle?.color || ''} fuel={editing ? form.fuel_type : vehicle?.fuel_type || ''} seats={editing ? form.seats : String(vehicle?.seats || '')} bodyType={selectedCategory?.vehicle_type} />}
        </ScrollView>

        {editing && <View style={styles.footer}>
          {saveError ? <Text accessibilityRole="alert" style={{ color: '#991b1b', marginBottom: 8 }}>{saveError}</Text> : null}
          <TouchableOpacity accessibilityRole="button" style={[styles.saveButton, (saving || (!showDetails && !hasFourPhotos)) && styles.saveDisabled]} onPress={() => { if (showDetails) void save(); else setDetailsStep(true); }} disabled={saving || (!showDetails && !hasFourPhotos)}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{!showDetails ? 'Continue to car details' : vehicle ? 'Save car details' : 'Submit car for approval'}</Text>}
          </TouchableOpacity>
          {vehicle && <TouchableOpacity accessibilityRole="button" style={styles.cancelButton} disabled={saving} onPress={() => void loadVehicle()}><Text style={styles.cancelText}>Cancel changes</Text></TouchableOpacity>}
        </View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput accessibilityLabel={label} style={styles.input} placeholderTextColor="#94a3b8" {...inputProps} />
    </View>
  );
}

function Rate({ label, value }: { label: string; value: string }) {
  return <View style={styles.rateItem}><Text style={styles.rateLabel}>{label}</Text><Text style={styles.rateValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 14, fontWeight: '600' },
  errorScreen: { flex: 1, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  errorIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#ffe4e6', alignItems: 'center', justifyContent: 'center' },
  errorTitle: { marginTop: 18, color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'center' },
  errorMessage: { marginTop: 8, color: '#64748b', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  retryButton: { marginTop: 24, width: '100%', minHeight: 52, borderRadius: 16, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  cancelButton: { marginTop: 8, minHeight: 48, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#475569', fontSize: 14, fontWeight: '700' },
  header: { minHeight: 76, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, letterSpacing: 1.3, fontWeight: '800', color: '#64748b' },
  title: { marginTop: 2, fontSize: 24, lineHeight: 28, fontWeight: '900', color: '#0f172a' },
  content: { padding: 16, paddingBottom: 28 },
  statusCard: { padding: 18, borderRadius: 22, backgroundColor: '#0f172a', flexDirection: 'row', gap: 14 },
  carIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#0284c7', alignItems: 'center', justifyContent: 'center' },
  statusContent: { flex: 1, alignItems: 'flex-start' },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '900' },
  statusTitle: { marginTop: 10, fontSize: 18, fontWeight: '900', color: '#fff' },
  statusMessage: { marginTop: 4, fontSize: 12, lineHeight: 18, color: '#cbd5e1' },
  notice: { marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: '#e0f2fe', flexDirection: 'row', alignItems: 'center', gap: 10 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18, color: '#0c4a6e' },
  documentLink: { marginTop: 12, minHeight: 72, padding: 13, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe4e1', flexDirection: 'row', alignItems: 'center', gap: 11 },
  documentIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#ccfbf1', alignItems: 'center', justifyContent: 'center' },
  documentCopy: { flex: 1 }, documentTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a' }, documentCaption: { fontSize: 11, lineHeight: 16, color: '#64748b', marginTop: 2 }, documentArrow: { fontSize: 26, color: '#64748b' },
  rentalCard: { marginTop: 12, minHeight: 86, padding: 15, borderRadius: 18, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', flexDirection: 'row', alignItems: 'center', gap: 14 },
  rentalCopy: { flex: 1 },
  rentalTitle: { fontSize: 14, fontWeight: '900', color: '#064e3b' },
  rentalCaption: { marginTop: 4, fontSize: 11, lineHeight: 17, color: '#047857' },
  sectionTitle: { marginTop: 24, marginBottom: 10, fontSize: 13, fontWeight: '900', color: '#334155', textTransform: 'uppercase', letterSpacing: 0.8 },
  categoryRow: { gap: 10, paddingRight: 12 },
  categoryCard: { width: 142, minHeight: 106, padding: 14, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  categorySelected: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryName: { marginTop: 12, fontSize: 14, fontWeight: '800', color: '#0f172a' },
  categoryNameSelected: { color: '#fff' },
  categoryMeta: { marginTop: 3, fontSize: 11, color: '#64748b' },
  categoryMetaSelected: { color: '#bae6fd' },
  categoryEmpty: { padding: 16, borderRadius: 14, backgroundColor: '#fff7ed', color: '#9a3412', fontSize: 12, lineHeight: 18 },
  rateCard: { marginTop: 14, padding: 16, borderRadius: 18, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  rateTitle: { fontSize: 13, fontWeight: '900', color: '#065f46' }, rateGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 8 }, rateItem: { width: '47.5%', padding: 10, borderRadius: 12, backgroundColor: '#fff' }, rateLabel: { fontSize: 9, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }, rateValue: { fontSize: 14, fontWeight: '900', color: '#0f172a', marginTop: 3 }, rateHelp: { fontSize: 10, color: '#047857', marginTop: 9 },
  formCard: { marginTop: 14, padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  field: { marginBottom: 14 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  fieldLabel: { marginBottom: 7, fontSize: 12, fontWeight: '800', color: '#475569' },
  input: { minHeight: 48, paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc', fontSize: 15, color: '#0f172a' },
  switchRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  switchCaption: { marginTop: 3, fontSize: 11, color: '#64748b' },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  saveButton: { minHeight: 52, borderRadius: 16, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  saveDisabled: { opacity: 0.6 },
  saveText: { fontSize: 15, fontWeight: '900', color: '#fff' },
});
