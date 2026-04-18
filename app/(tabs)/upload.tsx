import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@lib/supabase';
import { verifyLocation } from '@lib/gps';
import { moderateImage } from '@lib/moderation';
import { processUploadCoins, checkAndAwardBadges } from '@lib/coins';
import { useTheme } from '../../context/ThemeContext';
import { useLocation } from '@hooks/useLocation';
import { DarkColors, Spacing, BorderRadius } from '@constants/theme';
import { Button } from '@components/ui/Button';
import { CategoryPicker } from '@components/upload/CategoryPicker';
import { LocationVerifier } from '@components/upload/LocationVerifier';

type C = typeof DarkColors;
type AspectRatio = '4:3' | '16:9';
type VerifyStatus = 'idle' | 'verifying' | 'verified' | 'failed';

const { width: SCREEN_W } = Dimensions.get('window');
const MAX_PHOTOS = 10;
const PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

export default function UploadScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { lat: userLat, lng: userLng } = useLocation();
  const mapRef = useRef<MapView>(null);

  const [step, setStep] = useState(0);
  const [pinLocation, setPinLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ place_id: string; description: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [imageUris, setImageUris] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('4:3');
  const [locationName, setLocationName] = useState('');
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle');
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; distanceMeters?: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);


  const searchPlaces = (query: string) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${PLACES_KEY}&language=tr&components=country:tr`;
        const res = await fetch(url);
        const json = await res.json();
        setSearchResults(json.predictions ?? []);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 350);
  };

  const getPlaceCoords = async (placeId: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,name&key=${PLACES_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      const loc = json.result?.geometry?.location;
      if (!loc) return null;
      return { lat: loc.lat, lng: loc.lng };
    } catch { return null; }
  };

  const handleSelectPlace = async (place: { place_id: string; description: string }, pinIt: boolean) => {
    const coords = await getPlaceCoords(place.place_id);
    if (!coords) return;
    mapRef.current?.animateToRegion({
      latitude: coords.lat, longitude: coords.lng,
      latitudeDelta: 0.005, longitudeDelta: 0.005,
    }, 600);
    if (pinIt) {
      setPinLocation(coords);
      setLocationName(place.description.split(',')[0]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const initialRegion: Region = {
    latitude: userLat ?? 41.0082,
    longitude: userLng ?? 28.9784,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  // Instagram standardı: seçilen orana kırp + 1080px genişlik, %85 kalite
  const processImage = async (uri: string, ratio: AspectRatio): Promise<string> => {
    const targetW = 1080;
    const targetH = ratio === '16:9' ? 1920 : 1440; // portrait 9:16 veya 3:4

    // Adım 1: genişliği 1080px yap (oranı koru)
    const step1 = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: targetW } }],
      { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
    );

    if (step1.height >= targetH) {
      // Resim yeterince uzun → dikey ortala ve kırp
      const cropY = Math.floor((step1.height - targetH) / 2);
      return (await ImageManipulator.manipulateAsync(
        step1.uri,
        [{ crop: { originX: 0, originY: cropY, width: targetW, height: targetH } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      )).uri;
    } else {
      // Yatay fotoğraf → yüksekliğe göre ölçekle, sonra yatay ortala ve kırp
      const step2 = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { height: targetH } }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );
      const cropX = Math.floor((step2.width - targetW) / 2);
      if (cropX > 0) {
        return (await ImageManipulator.manipulateAsync(
          step2.uri,
          [{ crop: { originX: cropX, originY: 0, width: targetW, height: targetH } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        )).uri;
      }
      return step2.uri;
    }
  };

  const verifyPhoto = async (source: 'camera' | 'gallery') => {
    if (!pinLocation) return;
    setVerifyStatus('verifying');
    try {
      const result = await verifyLocation(pinLocation.lat, pinLocation.lng, source);
      setVerifyResult({ verified: result.verified, distanceMeters: result.distanceMeters });
      setVerifyStatus(result.verified ? 'verified' : 'failed');
    } catch {
      setVerifyStatus('failed');
    }
  };

  // Galeriden çoklu seçim
  const pickImages = async () => {
    const remaining = MAX_PHOTOS - imageUris.length;
    if (remaining <= 0) { Alert.alert('Limit', `En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsin.`); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.80,
    });

    if (!result.canceled && result.assets.length > 0) {
      setProcessing(true);
      try {
        const wasEmpty = imageUris.length === 0;
        const processed = await Promise.all(result.assets.map(a => processImage(a.uri, aspectRatio)));
        const merged = [...imageUris, ...processed].slice(0, MAX_PHOTOS);
        setImageUris(merged);
        if (wasEmpty) await verifyPhoto('gallery');
      } finally {
        setProcessing(false);
      }
    }
  };

  // Kameradan tek çekim, diziye ekle
  const openCamera = async () => {
    if (imageUris.length >= MAX_PHOTOS) { Alert.alert('Limit', `En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsin.`); return; }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Kamera erişimi için izin vermeniz gerekiyor.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.80 });
    if (!result.canceled && result.assets[0]) {
      setProcessing(true);
      try {
        const wasEmpty = imageUris.length === 0;
        const processed = await processImage(result.assets[0].uri, aspectRatio);
        setImageUris(prev => [...prev, processed].slice(0, MAX_PHOTOS));
        if (wasEmpty) await verifyPhoto('camera');
      } finally {
        setProcessing(false);
      }
    }
  };

  const removePhoto = (index: number) => {
    setImageUris(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (imageUris.length === 0 || !category || !pinLocation) {
      Alert.alert('Eksik Bilgi', 'En az bir fotoğraf, konum ve kategori seçimi zorunludur.');
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Oturum açmanız gerekiyor.');

      const { data: profile } = await supabase
        .from('users').select('id').eq('auth_id', user.id).single();
      if (!profile) throw new Error('Profil bulunamadı.');

      // Tüm fotoğrafları paralel yükle
      const batchTs = Date.now();
      const fileNames = imageUris.map((_, i) => `${profile.id}/${batchTs}_${i}.jpg`);

      const uploadResults = await Promise.allSettled(
        imageUris.map(async (uri, i) => {
          const fetchRes = await fetch(uri);
          const arrayBuffer = await fetchRes.arrayBuffer();
          const { error: uploadError } = await supabase.storage
            .from('pins').upload(fileNames[i], arrayBuffer, { contentType: 'image/jpeg' });
          if (uploadError) throw new Error(`Fotoğraf ${i + 1}: ${uploadError.message}`);
          return supabase.storage.from('pins').getPublicUrl(fileNames[i]).data.publicUrl;
        })
      );

      const failed = uploadResults.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        // Yüklenen dosyaları temizle
        await supabase.storage.from('pins').remove(
          uploadResults.map((r, i) => r.status === 'fulfilled' ? fileNames[i] : null).filter(Boolean) as string[]
        );
        throw new Error(`${failed.length} fotoğraf yüklenemedi. Lütfen tekrar deneyin.`);
      }

      const uploadedUrls = uploadResults.map(r => (r as PromiseFulfilledResult<string>).value);

      const { data: locationId, error: locError } = await supabase.rpc('find_or_create_location', {
        p_lat: pinLocation.lat,
        p_lng: pinLocation.lng,
        p_name: locationName.trim() || 'Çekim Noktası',
        p_address: null,
        p_category: category,
      });
      if (locError) throw new Error(`Konum hatası: ${locError.message}`);

      const { data: pin, error: pinError } = await supabase
        .from('pins')
        .insert({
          user_id: profile.id,
          location_id: locationId,
          photo_url: uploadedUrls[0],
          photo_urls: uploadedUrls,
          aspect_ratio: aspectRatio,
          location_name: locationName.trim() || null,
          caption: caption.trim() || null,
          gps_verified: verifyResult?.verified ?? false,
          upload_lat: pinLocation.lat,
          upload_lng: pinLocation.lng,
          moderation_status: 'pending',
        })
        .select().single();
      if (pinError) throw new Error(`Pin kayıt hatası: ${pinError.message}`);

      // Asenkron moderasyon — onaylanınca 'approved', reddedilince 'rejected'
      moderateImage(uploadedUrls[0]).then((status) => {
        supabase.from('pins').update({ moderation_status: status }).eq('id', pin.id);
      });

      const coinResult = await processUploadCoins(profile.id, locationId, pin.id, verifyResult?.verified ?? false);
      await checkAndAwardBadges(profile.id);

      setUploading(false);
      Alert.alert(
        'Yüklendi!',
        `${uploadedUrls.length} fotoğraf paylaşıldı.${coinResult.coinsEarned > 0 ? ` +${coinResult.coinsEarned} coin kazandın!` : ''}`,
        [{ text: 'Haritada Gör', onPress: () => router.replace('/(tabs)') }]
      );

      setImageUris([]); setLocationName(''); setCaption(''); setCategory(null);
      setVerifyStatus('idle'); setVerifyResult(null);
      setPinLocation(null); setStep(0);
    } catch (err: any) {
      setUploading(false);
      Alert.alert('Yükleme Hatası', err.message);
    }
  };

  const s = makeStyles(colors);
  const previewAspect = aspectRatio === '16:9' ? 9 / 16 : 3 / 4;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>{step === 0 ? 'Konumu İşaretle' : 'Fotoğraf Ekle'}</Text>
        <View style={s.stepRow}>
          <View style={[s.stepDot, { backgroundColor: colors.primary }]} />
          <View style={[s.stepLine, { backgroundColor: step >= 1 ? colors.primary : colors.border }]} />
          <View style={[s.stepDot, { backgroundColor: step >= 1 ? colors.primary : colors.border }]} />
        </View>
      </View>

      {step === 0 ? (
        <View style={s.mapContainer}>
          {/* Lokasyon arama */}
          <View style={[s.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={[s.searchInput, { color: colors.text }]}
              placeholder="Mekan ara... (ör. Galata Kulesi)"
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={searchPlaces}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Feather
                name={searchLoading ? 'loader' : 'x'}
                size={16}
                color={colors.textMuted}
                onPress={() => { setSearchQuery(''); setSearchResults([]); }}
              />
            )}
          </View>

          {/* Arama sonuçları */}
          {searchResults.length > 0 && (
            <View style={[s.resultsList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {searchResults.slice(0, 5).map((place) => (
                <View key={place.place_id} style={[s.resultRow, { borderBottomColor: colors.border }]}>
                  <Feather name="map-pin" size={14} color={colors.textMuted} style={{ marginTop: 1 }} />
                  <TouchableOpacity
                    style={s.resultName}
                    onPress={() => handleSelectPlace(place, true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.resultText, { color: colors.text }]} numberOfLines={1}>
                      {place.description}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.goBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' }]}
                    onPress={() => handleSelectPlace(place, false)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.goBtnText, { color: colors.primary }]}>Git</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <Text style={s.mapHint}>Fotoğrafın çekildiği yere dokunarak pin ekle</Text>
          <MapView
            ref={mapRef}
            style={s.map}
            initialRegion={initialRegion}
            onPress={(e) => setPinLocation({
              lat: e.nativeEvent.coordinate.latitude,
              lng: e.nativeEvent.coordinate.longitude,
            })}
            onLongPress={(e) => setPinLocation({
              lat: e.nativeEvent.coordinate.latitude,
              lng: e.nativeEvent.coordinate.longitude,
            })}
          >
            {pinLocation && (
              <Marker coordinate={{ latitude: pinLocation.lat, longitude: pinLocation.lng }} />
            )}
          </MapView>

          {userLat && userLng && (
            <TouchableOpacity
              style={[s.locateBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => {
                mapRef.current?.animateToRegion({
                  latitude: userLat, longitude: userLng,
                  latitudeDelta: 0.01, longitudeDelta: 0.01,
                });
                setPinLocation({ lat: userLat, lng: userLng });
              }}
            >
              <Feather name="navigation" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}

          <View style={s.mapFooter}>
            {pinLocation ? (
              <Text style={[s.pinCoordText, { color: colors.textSecondary }]}>
                {pinLocation.lat.toFixed(5)}, {pinLocation.lng.toFixed(5)}
              </Text>
            ) : (
              <Text style={[s.pinCoordText, { color: colors.textMuted }]}>Konum seçilmedi</Text>
            )}
            <Button title="İleri" onPress={() => setStep(1)} disabled={!pinLocation} size="md" />
          </View>
        </View>
      ) : (
        <ScrollView style={s.scrollView} contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">

          {/* Aspect ratio */}
          <View style={s.aspectRow}>
            <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Oran</Text>
            <View style={s.aspectBtns}>
              {(['4:3', '16:9'] as AspectRatio[]).map((ratio) => {
                const isActive = aspectRatio === ratio;
                // Mini dikdörtgen: portrait oranını görsel olarak temsil eder
                // 4:3 portrait → w:h = 3:4 → 24×32, 16:9 portrait → w:h = 9:16 → 18×32
                const miniW = ratio === '4:3' ? 24 : 18;
                return (
                  <TouchableOpacity key={ratio} style={s.aspectBtn} onPress={() => setAspectRatio(ratio)}>
                    <View style={[s.ratioVisual, {
                      width: miniW, height: 32,
                      borderColor: isActive ? colors.primary : colors.border,
                      backgroundColor: isActive ? colors.primary + '25' : 'transparent',
                    }]} />
                    <Text style={[s.aspectBtnText, { color: isActive ? colors.primary : colors.textMuted }]}>
                      {ratio}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Fotoğraf alanı */}
          {imageUris.length === 0 ? (
            /* Boş durum — seçilen oran şekli */
            <View style={s.emptyPhotoOuter}>
              <View style={[s.emptyPhotoArea, {
                aspectRatio: previewAspect,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }]}>
                {processing ? (
                  <ActivityIndicator color={colors.primary} size="large" />
                ) : (
                  <View style={s.pickBtns}>
                    <TouchableOpacity style={[s.pickBtn, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={openCamera}>
                      <Feather name="camera" size={22} color={colors.textMuted} />
                      <Text style={[s.pickLabel, { color: colors.textSecondary }]}>Kamera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.pickBtn, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={pickImages}>
                      <Feather name="image" size={22} color={colors.textMuted} />
                      <Text style={[s.pickLabel, { color: colors.textSecondary }]}>Galeri</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ) : (
            /* Fotoğraf şeridi */
            <View style={s.photoStrip}>
              <FlatList
                data={[...imageUris, ...(imageUris.length < MAX_PHOTOS ? ['__add__'] : [])]}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, i) => (item === '__add__' ? 'add' : String(i))}
                contentContainerStyle={s.stripContent}
                renderItem={({ item, index }) => {
                  if (item === '__add__') {
                    return (
                      <View style={s.stripAddWrap}>
                        <TouchableOpacity
                          style={[s.stripAdd, { borderColor: colors.border, backgroundColor: colors.surface }]}
                          onPress={pickImages} activeOpacity={0.7}
                        >
                          <Feather name="plus" size={22} color={colors.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.stripCamera, { borderColor: colors.border, backgroundColor: colors.surface }]}
                          onPress={openCamera} activeOpacity={0.7}
                        >
                          <Feather name="camera" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    );
                  }
                  return (
                    <View style={[s.stripThumb, { aspectRatio: previewAspect }]}>
                      <Image source={{ uri: item as string }} style={s.stripImg} resizeMode="cover" />
                      <TouchableOpacity style={s.stripRemove} onPress={() => removePhoto(index)}>
                        <Feather name="x" size={11} color="#fff" />
                      </TouchableOpacity>
                      {index === 0 && (
                        <View style={s.stripCover}>
                          <Text style={s.stripCoverText}>Kapak</Text>
                        </View>
                      )}
                    </View>
                  );
                }}
              />
              <Text style={[s.photoCount, { color: colors.textMuted }]}>
                {imageUris.length}/{MAX_PHOTOS} fotoğraf
              </Text>

              {/* Büyük önizleme — ilk fotoğraf */}
              {processing && (
                <View style={[s.processingOverlay, { backgroundColor: colors.surface, aspectRatio: previewAspect }]}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={[s.processingText, { color: colors.textMuted }]}>İşleniyor...</Text>
                </View>
              )}
            </View>
          )}

          {/* GPS doğrulama */}
          <LocationVerifier
            status={verifyStatus}
            distanceMeters={verifyResult?.distanceMeters}
            onRetry={() => verifyPhoto('gallery')}
            onManualOverride={() => setVerifyStatus('idle')}
          />

          {/* Kategori */}
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Kategori *</Text>
            <CategoryPicker selected={category} onSelect={setCategory} />
          </View>

          {/* Mekan adı */}
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>
              Mekan Adı{' '}
              <Text style={{ color: colors.textMuted, fontWeight: '400' }}>(opsiyonel)</Text>
            </Text>
            <TextInput
              style={[s.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="ör. Galata Kulesi, Boğaz manzarası..."
              placeholderTextColor={colors.textMuted}
              value={locationName}
              onChangeText={setLocationName}
              maxLength={80}
              returnKeyType="next"
            />
          </View>

          {/* Açıklama */}
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Açıklama</Text>
            <TextInput
              style={[s.textInput, s.captionInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="Bu çekim noktası hakkında bir şeyler yaz..."
              placeholderTextColor={colors.textMuted}
              value={caption}
              onChangeText={setCaption}
              maxLength={150}
              multiline
              returnKeyType="done"
              blurOnSubmit
            />
            <Text style={[s.charCount, { color: colors.textMuted }]}>{caption.length}/150</Text>
          </View>

          {/* Coin bilgisi */}
          <View style={[s.coinInfo, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Feather
              name={verifyStatus === 'verified' ? 'check-circle' : 'info'}
              size={14}
              color={verifyStatus === 'verified' ? colors.success : colors.textMuted}
            />
            <Text style={[s.coinInfoText, { color: colors.textSecondary }]}>
              {verifyStatus === 'verified'
                ? 'GPS doğrulandı — yeni yer ise +10 coin kazanacaksın!'
                : verifyStatus === 'failed'
                  ? `Konumdan çok uzak — GPS doğrulanamadı.`
                  : 'GPS doğrulaması için orada olman gerekiyor (max 1 km).'}
            </Text>
          </View>

          {/* Alt butonlar */}
          <View style={s.footerBtns}>
            <TouchableOpacity style={[s.backStepBtn, { borderColor: colors.border }]} onPress={() => setStep(0)}>
              <Feather name="chevron-left" size={16} color={colors.textSecondary} />
              <Text style={[s.backStepText, { color: colors.textSecondary }]}>Geri</Text>
            </TouchableOpacity>
            <Button
              title={uploading ? 'Yükleniyor...' : 'Paylaş'}
              onPress={handleUpload}
              loading={uploading}
              disabled={imageUris.length === 0 || !category || uploading}
              size="md"
              style={s.uploadBtn}
            />
          </View>

          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(c: C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      paddingTop: 56,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
      gap: 10,
      backgroundColor: c.surface,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: c.text, letterSpacing: -0.4 },
    stepRow: { flexDirection: 'row', alignItems: 'center' },
    stepDot: { width: 8, height: 8, borderRadius: 4 },
    stepLine: { flex: 1, height: 2, marginHorizontal: 4 },

    mapContainer: { flex: 1 },
    mapHint: { fontSize: 13, color: c.textMuted, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
    map: { flex: 1 },

    // Arama kutusu
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      zIndex: 20,
    },
    searchInput: { flex: 1, fontSize: 14 },
    resultsList: {
      marginHorizontal: Spacing.lg,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      overflow: 'hidden',
      zIndex: 20,
      elevation: 8,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      borderBottomWidth: 0.5,
      gap: Spacing.sm,
    },
    resultName: { flex: 1 },
    resultText: { fontSize: 13 },
    goBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
    },
    goBtnText: { fontSize: 12, fontWeight: '700' },
    locateBtn: {
      position: 'absolute', bottom: 80, right: Spacing.lg,
      width: 44, height: 44, borderRadius: 22, borderWidth: 1,
      alignItems: 'center', justifyContent: 'center',
    },
    mapFooter: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      backgroundColor: c.surface, borderTopWidth: 0.5, borderTopColor: c.border,
    },
    pinCoordText: { fontSize: 12, fontFamily: 'monospace' },

    scrollView: { flex: 1 },
    content: { padding: Spacing.lg, gap: Spacing.md },

    aspectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    aspectBtns: { flexDirection: 'row', gap: Spacing.lg },
    aspectBtn: { alignItems: 'center', gap: 5 },
    ratioVisual: { borderRadius: 4, borderWidth: 1.5 },
    aspectBtnText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },

    // Boş fotoğraf alanı — küçük, ortalanmış, seçilen oranı yansıtır
    emptyPhotoOuter: { alignItems: 'center' },
    emptyPhotoArea: {
      width: SCREEN_W * 0.62,
      borderRadius: BorderRadius.lg,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickBtns: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md },
    pickBtn: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      maxHeight: 80,
    },
    pickLabel: { fontSize: 11, fontWeight: '600' },

    // Fotoğraf şeridi
    photoStrip: { gap: Spacing.sm },
    stripContent: { paddingBottom: 4, gap: Spacing.sm },
    stripThumb: {
      width: 90,
      borderRadius: BorderRadius.md,
      overflow: 'hidden',
      position: 'relative',
    },
    stripImg: { width: '100%', height: '100%' },
    stripRemove: {
      position: 'absolute', top: 4, right: 4,
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.65)',
      alignItems: 'center', justifyContent: 'center',
    },
    stripCover: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center', paddingVertical: 3,
    },
    stripCoverText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
    stripAddWrap: { justifyContent: 'space-between', gap: Spacing.xs, paddingVertical: 4 },
    stripAdd: {
      width: 60, height: 60,
      borderRadius: BorderRadius.md, borderWidth: 1.5, borderStyle: 'dashed',
      alignItems: 'center', justifyContent: 'center',
    },
    stripCamera: {
      width: 60, height: 36,
      borderRadius: BorderRadius.md, borderWidth: 1.5, borderStyle: 'dashed',
      alignItems: 'center', justifyContent: 'center',
    },
    photoCount: { fontSize: 11, fontWeight: '600' },
    processingOverlay: {
      width: '100%', borderRadius: BorderRadius.lg,
      alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl,
    },
    processingText: { fontSize: 13 },

    section: { gap: Spacing.sm },
    sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
    textInput: {
      borderRadius: BorderRadius.md, borderWidth: 1,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
      fontSize: 15,
    },
    captionInput: { minHeight: 80, textAlignVertical: 'top', paddingTop: Spacing.md },
    charCount: { fontSize: 11, alignSelf: 'flex-end' },
    coinInfo: {
      flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
      borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1,
    },
    coinInfoText: { flex: 1, fontSize: 13, lineHeight: 18 },
    footerBtns: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
    backStepBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: Spacing.md, paddingVertical: 11,
      borderRadius: BorderRadius.full, borderWidth: 1,
    },
    backStepText: { fontSize: 13, fontWeight: '600' },
    uploadBtn: { flex: 1, borderRadius: BorderRadius.full },
  });
}
