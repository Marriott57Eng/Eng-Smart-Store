import { WebPushPayload, WebPushNotificationConfig } from '../types';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const DEFAULT_WEBPUSH_CONFIG: WebPushNotificationConfig = {
  enabled: true,
  notifyLowStock: true,
  notifyImportantRequisition: true,
  notifyPurchaseOrder: true,
};

let cachedWebPushConfig: WebPushNotificationConfig | null = null;

/**
 * Utility to convert VAPID public key from URL-safe Base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function areApplicationServerKeysEqual(
  existingKey: ArrayBuffer | null | undefined,
  expectedKey: Uint8Array
): boolean {
  if (!existingKey) return false;
  const existingBytes = new Uint8Array(existingKey);
  if (existingBytes.length !== expectedKey.length) return false;
  for (let i = 0; i < existingBytes.length; i++) {
    if (existingBytes[i] !== expectedKey[i]) return false;
  }
  return true;
}

/**
 * Ensure Service Worker (/sw.js) is registered and ready without hanging
 */
export async function ensureServiceWorkerReady(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    let reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } else {
      reg.update().catch(() => {});
    }

    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<ServiceWorkerRegistration | null>((resolve) =>
      setTimeout(() => resolve(reg || null), 3500)
    );
    return (await Promise.race([readyPromise, timeoutPromise])) || reg || null;
  } catch (err) {
    console.warn('ensureServiceWorkerReady warning:', err);
    return null;
  }
}

/**
 * Trigger both native OS notification (via ServiceWorker or Notification API)
 * and in-app interactive Push Banner event
 */
export async function triggerLocalPushDisplay(payload: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  type?: string;
  showOsNotification?: boolean;
}) {
  if (typeof window === 'undefined') return;

  const effectiveTag = payload.tag || `eng-push-${Date.now()}`;

  // 1. Dispatch in-app banner event so foreground users always see an instant push card
  try {
    window.dispatchEvent(
      new CustomEvent('eng-webpush-received', {
        detail: {
          title: payload.title,
          body: payload.body,
          icon: '/icon-192.png',
          url: payload.url || '/',
          tag: effectiveTag,
          notificationType: payload.type || 'system',
          timestamp: Date.now(),
        },
      })
    );
  } catch (_) {}

  // 2. Show native OS notification if permission is granted and requested
  if (payload.showOsNotification !== false && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const reg = await ensureServiceWorkerReady();
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(payload.title, {
          body: payload.body,
          icon: '/icon-192.png',
          tag: effectiveTag,
          data: {
            url: payload.url || '/',
            timestamp: Date.now(),
            type: payload.type || 'system',
          },
        });
        return;
      }
    } catch (_) {}

    try {
      new Notification(payload.title, {
        body: payload.body,
        icon: '/icon-192.png',
        tag: effectiveTag,
      });
    } catch (_) {}
  }
}

/**
 * Check if Web Push and Service Worker are supported in the current browser
 */
export function isWebPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    ('PushManager' in window || 'Notification' in window)
  );
}

/**
 * Get current browser notification permission
 */
export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'default';
  }
  return Notification.permission;
}

export const getWebPushPermission = getNotificationPermission;

/**
 * Check whether Web Push is enabled on this device (either via PushManager or local preference)
 */
export function isDeviceWebPushEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('webpush_enabled') === 'true';
  } catch (_) {
    return false;
  }
}

/**
 * Get cached Web Push config synchronously (fallback to localStorage or defaults)
 */
export function getWebPushConfig(): WebPushNotificationConfig {
  if (cachedWebPushConfig) return cachedWebPushConfig;
  try {
    const raw = localStorage.getItem('webpush_config');
    if (raw) {
      cachedWebPushConfig = { ...DEFAULT_WEBPUSH_CONFIG, ...JSON.parse(raw) };
      return cachedWebPushConfig;
    }
  } catch (_) {}
  return DEFAULT_WEBPUSH_CONFIG;
}

/**
 * Fetch master Web Push config from Firestore (configured by Admin)
 * All regular users inherit this master config
 */
