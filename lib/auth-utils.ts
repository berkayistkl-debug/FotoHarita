// Supabase hata mesajlarını Türkçeye çevirir
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();

  if (m.includes('invalid login credentials') || m.includes('invalid credentials'))
    return 'E-posta veya şifre yanlış.';
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Bu e-posta adresi zaten kayıtlı.';
  if (m.includes('email not confirmed'))
    return 'E-posta adresin onaylanmamış. Gelen kutunu kontrol et.';
  if (m.includes('password should be at least'))
    return 'Şifre en az 8 karakter olmalıdır.';
  if (m.includes('unable to validate email address'))
    return 'Geçersiz e-posta adresi.';
  if (m.includes('email address is invalid') || m.includes('invalid email'))
    return 'Geçersiz e-posta adresi.';
  if (m.includes('rate limit') || m.includes('too many requests'))
    return 'Çok fazla deneme yaptın. Lütfen biraz bekle.';
  if (m.includes('network') || m.includes('fetch'))
    return 'İnternet bağlantısı yok. Bağlantını kontrol et.';
  if (m.includes('weak password'))
    return 'Şifre çok zayıf. Daha güçlü bir şifre seç.';
  if (m.includes('signup is disabled'))
    return 'Kayıt şu an devre dışı.';
  if (m.includes('duplicate') || m.includes('unique'))
    return 'Bu kullanıcı adı zaten alınmış.';

  return 'Bir hata oluştu. Lütfen tekrar dene.';
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3;
  label: string;
  color: string;
  width: string; // yüzde
}

// Şifre güvenlik skorunu hesaplar
export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '', color: '#333', width: '0%' };

  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // 0-4 → 0-3 normalize
  const normalized = Math.min(score, 3) as 0 | 1 | 2 | 3;

  const map: Record<number, Omit<PasswordStrength, 'score'>> = {
    0: { label: 'Zayıf', color: '#FF4444', width: '20%' },
    1: { label: 'Zayıf', color: '#FF4444', width: '30%' },
    2: { label: 'Orta', color: '#FFB800', width: '60%' },
    3: { label: 'Güçlü', color: '#00D4A0', width: '100%' },
  };

  return { score: normalized, ...map[normalized] };
}

// Şifre kurallarını kontrol eder
export interface PasswordRule {
  label: string;
  met: boolean;
}

export function getPasswordRules(password: string): PasswordRule[] {
  return [
    { label: 'En az 8 karakter', met: password.length >= 8 },
    { label: 'Büyük harf (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'Küçük harf (a-z)', met: /[a-z]/.test(password) },
    { label: 'Rakam (0-9)', met: /[0-9]/.test(password) },
  ];
}

// Kullanıcı adı validasyonu
export function validateUsername(username: string): string | null {
  if (username.length < 3) return 'Kullanıcı adı en az 3 karakter olmalı.';
  if (username.length > 20) return 'Kullanıcı adı en fazla 20 karakter olabilir.';
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Sadece harf, rakam ve alt çizgi (_) kullanabilirsin.';
  return null;
}
