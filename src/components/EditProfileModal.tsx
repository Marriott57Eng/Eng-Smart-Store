import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  X,
  Camera,
  User as UserIcon,
  Lock,
  Check,
  Trash2,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { User } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';
import {
  LocalUserProfile,
  AVATAR_COLOR_PRESETS,
  compressProfileImage,
  getAvatarGradientClass,
} from '../utils/userProfile';

interface EditProfileModalProps {
  isOpen: boolean;
  currentUser: User;
  profile: LocalUserProfile;
  onClose: () => void;
  onSave: (nextProfile: LocalUserProfile) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  currentUser,
  profile,
  onClose,
  onSave,
}) => {
  useScrollLock(isOpen);

  const [displayNickname, setDisplayNickname] = useState('');
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | undefined>(undefined);
  const [avatarColor, setAvatarColor] = useState<string>('blue');
  const [error, setError] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setDisplayNickname(profile.displayNickname ?? currentUser.nickname ?? '');
      setAvatarDataUrl(profile.avatarDataUrl);
      setAvatarColor(profile.avatarColor || 'blue');
      setError('');
      setIsProcessingImage(false);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, profile, currentUser.nickname]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setIsProcessingImage(true);
    try {
      const compressed = await compressProfileImage(file);
      setAvatarDataUrl(compressed);
    } catch (err: any) {
      setError(err?.message || 'ไม่สามารถอัปโหลดรูปภาพได้');
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = displayNickname.trim().slice(0, 30);
    onSave({
      displayNickname: cleaned || undefined,
      avatarDataUrl,
      avatarColor,
    });
    onClose();
  };

  const handleResetToDefault = () => {
    setDisplayNickname('');
    setAvatarDataUrl(undefined);
    setAvatarColor('blue');
    setError('');
  };

  const previewLabel = displayNickname.trim() || currentUser.name || currentUser.username;
  const previewInitial = (previewLabel || 'U').trim().charAt(0).toUpperCase();

  const modalContent = (
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center p-3 sm:p-4 overscroll-contain"
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={onClose}
        style={{ willChange: 'opacity' }}
        className="fixed inset-0 bg-slate-950/80 transform-gpu touch-none"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28, mass: 0.8 }}
        style={{ willChange: 'transform, opacity' }}
        className="relative z-10 bg-white dark:bg-slate-900 w-full max-w-md max-h-[92dvh] rounded-[28px] sm:rounded-[34px] flex flex-col shadow-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 transform-gpu"
      >
        {/* Top specular highlight */}
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                แก้ไขโปรไฟล์การแสดงผล
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                เปลี่ยนชื่อเล่นหรือรูปภาพโปรไฟล์บนหน้าจอได้ทันที
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="w-8 h-8 rounded-full liquid-glass-pill hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-all active:scale-95 cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {error && (
              <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/70 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Avatar Upload & Preview Section */}
            <div className="flex flex-col items-center pt-1">
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingImage}
                  className="relative w-24 h-24 rounded-full overflow-hidden ring-4 ring-blue-500/20 dark:ring-blue-400/20 shadow-xl transition-transform active:scale-95 cursor-pointer focus:outline-none"
                  title="แตะเพื่อเปลี่ยนรูปโปรไฟล์"
                >
                  {avatarDataUrl ? (
                    <img
                      src={avatarDataUrl}
                      alt={previewLabel}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className={`w-full h-full bg-gradient-to-br ${getAvatarGradientClass(
                        avatarColor
                      )} flex items-center justify-center text-white text-3xl font-black select-none`}
                    >
                      {previewInitial}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-slate-950/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingImage}
                  aria-label="อัปโหลดรูปภาพโปรไฟล์"
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900 cursor-pointer active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingImage}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/70 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
                >
                  {isProcessingImage ? 'กำลังปรับขนาดรูป...' : 'เลือกรูปจากเครื่อง'}
                </button>

                {avatarDataUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarDataUrl(undefined)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/60 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ลบรูป</span>
                  </button>
                )}
              </div>

              {/* Preset Gradient Colors (shown when no custom photo is set) */}
              {!avatarDataUrl && (
                <div className="mt-3 flex items-center gap-2">
                  {AVATAR_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setAvatarColor(preset.id)}
                      title={`สีพื้นหลัง: ${preset.label}`}
                      className={`w-6 h-6 rounded-full bg-gradient-to-br ${preset.className} transition-all cursor-pointer ${
                        avatarColor === preset.id
                          ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-slate-900 scale-110'
                          : 'opacity-75 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Editable Display Nickname */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <UserIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  ชื่อเล่นที่แสดงในแอป (Display Name)
                </label>
                <span className="text-[11px] text-slate-400">{displayNickname.length}/30</span>
              </div>
              <input
                type="text"
                maxLength={30}
                value={displayNickname}
                onChange={(e) => setDisplayNickname(e.target.value)}
                placeholder={`เช่น ${currentUser.nickname || 'ช่างเอ, พี่ต้น'} (เว้นว่างเพื่อใช้ชื่อจริง)`}
                className="w-full liquid-glass-input rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Immutable Real Name Box (Database Guarantee) */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  ชื่อจริงในฐานข้อมูล (ไม่สามารถแก้ไขได้)
                </span>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                  ID: {currentUser.id}
                </span>
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {currentUser.name || currentUser.username}
              </div>
              <div className="flex items-start gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-2.5 py-1.5 leading-relaxed">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  การเปลี่ยนชื่อเล่นหรือรูปโปรไฟล์นี้ใช้สำหรับแสดงผลเท่านั้น ชื่อจริงในฐานข้อมูลจะไม่เปลี่ยนแปลง และเมื่อเบิกของ รับเข้า หรือสั่งซื้อ ระบบจะบันทึกด้วยชื่อจริง <strong>{currentUser.name || currentUser.username}</strong> เสมอ
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex items-center justify-between gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
              title="รีเซ็ตกลับเป็นค่าเริ่มต้น"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>รีเซ็ต</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300/80 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isProcessingImage}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/25 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>บันทึกโปรไฟล์</span>
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
