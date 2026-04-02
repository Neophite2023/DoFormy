const CACHE_NAME = 'doformy-v6';
const APP_ASSETS = [
    './index.html',
    './style.css',
    './manifest.json',
    './app.js',
    '../shared/engine.js',
    '../assets/icon-192.png',
    '../assets/icon-512.png',
    '../assets/icon-1024.png',
    '../assets/apple-touch-icon.png'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(APP_ASSETS))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key.startsWith('doformy-') && key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== 'GET') {
        return;
    }

    if (url.pathname.includes('/api/')) {
        event.respondWith(fetch(request));
        return;
    }

    const isNavigate = request.mode === 'navigate';

    // Fast startup: serve app shell from cache immediately, update in background.
    if (isNavigate) {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE_NAME);
            const cached = await cache.match('./index.html', { ignoreSearch: true });
            const fetchPromise = fetch(request)
                .then(response => {
                    cache.put('./index.html', response.clone());
                    return response;
                })
                .catch(() => null);

            return cached || (await fetchPromise) || new Response('Offline', { status: 503 });
        })());
        return;
    }

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request, { ignoreSearch: true });

        if (cached) {
            // Update cache in background, but don't block UI.
            event.waitUntil(
                fetch(request)
                    .then(response => cache.put(request, response.clone()))
                    .catch(() => null)
            );
            return cached;
        }

        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
    })());
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(clients.openWindow('./index.html'));
});
