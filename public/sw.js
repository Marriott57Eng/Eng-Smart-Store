// ============================================================================
// ENG SMART STORE PWA Service Worker (V6 - Safe Caching & Web Push Engine)
// ============================================================================

const CACHE_VERSION = 'v6';
const STATIC_CACHE = `eng-store-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `eng-store-runtime-${CACHE_VERSION}`;
const API_CACHE = `eng-store-api-${CACHE_VERSION}`;
const FONT_CACHE = `eng-store-fonts-${CACHE_VERSION}`;

const CURRENT_CACHES = [STATIC_CACHE, RUNTIME_CACHE, API_CACHE, FONT_CACHE];

// Core static assets required to boot the application shell offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.png',
  '/icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/logo.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  'https://fonts.googleapis.com/css2?family=Fredericka+the+Great&display=swap'
];

// ============================================================================
// 1. Installation: Resilient pre-caching of application shell & static assets
// ============================================================================
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cachePromises = STATIC_ASSETS.map(async (url) => {
        try {
          const req = new Request(url, { cache: 'reload' });
          const res = await fetch(req);
          if (res && (res.status === 200 || res.status === 0)) {
            await cache.put(req, res);
          }
        } catch (err) {
          console.warn(`[SW] Pre-caching asset skipped (${url}):`, err?.message || err);
        }
      });
      await Promise.allSettled(cachePromises);
    })
  );
});

// ============================================================================
// 2. Activation: Clean up old obsolete cache versions & claim active clients
// ============================================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!CURRENT_CACHES.includes(key)) {
            console.log(`[SW] Pruning obsolete cache: ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================================================
// 3. Fetch Event Interceptor with Intelligent Caching Strategies
// ============================================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFont =
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  // 3.0a NEVER intercept cross-origin APIs (Firestore, Firebase Auth, Google APIs, etc.)
  // Only Google Fonts are eligible for cross-origin caching.
  if (!isSameOrigin && !isGoogleFont) {
    return;
  }

  // 3.0b NEVER intercept Vite dev modules, source files, or versioned dep chunks
  // Caching these across restarts causes mismatched React chunk versions (Invalid hook call).
  if (
    isSameOrigin && (
      url.pathname === '/sw.js' ||
      url.pathname.startsWith('/node_modules/') ||
      url.pathname.startsWith('/src/') ||
      url.pathname.startsWith('/@') ||
      url.pathname.endsWith('.ts') ||
      url.pathname.endsWith('.tsx') ||
      url.pathname.endsWith('.jsx') ||
      url.searchParams.has('v') ||
      url.searchParams.has('t') ||
      url.searchParams.has('import') ||
      url.pathname.startsWith('/api/push') ||
      url.pathname.startsWith('/api/orders') ||
      url.pathname.startsWith('/api/auth') ||
      url.pathname.startsWith('/api/line/webhook') ||
      url.pathname.startsWith('/api/line/test') ||
      url.pathname.startsWith('/api/line/notify') ||
      url.pathname.startsWith('/api/health')
    )
  ) {
    return;
  }

  // 3.1 Non-GET requests & WebSockets & Real-time AI bypass caching
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/live') ||
    url.pathname.startsWith('/api/chat') ||
    url.pathname.startsWith('/api/analyze')
  ) {
    if (event.request.method !== 'GET') {
      event.respondWith(
        fetch(event.request).catch(() => {
          return new Response(
            JSON.stringify({
              error: 'network_offline',
              message: 'ระบบอยู่ในโหมดออฟไลน์ รายการของคุณได้รับการบันทึกในเครื่องแล้ว และจะซิงค์เมื่อเชื่อมต่อเน็ต'
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
      );
    }
    return;
  }

  // 3.2 HTML Navigation requests (Network-First with fast cache fallback)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetchWithTimeout(event.request, 4500)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedIndex = (await caches.match('/index.html')) || (await caches.match('/'));
          if (cachedIndex) return cachedIndex;

          return new Response(
            `<!DOCTYPE html>
            <html lang="th">
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>ENG SMART STORE - Offline</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
                  .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px 24px; max-width: 420px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                  h1 { font-size: 20px; margin-bottom: 12px; color: #38bdf8; }
                  p { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
                  button { background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: bold; cursor: pointer; font-size: 14px; }
                </style>
              </head>
              <body>
                <div class="card">
                  <h1>📡 กำลังอยู่ในโหมดออฟไลน์</h1>
                  <p>ไม่สามารถเชื่อมต่อสัญญาณอินเทอร์เน็ตได้ในขณะนี้ กรุณาตรวจสอบการเชื่อมต่อ Wi-Fi หรือ Cellular แล้วลองใหม่อีกครั้ง</p>
                  <button onclick="window.location.reload()">ลองใหม่อีกครั้ง</button>
                </div>
              </body>
            </html>`,
            {
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
          );
        })
    );
    return;
  }

  // 3.3 Read-Only APIs (GET /api/*) -> Always Network-First with Cache Fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(API_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response(
            JSON.stringify({
              items: [],
              offline: true,
              message: 'Served offline from service worker fallback'
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // 3.4 Web Fonts & Google Fonts (Cache-First with cross-origin opaque support)
  if (
    isGoogleFont ||
    url.pathname.match(/\.(woff|woff2|ttf|eot)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
              const copy = networkResponse.clone();
              caches.open(FONT_CACHE).then((cache) => cache.put(event.request, copy));
            }
            return networkResponse;
          })
          .catch(() => cached || new Response('', { status: 408 }));
      })
    );
    return;
  }

  // 3.5 Images, Icons, Logos, Favicons (Cache-First)
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|gif)$/) ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
              const copy = networkResponse.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy));
            }
            return networkResponse;
          })
          .catch(() => cached || new Response('', { status: 404 }));
      })
    );
    return;
  }

  // 3.6 Production Hashed Bundles ONLY (/assets/*)
  if (isSameOrigin && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, copy));
            }
            return networkResponse;
          })
          .catch(() => cached || new Response('', { status: 504 }));
      })
    );
  }
});

