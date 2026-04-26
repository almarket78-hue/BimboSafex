// BimboSafe — Firebase Messaging Service Worker
// Gestisce le notifiche push FCM quando l'app è chiusa o in background

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey:            'AIzaSyCwj_PlBbQV2CLxkhsLSPCRInJZB_JHNVs',
    projectId:         'bimbosafe-1',
    messagingSenderId: '206224535277',
    appId:             '1:206224535277:android:2571bf6f2e83cda3ce66e4'
});

const messaging = firebase.messaging();

// Gestisce messaggi FCM in background (app chiusa o minimizzata)
messaging.onBackgroundMessage(payload => {
    console.log('[FCM SW] Messaggio in background:', payload);

    const data = payload.data || {};
    let title = '🚨 BimboSafe — EMERGENZA';
    let body  = 'Bambino solo in auto!';
    let url   = '/BimboSafex/';

    if (data.fromName) body = data.fromName + ' ha un bambino solo in auto!';
    if (data.mapsUrl)  url  = data.mapsUrl;

    return self.registration.showNotification(title, {
        body:             body,
        icon:             '/BimboSafex/icons/icon-192.png',
        badge:            '/BimboSafex/icons/icon-72.png',
        vibrate:          [1000, 500, 1000, 500, 2000],
        requireInteraction: true,          // rimane fino al tocco dell'utente
        tag:              'bimbosafe-emergency',
        renotify:         true,
        data:             { url, payload: data.payload }
    });
});

// Gestisce il tocco sulla notifica
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = event.notification.data?.url || '/BimboSafex/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            // Se l'app è già aperta, portala in primo piano
            for (const client of list) {
                if ('focus' in client) return client.focus();
            }
            // Altrimenti apri una nuova finestra
            return clients.openWindow(url);
        })
    );
});