export async function fetchWebPushConfigFromFirestore(): Promise<WebPushNotificationConfig> {
  try {
    const docRef = doc(db, 'settings', 'webpush_config');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const remoteData = { ...DEFAULT_WEBPUSH_CONFIG, ...(snap.data() as WebPushNotificationConfig) };
      cachedWebPushConfig = remoteData;
      try {
        localStorage.setItem('webpush_config', JSON.stringify(remoteData));
      } catch (_) {}
      return remoteData;
    }
  } catch (err) {
    console.warn('Failed to fetch Web Push config from Firestore, trying backend:', err);
  }

  // Fallback to backend API
  try {
    const res = await fetch('/api/push/config', { cache: 'no-store' });
    if (res.ok) {
      const serverCfg = await res.json();
      if (serverCfg && serverCfg.success && serverCfg.config) {
        cachedWebPushConfig = { ...DEFAULT_WEBPUSH_CONFIG, ...serverCfg.config };
        return cachedWebPushConfig;
      }
    }
  } catch (_) {}

  return getWebPushConfig();
}

/**
 * Save master Web Push config to Firestore (Admin only)
 * Synchronizes to both Firestore and backend server memory
 */
export async function saveWebPushConfig(
  cfg: Partial<WebPushNotificationConfig>,
  updatedBy?: string,
  userRole: string = 'admin'
): Promise<WebPushNotificationConfig> {
  const current = getWebPushConfig();
  const updated: WebPushNotificationConfig = {
    ...current,
    ...cfg,
    updatedAt: new Date().toISOString(),
    ...(updatedBy ? { updatedBy } : {}),
  };
  cachedWebPushConfig = updated;
  try {
    localStorage.setItem('webpush_config', JSON.stringify(updated));
  } catch (_) {}

  try {
    const docRef = doc(db, 'settings', 'webpush_config');
    await setDoc(docRef, updated, { merge: true });
  } catch (err) {
    console.error('Failed to save Web Push config to Firestore:', err);
  }

  // Also sync to backend server with role authorization
  try {
    await fetch('/api/push/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updated, userRole }),
    });
  } catch (_) {}

  return updated;
}

/**
 * Check if current client has an active push subscription
 */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;
  try {
    const registration = await ensureServiceWorkerReady();
    if (!registration || !registration.pushManager) return null;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn('Error checking existing push subscription:', err);
    return null;
  }
}

/**
 * Silently verify & sync current device's PushSubscription with the server's active VAPID public key
 */
export async function syncExistingPushSubscription(user?: {
  id?: string;
  name?: string;
  role?: string;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !isWebPushSupported()) return false;
  if (getNotificationPermission() !== 'granted') return isDeviceWebPushEnabled();

  try {
    const registration = await ensureServiceWorkerReady();
    if (!registration || !registration.pushManager) return isDeviceWebPushEnabled();

    const keyRes = await fetch('/api/push/public-key', { cache: 'no-store' });
    if (!keyRes.ok) return isDeviceWebPushEnabled();
    const keyData = await keyRes.json();
    if (!keyData?.success || !keyData?.publicKey) return isDeviceWebPushEnabled();

    const expectedServerKey = urlBase64ToUint8Array(keyData.publicKey);
    let subscription = await registration.pushManager.getSubscription();

    // If subscription exists with an outdated VAPID key, unsubscribe and re-create
    if (
      subscription &&
      !areApplicationServerKeysEqual(subscription.options?.applicationServerKey, expectedServerKey)
    ) {
      try {
        await subscription.unsubscribe();
      } catch (_) {}
      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: expectedServerKey,
      });
    }

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userId: user?.id || 'guest',
        userName: user?.name || 'ผู้ใช้งานคลัง',
        deviceInfo: navigator.userAgent.slice(0, 120),
        skipWelcome: true,
      }),
    });

    try {
      localStorage.setItem('webpush_enabled', 'true');
    } catch (_) {}

    return true;
  } catch (err) {
    console.warn('syncExistingPushSubscription warning:', err);
    return isDeviceWebPushEnabled();
  }
}

/**
 * Subscribe the current device/browser to Web Push Notifications
 */
