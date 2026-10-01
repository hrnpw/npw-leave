// Service Worker for Leave-NPW PWA
const CACHE_NAME = 'leave-npw-v4'; // Bumped version to clear old cache
const STATIC_ASSETS = [
  '/offline',
  '/manifest.json',
];

// Cache expiration times (in milliseconds)
const CACHE_MAX_AGE = {
  api: 60 * 1000, // 60 seconds for API responses
  static: 24 * 60 * 60 * 1000, // 24 hours for static assets
  pages: 5 * 60 * 1000, // 5 minutes for pages
};

// Helper to check if cached response is expired
function isCacheExpired(cachedResponse) {
  if (!cachedResponse) return true;

  const cachedTime = cachedResponse.headers.get('sw-cached-time');
  if (!cachedTime) return true;

  const cacheType = cachedResponse.headers.get('sw-cache-type') || 'api';
  const maxAge = CACHE_MAX_AGE[cacheType] || CACHE_MAX_AGE.api;

  return Date.now() - parseInt(cachedTime) > maxAge;
}

// Helper to add cache metadata to response
function addCacheMetadata(response, cacheType = 'api') {
  const headers = new Headers(response.headers);
  headers.set('sw-cached-time', Date.now().toString());
  headers.set('sw-cache-type', cacheType);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers,
  });
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Claim all clients immediately
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions
  if (request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Skip Next.js RSC requests - don't cache them
  if (request.url.includes('_rsc=')) {
    return;
  }

  // Navigation requests: NetworkFirst with fallback to /offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Don't cache redirected responses
          if (response.redirected) {
            return response;
          }
          return response;
        })
        .catch(() => {
          return caches.match('/offline').then((offline) => {
            return offline || new Response('Offline', { status: 503 });
          });
        })
    );
    return;
  }

  // API routes: Selective caching with expiration
  if (request.url.includes('/api/')) {
    // Realtime endpoints - NetworkOnly (no cache)
    const realtimeEndpoints = [
      '/api/hr/approvals/pending',
      '/api/hr/leaves/pending',
      '/api/hr/leaves/pendingCount',
      '/api/teacher/leaves/status',
      '/api/teacher/push/',
    ];

    const isRealtime = realtimeEndpoints.some(endpoint =>
      request.url.includes(endpoint)
    );

    if (isRealtime) {
      // Don't cache realtime data - let it pass through
      return;
    }

    // Other APIs: NetworkFirst with expiration check
    event.respondWith(
      caches.match(request).then((cached) => {
        // Check if cache is valid and not expired
        if (cached && !isCacheExpired(cached)) {
          // Return cached response but update in background
          fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                const responseWithMetadata = addCacheMetadata(response.clone(), 'api');
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, responseWithMetadata);
                });
              }
            })
            .catch(() => {
              // Ignore background update errors
            });
          return cached;
        }

        // Cache expired or doesn't exist - fetch from network
        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const responseWithMetadata = addCacheMetadata(response.clone(), 'api');
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseWithMetadata);
              });
            }
            return response;
          })
          .catch(() => {
            // Network failed - return stale cache if available
            if (cached) {
              return cached;
            }
            return new Response('Network error', { status: 503 });
          });
      })
    );
    return;
  }

  // Static assets & pages: CacheFirst with expiration
  event.respondWith(
    caches.match(request, { ignoreSearch: false }).then((cached) => {
      // Check if cache exists and is not expired
      if (cached && !isCacheExpired(cached)) {
        return cached;
      }

      return fetch(request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200) {
            return response;
          }

          // Don't cache redirected responses
          if (response.redirected) {
            return response;
          }

          // Determine cache type based on URL
          const cacheType = request.mode === 'navigate' ? 'pages' : 'static';
          const responseWithMetadata = addCacheMetadata(response.clone(), cacheType);

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseWithMetadata);
          });

          return response;
        })
        .catch(() => {
          // If both cache and network fail, show offline page
          // Use stale cache as last resort
          if (cached) {
            return cached;
          }
          return caches.match('/offline').then((offline) => {
            return offline || new Response('Offline', { status: 503 });
          });
        });
    })
  );
});

// Message event - for manual cache updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push event - show notification
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || 'Leave-NPW';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag,
      data: { url: data.url || '/teacher' },
    })
  );
});

// Notification click - focus or open the target URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/teacher', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// Browser rotated the subscription - re-register it with the server
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const newSubscription = event.newSubscription || (await self.registration.pushManager.getSubscription());
      if (!newSubscription) return;

      try {
        await fetch('/api/teacher/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(JSON.parse(JSON.stringify(newSubscription))),
        });
      } catch {
        // Session may be expired; client will re-sync on next app open.
      }
    })()
  );
});
