// BimboSafe Service Worker v3 — gestisce notifiche push e messaggi Firebase
const CACHE_NAME = 'bimbosafe-v3';

self.addEventListener('install', e => {
    e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Gestisce messaggi FCM in background
self.addEventListener('push', event => {
    if (!event.data) return;
    let data = {};
    try { data = event.data.json(); } catch(e) { data = { title: '🚨 BimboSafe', body: event.data.text() }; }

    const title = data.title || '🚨 EMERGENZA — BimboSafe';
    const body  = data.body  || 'Bambino solo in auto!';
    const mapsUrl = data.data?.mapsUrl || data.mapsUrl || '/BimboSafex/';

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon:  '/BimboSafex/icons/icon-192.png',
            badge: '/BimboSafex/icons/icon-72.png',
            vibrate: [1000, 500, 1000, 500, 2000],
            requireInteraction: true,
            tag: 'bimbosafe-emergency',
            renotify: true,
            data: { mapsUrl }
        })
    );
});

// Gestisce messaggi dal codice app tramite postMessage
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, body, mapsUrl } = event.data;
        self.registration.showNotification(title || '🚨 EMERGENZA — BimboSafe', {
            body: body || 'Bambino solo in auto!',
            icon:  '/BimboSafex/icons/icon-192.png',
            badge: '/BimboSafex/icons/icon-72.png',
            vibrate: [1000, 500, 1000, 500, 2000],
            requireInteraction: true,
            tag: 'bimbosafe-emergency',
            renotify: true,
            data: { mapsUrl }
        });
    }
});

// Tocco sulla notifica — apre l'app
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const mapsUrl = event.notification.data?.mapsUrl;
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const client of list) {
                if ('focus' in client) return client.focus();
            }
            return clients.openWindow(mapsUrl || '/BimboSafex/');
        })
    );
});