export async function subscribeToWebPush(
  user?: { id?: string; name?: string; role?: string },
  options?: { skipWelcome?: boolean }
): Promise<{
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
}> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'ไม่สามารถใช้งานได้ในสภาพแวดล้อมนี้' };
  }

  try {
    // 1. Request notification permission from the user if supported
    let permission: NotificationPermission = 'default';
    if ('Notification' in window) {
      permission = Notification.permission;
      if (permission !== 'granted') {
        try {
          permission = await Notification.requestPermission();
        } catch (permErr) {
          console.warn('Notification.requestPermission notice:', permErr);
        }
      }
    }

    // 2. Ensure service worker is active
    const registration = await ensureServiceWorkerReady();

    // 3. Fetch public VAPID key from backend (bypass cache)
    const keyRes = await fetch('/api/push/public-key', { cache: 'no-store' });
    if (!keyRes.ok) {
      throw new Error('ไม่สามารถดึงรหัสความปลอดภัย VAPID Key จากเซิร์ฟเวอร์ได้');
    }
    const keyData = await keyRes.json();
    if (!keyData.success || !keyData.publicKey) {
      throw new Error(keyData.error || 'ไม่พบ VAPID Public Key');
    }

    const applicationServerKey = urlBase64ToUint8Array(keyData.publicKey);
    let subscription: PushSubscription | undefined;

    // 4. Subscribe with PushManager if permission is granted and PushManager is available
    if (permission === 'granted' && registration && registration.pushManager) {
      try {
        let existingSub = await registration.pushManager.getSubscription();
        if (
          existingSub &&
          !areApplicationServerKeysEqual(existingSub.options?.applicationServerKey, applicationServerKey)
        ) {
          await existingSub.unsubscribe().catch(() => {});
          existingSub = null;
        }

        if (!existingSub) {
          existingSub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
        }
        subscription = existingSub;

        // 5. Send subscription to server
        const subscribeRes = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            userId: user?.id || 'guest',
            userName: user?.name || 'ผู้ใช้งานคลัง',
            deviceInfo: navigator.userAgent.slice(0, 120),
            skipWelcome: Boolean(options?.skipWelcome),
          }),
        });

        const subscribeData = await subscribeRes.json();
        if (!subscribeRes.ok || !subscribeData.success) {
          console.warn('Server push subscribe warning:', subscribeData.error);
        }
      } catch (pushMgrErr: any) {
        console.warn('PushManager subscribe fallback notice:', pushMgrErr);
      }
    } else if (permission === 'denied') {
      // Even if browser OS notification is blocked (e.g. inside iframe), enable real-time in-app Web Push channel
      try {
        localStorage.setItem('webpush_enabled', 'true');
      } catch (_) {}

      if (!options?.skipWelcome) {
        await triggerLocalPushDisplay({
          title: '✅ เปิดแจ้งเตือนสำเร็จ',
          body: 'พร้อมแจ้งเตือนเบิก-รับ สต็อกต่ำ และสั่งซื้อ',
          tag: `welcome-push-${Date.now()}`,
          showOsNotification: false,
        });
      }

      return {
        success: true,
      };
    }

    try {
      localStorage.setItem('webpush_enabled', 'true');
    } catch (_) {}

    if (!options?.skipWelcome) {
      await triggerLocalPushDisplay({
        title: '✅ เปิดแจ้งเตือนสำเร็จ',
        body: 'พร้อมแจ้งเตือนเบิก-รับ สต็อกต่ำ และสั่งซื้อ',
        tag: `welcome-push-${Date.now()}`,
        showOsNotification: !subscription, // If VAPID welcome push wasn't sent via PushManager, show via local SW
      });
    }

    return {
      success: true,
      subscription,
    };
  } catch (err: any) {
    console.error('Web Push subscription failed:', err);
    return {
      success: false,
      error: err.message || 'เกิดข้อผิดพลาดในการลงทะเบียน Web Push',
    };
  }
}

/**
 * Unsubscribe from Web Push notifications
 */
export async function unsubscribeFromWebPush(): Promise<{ success: boolean; error?: string }> {
  try {
    const registration = await ensureServiceWorkerReady();
    if (registration && registration.pushManager) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe().catch(() => {});

        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {});
      }
    }

    try {
      localStorage.removeItem('webpush_enabled');
    } catch (_) {}

    return { success: true };
  } catch (err: any) {
    console.error('Error unsubscribing from Web Push:', err);
    return { success: false, error: err.message };
  }
}

