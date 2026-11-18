// POP-UP-PWA: Zero-Dependency Ephemeral Event App & Backend
// Handles PWA assets, manifest, dynamic SVG icon, and real-time state synchronization via Cloudflare KV.

const APP_CONFIG = {
  title: "POP-UP PWA • Event Itinerary",
  shortTitle: "Event LFG",
  description: "Real-time, offline-capable event itinerary and crawl tracker",
  iconEmoji: "🔥",
  themeColor: "#0b0f17",
  backgroundColor: "#0b0f17"
};

const DYNAMIC_SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${APP_CONFIG.iconEmoji}</text></svg>`;

const MANIFEST_JSON = {
  name: APP_CONFIG.title,
  short_name: APP_CONFIG.shortTitle,
  description: APP_CONFIG.description,
  start_url: "/",
  display: "standalone",
  background_color: APP_CONFIG.backgroundColor,
  theme_color: APP_CONFIG.themeColor,
  icons: [
    {
      src: "/apple-touch-icon.png",
      sizes: "192x192",
      type: "image/svg+xml",
      purpose: "any maskable"
    }
  ]
};

// High-performance Service Worker script with Cache-First strategy
const SERVICE_WORKER_SCRIPT = `
const CACHE_NAME = 'pop-up-pwa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept /api/ requests with Service Worker cache
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Cache-first with background revalidation (stale-while-revalidate)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const kv = env.POP_UP_KV || env.NYC_CRAWL_KV;

    // 1. App Icons
    if (url.pathname === '/favicon.ico' || url.pathname === '/apple-touch-icon.png') {
      return new Response(DYNAMIC_SVG_ICON, {
        headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }
      });
    }

    // 2. Web App Manifest
    if (url.pathname === '/manifest.json') {
      return new Response(JSON.stringify(MANIFEST_JSON), {
        headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=86400' }
      });
    }

    // 3. Service Worker
    if (url.pathname === '/sw.js') {
      return new Response(SERVICE_WORKER_SCRIPT, {
        headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' }
      });
    }

    // 4. Real-time Multi-Device State Synchronization API
    if (url.pathname === '/api/state') {
      if (request.method === 'GET') {
        let completed = [];
        if (kv) {
          const raw = await kv.get('completed_stops');
          if (raw) completed = JSON.parse(raw);
        }
        return new Response(JSON.stringify({ completed }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store'
          }
        });
      }

      if (request.method === 'POST') {
        try {
          const body = await request.json();
          const stopId = body.stopId;
          const isCompleted = !!body.completed;
          let completed = [];

          if (kv) {
            const raw = await kv.get('completed_stops');
            if (raw) completed = JSON.parse(raw);

            if (isCompleted) {
              if (!completed.includes(stopId)) completed.push(stopId);
            } else {
              completed = completed.filter(id => id !== stopId);
            }

            await kv.put('completed_stops', JSON.stringify(completed));
          }

          return new Response(JSON.stringify({ success: true, completed }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-store'
            }
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), { status: 400 });
        }
      }

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        });
      }
    }

    // 5. Serve HTML App (Loaded from KV, raw asset, or embedded fallback)
    let html = null;
    if (kv) {
      html = await kv.get('app_html');
    }

    // Fallback: fetch from hosted raw source if provided in env
    if (!html && env.RAW_HTML_URL) {
      const resp = await fetch(env.RAW_HTML_URL);
      html = await resp.text();
    }

    if (!html) {
      return new Response("Pop-up PWA template is ready! Upload your index.html into KV under 'app_html' or set RAW_HTML_URL.", {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });
  }
};
