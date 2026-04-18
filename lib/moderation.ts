const VISION_KEY = process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY;

type ModerationResult = 'approved' | 'rejected' | 'review';

/**
 * Google Vision API SafeSearch ile görsel moderasyonu
 * Katman 2: Asenkron, yükleme sonrası çağrılır
 */
export async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  if (!VISION_KEY) {
    console.warn('Vision API key bulunamadı, otomatik onaylıyor');
    return 'approved';
  }

  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${VISION_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { source: { imageUri: imageUrl } },
              features: [{ type: 'SAFE_SEARCH_DETECTION' }],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    const safe = data.responses?.[0]?.safeSearchAnnotation;

    if (!safe) return 'review';

    if (
      safe.adult === 'LIKELY' ||
      safe.adult === 'VERY_LIKELY' ||
      safe.violence === 'LIKELY' ||
      safe.violence === 'VERY_LIKELY'
    ) {
      return 'rejected';
    }

    if (safe.adult === 'POSSIBLE' || safe.racy === 'LIKELY' || safe.racy === 'VERY_LIKELY') {
      return 'review';
    }

    return 'approved';
  } catch (error) {
    console.error('Vision API hatası:', error);
    return 'review'; // Hata durumunda manuel incelemeye at
  }
}

/**
 * Katman 1: Yükleme öncesi dosya validasyonu
 */
export function validateImageFile(
  fileSize: number,
  mimeType: string
): { valid: boolean; error?: string } {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];

  if (fileSize > MAX_SIZE) {
    return { valid: false, error: 'Dosya boyutu 10MB\'dan küçük olmalıdır.' };
  }

  if (!ALLOWED_TYPES.includes(mimeType.toLowerCase())) {
    return { valid: false, error: 'Sadece JPG, PNG ve HEIC formatları desteklenmektedir.' };
  }

  return { valid: true };
}

/**
 * Basit perceptual hash (duplikasyon tespiti için — tam implementasyon backend'de)
 */
export function generateSimpleHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}