const recentlySentPushMap = new Map<string, number>();

function markPushSentByThisTab(tag?: string, title?: string) {
  const now = Date.now();
  if (tag) recentlySentPushMap.set(`tag:${tag}`, now);
  if (title) recentlySentPushMap.set(`title:${title}`, now);
  // Cleanup entries older than 12s
  for (const [k, ts] of recentlySentPushMap.entries()) {
    if (now - ts > 12000) {
      recentlySentPushMap.delete(k);
    }
  }
}

export function wasPushRecentlySentByThisTab(tag?: string, title?: string): boolean {
  const now = Date.now();
  if (tag) {
    const t = recentlySentPushMap.get(`tag:${tag}`);
    if (t && now - t < 10000) return true;
  }
  if (title) {
    const t = recentlySentPushMap.get(`title:${title}`);
    if (t && now - t < 10000) return true;
  }
  return false;
}

/**
 * Send Web Push notification (Broadcasts to all subscribed devices even if app is closed)
 */
export async function sendWebPushNotification(payload: WebPushPayload): Promise<{ success: boolean; error?: string }> {
  try {
    markPushSentByThisTab(payload.tag, payload.title);
    const res = await fetch('/api/push/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'ส่งการแจ้งเตือนไม่สำเร็จ' };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('sendWebPushNotification exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Trigger Low Stock Web Push alert (respects Admin master config)
 */
export async function triggerLowStockPush(item: {
  id: string;
  name: string;
  unit: string;
  location?: string;
  minStock?: number;
}, newQty: number) {
  const cfg = await fetchWebPushConfigFromFirestore();
  if (!cfg.enabled || !cfg.notifyLowStock) {
    return { success: false, skipped: true, reason: 'Disabled by Admin config' };
  }

  const isOutOfStock = newQty <= 0;
  const title = isOutOfStock
    ? `🚨 ของหมด! (เหลือ 0 ${item.unit})`
    : `⚠️ ใกล้หมด! (เหลือ ${newQty} ${item.unit})`;

  const body = `${item.name} (${item.id}) • ${item.location || 'Store FL.6'}`;

  return await sendWebPushNotification({
    title,
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `low-stock-${item.id}`,
    url: `/?tab=inventory&search=${encodeURIComponent(item.id)}`,
    type: 'low_stock',
    data: { itemId: item.id, newQty, minStock: item.minStock },
  });
}

/**
 * Trigger Stock-In / Stock-Out Web Push alert for all stock transactions
 */
export async function triggerStockTransactionPush(data: {
  type: 'in' | 'out';
  itemId?: string;
  itemName: string;
  qty: number;
  unit: string;
  requestedBy: string;
  purpose: string;
  newQty?: number;
  minStock?: number;
}) {
  const cfg = await fetchWebPushConfigFromFirestore();
  if (!cfg.enabled || cfg.notifyImportantRequisition === false) {
    return { success: false, skipped: true, reason: 'Disabled by Admin config' };
  }

  const isStockIn = data.type === 'in';
  const remainTitle =
    data.newQty !== undefined
      ? isStockIn
        ? ` (รวม ${data.newQty} ${data.unit})`
        : ` (เหลือ ${data.newQty} ${data.unit})`
      : '';

  const title = isStockIn
    ? `📥 รับเข้า +${data.qty} ${data.unit}${remainTitle}`
    : `📤 เบิกออก ${data.qty} ${data.unit}${remainTitle}`;

  const rawPurpose = (data.purpose || '').trim();
  const isDefaultPurpose =
    !rawPurpose ||
    rawPurpose === 'ทั่วไป' ||
    rawPurpose === 'งานซ่อมบำรุงประจำวัน' ||
    rawPurpose === 'รับสินค้าเข้าคลัง';
  const purposeSuffix = isDefaultPurpose ? '' : ` • ${rawPurpose}`;

  const lowStockSuffix =
    !isStockIn && data.newQty !== undefined && data.newQty <= (data.minStock ?? 5)
      ? data.newQty <= 0
        ? ' • 🚨 ของหมด!'
        : ' • ⚠️ ใกล้หมด'
      : '';

  const body = `${data.itemName}\nโดย ${data.requestedBy}${purposeSuffix}${lowStockSuffix}`;

  return await sendWebPushNotification({
    title,
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `stock-${data.type}-${data.itemId || Date.now()}`,
    url: '/?tab=history',
    type: 'requisition',
    data,
  });
}

/**
 * Trigger Bulk Requisition / Stock-In Web Push alert
 */
export async function triggerBulkRequisitionPush(data: {
  type?: 'in' | 'out';
  items: Array<{ itemId?: string; itemName: string; qty: number; unit: string; newQty?: number }>;
  requestedBy: string;
  purpose: string;
}) {
  const cfg = await fetchWebPushConfigFromFirestore();
  if (!cfg.enabled || cfg.notifyImportantRequisition === false) {
    return { success: false, skipped: true, reason: 'Disabled by Admin config' };
  }

  const isStockIn = data.type === 'in';
  const totalUnits = data.items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
  const previewNames = data.items
    .slice(0, 2)
    .map(i => `${i.itemName} (${i.qty} ${i.unit})`)
    .join(', ');
  const moreCount = data.items.length > 2 ? ` +อีก ${data.items.length - 2} รายการ` : '';

  const title = isStockIn
    ? `📥 รับเข้า ${data.items.length} รายการ (รวม ${totalUnits} ชิ้น)`
    : `📤 เบิกออก ${data.items.length} รายการ (รวม ${totalUnits} ชิ้น)`;
  const body = `${previewNames}${moreCount}\nโดย ${data.requestedBy}`;

  return await sendWebPushNotification({
    title,
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `bulk-req-${Date.now()}`,
    url: '/?tab=history',
    type: 'requisition',
    data,
  });
}

/**
 * Trigger Important Requisition Web Push alert (respects Admin master config)
 */
export async function triggerImportantRequisitionPush(data: {
  itemId?: string;
  itemName: string;
  qty: number;
  unit: string;
  requestedBy: string;
  purpose: string;
  newQty?: number;
  isImportant?: boolean;
}) {
  return await triggerStockTransactionPush({
    type: 'out',
    ...data,
  });
}

/**
 * Trigger Purchase Order Web Push alert (respects Admin master config)
 */
export async function triggerPurchaseOrderPush(order: {
  id: string;
  itemName: string;
  qty: number;
  unit: string;
  requestedBy: string;
  urgency?: string;
}) {
  const cfg = await fetchWebPushConfigFromFirestore();
  if (!cfg.enabled || cfg.notifyPurchaseOrder === false) {
    return { success: false, skipped: true, reason: 'Disabled by Admin config' };
  }

  const urgencyText = order.urgency === 'urgent' || order.urgency === 'critical' ? ' (ด่วน)' : '';
  const title = `🛒 สั่งซื้อใหม่ ${order.qty} ${order.unit}${urgencyText}`;
  const body = `${order.itemName}\nโดย ${order.requestedBy} (${order.id})`;

  return await sendWebPushNotification({
    title,
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `order-${order.id}`,
    url: '/?tab=orders',
    type: 'order',
    data: order,
  });
}

/**
 * Send a test Web Push notification to all devices
 * Automatically ensures the current device is subscribed & synced before firing the test
 */
export async function testWebPushNotification(user?: {
  id?: string;
  name?: string;
  role?: string;
}): Promise<{ success: boolean; message?: string; error?: string; sent?: number }> {
  try {
    // 1. Ensure current device is subscribed & synced with active VAPID key
    await subscribeToWebPush(user, { skipWelcome: true });

    // 2. Trigger backend VAPID broadcast + Firestore real-time relay
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'การทดสอบ Web Push ไม่สำเร็จ' };
    }

    // 3. Also ensure local OS notification & in-app push banner appear immediately on this device
    await triggerLocalPushDisplay({
      title: '🔔 ทดสอบแจ้งเตือนสำเร็จ',
      body: 'ระบบแจ้งเตือนคลัง Store FL.6 พร้อมใช้งาน',
      tag: `test-push-local-${Date.now()}`,
      showOsNotification: (data.sent || 0) === 0,
    });

    return {
      success: true,
      message: data.message || 'ส่งการแจ้งเตือนทดสอบสำเร็จแล้ว',
      sent: Math.max(data.sent || 0, 1),
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ' };
  }
}
