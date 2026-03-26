const CACHE_NAME = 'doformy-v2';
const ASSETS = [
    'index.html',
    'style.css',
    'app.js',
    '../shared/progress-store.js',
    '../shared/workout-logic.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'workout-reminder') {
        event.waitUntil(checkAndNotify());
    }
});

async function checkAndNotify() {
    const today = new Date();
    const day = today.getDay();
    const workoutDays = [1, 3, 5];
    
    if (workoutDays.includes(day)) {
        const registration = await self.registration;
        await registration.showNotification('DoFormy - Tréning', {
            body: 'Dnes je tréningový deň! 💪',
            icon: '../assets/icon-192.png',
            badge: '../assets/icon-72.png',
            tag: 'workout-reminder',
            vibrate: [200, 100, 200]
        });
    }
}

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('./index.html')
    );
});