// Helper for fetch with timeout
function fetchWithTimeout(request, timeoutMs = 3500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Network request timeout'));
    }, timeoutMs);

    fetch(request)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ============================================================================
// 4. Web Push Notification Event Handlers
// ============================================================================
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'แจ้งเตือนคลัง Store FL.6', body: event.data.text() };
    }
  }

  const title = data.title || '🔔 แจ้งเตือนคลัง Store FL.6';
  const rawTag = data.tag || `eng-push-${Date.now()}`;
  // Ensure test/welcome notifications always generate a fresh OS popup banner
  const effectiveTag =
    rawTag === 'test-push' || rawTag === 'welcome-push'
      ? `${rawTag}-${Date.now()}`
      : rawTag;

  const notificationData = {
    url: data.url || '/',
    timestamp: Date.now(),
    type: data.type || 'general',
    extra: data.data || {}
  };

  const fullOptions = {
    body: data.body || 'มีรายการอัปเดตในคลัง Store FL.6',
    icon: data.icon || '/icon-192.png',
    data: notificationData,
    tag: effectiveTag,
    renotify: true,
    vibrate: [200, 100, 200],
    requireInteraction: false
  };

  const fallbackOptions = {
    body: fullOptions.body,
    icon: '/icon-192.png',
    tag: effectiveTag,
    data: notificationData,
  };

  const showNotificationPromise = self.registration
    .showNotification(title, fullOptions)
    .catch((err) => {
      console.warn('[SW] Full showNotification failed, falling back to basic options:', err);
      return self.registration.showNotification(title, fallbackOptions);
    });

  // Also broadcast to any open client windows so in-app banner & sound alert fire immediately
  const notifyClientsPromise = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((windowClients) => {
      for (const client of windowClients) {
        try {
          client.postMessage({
            type: 'WEB_PUSH_RECEIVED',
            payload: {
              title,
              body: fullOptions.body,
              icon: fullOptions.icon,
              url: notificationData.url,
              tag: effectiveTag,
              notificationType: notificationData.type,
              timestamp: notificationData.timestamp,
            }
          });
        } catch (_) {}
      }
    })
    .catch(() => {});

  event.waitUntil(Promise.all([showNotificationPromise, notifyClientsPromise]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl).catch(() => {});
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        let applicationServerKey = event.oldSubscription?.options?.applicationServerKey;
        if (!applicationServerKey) {
          const keyRes = await fetch('/api/push/public-key', { cache: 'no-store' });
          const keyData = await keyRes.json();
          if (keyData?.publicKey) {
            const padding = '='.repeat((4 - (keyData.publicKey.length % 4)) % 4);
            const base64 = (keyData.publicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
            const rawData = atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; ++i) {
              outputArray[i] = rawData.charCodeAt(i);
            }
            applicationServerKey = outputArray;
          }
        }
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription })
        });
      } catch (err) {
        console.warn('[SW] pushsubscriptionchange re-subscription failed:', err);
      }
    })()
  );
});

// ============================================================================
// 5. Client Messages: Skip Waiting, Local Notification & Version Handshake
// ============================================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: CACHE_VERSION });
  }
  if (event.data && event.data.type === 'SHOW_LOCAL_NOTIFICATION') {
    const { title, options } = event.data;
    if (title) {
      self.registration.showNotification(title, options || {}).catch(() => {});
    }
  }
});
