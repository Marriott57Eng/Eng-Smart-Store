
import React, { useState, useEffect } from 'react';
import { User as UserIcon, AlertCircle, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, setDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { User } from '../types';
import { initialUsers } from '../data/users';
import { EngLogo } from './EngLogo';

interface LoginViewProps {
  onLogin: (user: User) => void;
}

// Build instant offline/initial users list
const getInitialDbUsers = (): User[] => {
  try {
    const cached = localStorage.getItem('warehouse_cached_users');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (_) {}

  const defaultList: User[] = initialUsers.map((u) => ({
    id: u.id,
    username: u.id,
    name: u.name,
    nickname: u.nickname,
    role: 'user',
    createdAt: '2026-08-01T00:00:00.000Z',
  }));

  defaultList.push({
    id: 'Admininmad',
    username: 'Admininmad',
    name: 'Administrator',
    role: 'admin',
    createdAt: '2026-08-01T00:00:00.000Z',
  });

  return defaultList;
};

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [loginInput, setLoginInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dbUsers, setDbUsers] = useState<User[]>(getInitialDbUsers);

  // Background silent sync: fetch fresh users and seed if necessary without blocking the UI
  useEffect(() => {
    let isMounted = true;
    const syncUsersSilently = async () => {
      if (!db) return;
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        let loadedUsers: User[] = [];
        const existingIds = new Set<string>();

        usersSnapshot.forEach((docSnap) => {
          existingIds.add(docSnap.id);
          loadedUsers.push(docSnap.data() as User);
        });

        const batch = [];
        let needsUpdate = false;

        // Seed missing initial users if Firestore collection is fresh
        for (const u of initialUsers) {
          if (!existingIds.has(u.id)) {
            const newUser: User = {
              id: u.id,
              username: u.id,
              name: u.name,
              nickname: u.nickname,
              role: 'user',
              createdAt: new Date().toISOString(),
            };
            batch.push(setDoc(doc(db, 'users', u.id), newUser));
            loadedUsers.push(newUser);
            needsUpdate = true;
          }
        }

        // Ensure admin exists
        if (!existingIds.has('Admininmad')) {
          const defaultAdmin: User = {
            id: 'Admininmad',
            username: 'Admininmad',
            name: 'Administrator',
            role: 'admin',
            createdAt: new Date().toISOString(),
          };
          batch.push(setDoc(doc(db, 'users', 'Admininmad'), defaultAdmin));
          loadedUsers.push(defaultAdmin);
          needsUpdate = true;
        }

        if (needsUpdate && batch.length > 0) {
          await Promise.all(batch);
        }

        if (isMounted && loadedUsers.length > 0) {
          setDbUsers(loadedUsers);
          try {
            localStorage.setItem('warehouse_cached_users', JSON.stringify(loadedUsers));
          } catch (_) {}
        }
      } catch (err) {
        console.warn('Silent users sync (offline fallback active):', err);
      }
    };

    syncUsersSilently();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = loginInput.trim().toLowerCase();

    if (!cleanInput) {
      setError('กรุณากรอกรหัสพนักงาน หรือชื่อจริง');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Find user locally from instant loaded list
      let foundUser = dbUsers.find(
        (u) =>
          u.id.toLowerCase() === cleanInput ||
          (u.username && u.username.toLowerCase() === cleanInput) ||
          u.name.toLowerCase().includes(cleanInput)
      );

      // 2. If not found in local memory, search live in Firestore doc directly
      if (!foundUser) {
        try {
          const directDoc = await getDoc(doc(db, 'users', loginInput.trim()));
          if (directDoc.exists()) {
            foundUser = directDoc.data() as User;
          } else {
            // Check by ID, username or name in collection
            const snap = await getDocs(collection(db, 'users'));
            snap.forEach((d) => {
              const u = d.data() as User;
              if (
                u.id.toLowerCase() === cleanInput ||
                (u.username && u.username.toLowerCase() === cleanInput) ||
                u.name.toLowerCase().includes(cleanInput)
              ) {
                foundUser = u;
              }
            });
          }
        } catch (_) {}
      }

const generateSafeUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (_) {}
  }
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
};

      if (foundUser) {
        // Handle persistent device lock
        let deviceId: string | null = null;
        try {
          deviceId = localStorage.getItem('device_id');
        } catch (_) {}

        if (!deviceId) {
          deviceId = generateSafeUUID();
          try {
            localStorage.setItem('device_id', deviceId);
          } catch (_) {}
        }

        // Fetch fresh user data to check if already active on another device
        const userRef = doc(db, 'users', foundUser.id);
        try {
          const userSnap = await getDoc(userRef);
          if (userSnap.exists() && foundUser.id !== 'Admininmad') {
            const freshData = userSnap.data() as User;
            if (freshData.activeDeviceId && freshData.activeDeviceId !== deviceId) {
              setError('ไม่สามารถเข้าสู่ระบบได้ เนื่องจากมีการเข้าสู่ระบบอยู่แล้ว กรุณาเข้าสู่ระบบด้วย User ของตนเอง');
              setLoading(false);
              return;
            }
          }
        } catch (_) {}

        const newToken = generateSafeUUID();
        const updateData: any = { sessionToken: newToken };
        if (foundUser.id !== 'Admininmad') {
          updateData.activeDeviceId = deviceId;
        } else {
          updateData.activeDeviceId = ''; // Never lock Admininmad
        }

        // Update active device token
        updateDoc(userRef, updateData).catch((err) => {
          console.warn('Failed to update session token in Firestore:', err);
        });

        const updatedUser = {
          ...foundUser,
          sessionToken: newToken,
          activeDeviceId: foundUser.id !== 'Admininmad' ? deviceId : '',
        };
        localStorage.setItem('warehouse_user', JSON.stringify(updatedUser));
        onLogin(updatedUser);
      } else {
        setError('ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาตรวจสอบรหัสพนักงานหรือชื่อจริง');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-100 via-blue-50/40 to-indigo-100/50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/60 flex items-center justify-center p-4 sm:p-6 pl-safe pr-safe selection:bg-blue-600 selection:text-white transition-colors overflow-y-auto relative">
      {/* Soft ambient radial glows */}
      <div className="fixed -top-24 -left-24 w-96 h-96 bg-blue-500/15 dark:bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-24 -right-24 w-96 h-96 bg-indigo-500/15 dark:bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md my-auto liquid-glass-card rounded-[32px] shadow-2xl flex flex-col p-6 sm:p-8 pt-safe-content justify-center relative overflow-hidden transition-all">
        {/* Top gradient highlight */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500" />

        <div className="relative z-10 flex flex-col items-center mb-6">
          <div className="w-full max-w-[500px] h-24 sm:h-[130px] flex items-center justify-center mb-4 overflow-hidden rounded-2xl bg-slate-950/5 dark:bg-slate-950/40 p-2 border border-slate-200/70 dark:border-slate-800/80">
            <EngLogo
              alt="ENG Smart Store Logo"
              style={{ width: '500px', maxWidth: '100%', height: '100%', maxHeight: '130px' }}
              className="object-contain rounded-xl"
            />
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent tracking-tight">
              ENG Smart Store
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">
              ระบบจัดการคลังอะไหล่ช่าง · Store FL.6
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-red-500/10 border border-red-400/40 rounded-2xl flex items-start gap-2.5 text-red-700 dark:text-red-300 relative z-10">
            <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
            <span className="text-xs sm:text-sm font-medium leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="relative z-10 flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">
              รหัสพนักงาน หรือ ชื่อ-นามสกุล
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <UserIcon className="h-4.5 w-4.5 text-slate-400" />
              </div>
              <input
                type="text"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                className="block w-full pl-10 pr-4 py-3.5 liquid-glass-input rounded-2xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-slate-900 dark:text-white outline-none placeholder:text-slate-400 text-sm sm:text-base font-medium"
                placeholder="กรอกรหัสพนักงาน หรือ ชื่อของคุณ..."
                disabled={loading}
                autoFocus
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] disabled:opacity-70 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span className="text-sm sm:text-base">เข้าสู่ระบบ</span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-200/70 dark:border-slate-800/80 text-center text-xs text-slate-400 dark:text-slate-500">
          MH57 Engineering · Store FL.6
        </div>
      </div>
    </div>
  );
};

