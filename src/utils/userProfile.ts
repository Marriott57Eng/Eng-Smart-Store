export interface LocalUserProfile {
  displayNickname?: string;
  avatarDataUrl?: string;
  avatarColor?: string;
  updatedAt?: string;
}

export const AVATAR_COLOR_PRESETS = [
  { id: 'blue', label: 'น้ำเงิน', className: 'from-blue-500 to-indigo-600' },
  { id: 'emerald', label: 'เขียว', className: 'from-emerald-500 to-teal-600' },
  { id: 'amber', label: 'ส้มทอง', className: 'from-amber-500 to-orange-600' },
  { id: 'rose', label: 'ชมพูแดง', className: 'from-rose-500 to-pink-600' },
  { id: 'violet', label: 'ม่วง', className: 'from-violet-500 to-purple-600' },
  { id: 'slate', label: 'เทาเข้ม', className: 'from-slate-600 to-slate-800' },
] as const;

const PROFILE_STORAGE_PREFIX = 'warehouse_user_profile_';

export function isSafeAvatarDataUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url.trim());
}

export function getLocalUserProfile(userId?: string): LocalUserProfile {
  if (!userId || typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`${PROFILE_STORAGE_PREFIX}${userId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LocalUserProfile;
    return {
      displayNickname: typeof parsed.displayNickname === 'string' ? parsed.displayNickname.trim().slice(0, 30) : undefined,
      avatarDataUrl: isSafeAvatarDataUrl(parsed.avatarDataUrl) ? parsed.avatarDataUrl : undefined,
      avatarColor: typeof parsed.avatarColor === 'string' ? parsed.avatarColor : undefined,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    };
  } catch {
    return {};
  }
}

export function saveLocalUserProfile(userId: string, profile: LocalUserProfile): LocalUserProfile {
  const sanitized: LocalUserProfile = {
    displayNickname: profile.displayNickname ? profile.displayNickname.trim().slice(0, 30) : undefined,
    avatarDataUrl: isSafeAvatarDataUrl(profile.avatarDataUrl) ? profile.avatarDataUrl : undefined,
    avatarColor: profile.avatarColor || 'blue',
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${PROFILE_STORAGE_PREFIX}${userId}`, JSON.stringify(sanitized));
    } catch (err) {
      console.warn('Unable to save local user profile to localStorage:', err);
    }
  }
  return sanitized;
}

export function getAvatarGradientClass(colorId?: string): string {
  const found = AVATAR_COLOR_PRESETS.find((c) => c.id === colorId);
  return found ? found.className : AVATAR_COLOR_PRESETS[0].className;
}

/**
 * Center-crop and compress an uploaded image file to a lightweight 256x256 JPEG data URL
 * so it fits comfortably in localStorage without slowing down rendering.
 */
export function compressProfileImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith('image/')) {
      reject(new Error('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WEBP)'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error('ไฟล์รูปภาพมีขนาดใหญ่เกินไป (ไม่เกิน 10MB)'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ไฟล์รูปภาพไม่ถูกต้อง'));
      img.onload = () => {
        try {
          const TARGET_SIZE = 256;
          const canvas = document.createElement('canvas');
          canvas.width = TARGET_SIZE;
          canvas.height = TARGET_SIZE;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('ไม่สามารถประมวลผลรูปภาพได้'));
            return;
          }

          // Center square crop
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, TARGET_SIZE, TARGET_SIZE);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          if (!isSafeAvatarDataUrl(dataUrl)) {
            reject(new Error('ไม่สามารถแปลงไฟล์รูปภาพได้'));
            return;
          }
          resolve(dataUrl);
        } catch {
          reject(new Error('เกิดข้อผิดพลาดในการย่อขนาดรูปภาพ'));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
