// BimboSafe — Firebase Messaging Service Worker v4
// Supporta: FCM, Background Sync, Periodic Background Sync

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const FB_CONFIG = {
    apiKey:            'AIzaSyCwj_PlBbQV2CLxkhsLSPCRInJZB_JHNVs',
    projectId:         'bimbosafe-1',
    messagingSenderId: '206224535277',
    appId:             '1:206224535277:android:2571bf6f2e83cda3ce66e4',
    databaseURL:       'https://bimbosafe-1-default-rtdb.firebaseio.com'
};

firebase.initializeApp(FB_CONFIG);
const messaging = firebase.messaging();

// ==================== FCM BACKGROUND ====================
messaging.onBackgroundMessage(payload => {
    const title = payload.notification?.title || '🚨 EMERGENZA — BimboSafe';
    const body  = payload.notification?.body  || 'Controlla immediatamente l\'auto!';
    const mapsUrl = payload.data?.mapsUrl || '/BimboSafex/';

    self.registration.showNotification(title, {
        body,
        icon:               '/BimboSafex/icons/icon-192.png',
        badge:              '/BimboSafex/icons/icon-72.png',
        vibrate:            [2000, 1000, 2000, 1000, 2000],
        requireInteraction: true,
        tag:                'bimbosafe-emergency',
        renotify:           true,
        silent:             false,
        data:               { url: mapsUrl },
        actions: [
            { action: 'open',    title: '🗺️ Apri Maps' },
            { action: 'dismiss', title: '✅ OK' }
        ]
    });
});

// ==================== BACKGROUND SYNC ====================
// Triggered dall'app con: registration.sync.register('emergency-sync')
// Eseguito dal browser quando torna la connessione o in background
self.addEventListener('sync', event => {
    if (event.tag === 'emergency-sync') {
        event.waitUntil(checkEmergency());
    }
});

// ==================== PERIODIC BACKGROUND SYNC ====================
// Eseguito periodicamente dal browser (ogni ~15 minuti minimo su Chrome)
// Registrato dall'app con: registration.periodicSync.register('heartbeat', {minInterval: 60000})
self.addEventListener('periodicsync', event => {
    if (event.tag === 'heartbeat') {
        event.waitUntil(checkConnection());
    }
    if (event.tag === 'check-inbox') {
        event.waitUntil(checkInbox());
    }
});

// ==================== FUNZIONI DI CHECK ====================

// Legge inbox Firebase e mostra notifica se c'è un'emergenza
async function checkInbox() {
    try {
        // Legge myId da IndexedDB (salvato dall'app)
        const myId = await getFromIDB('myId');
        if (!myId) return;

        const resp = await fetch(
            `https://bimbosafe-1-default-rtdb.firebaseio.com/inbox/${myId}.json`
        );
        if (!resp.ok) return;
        const data = await resp.json();
        if (!data) return;

        // Processa ogni messaggio
        for (const key of Object.keys(data)) {
            const msg = data[key];
            if (!msg || !msg.payload) continue;
            let payload;
            try { payload = JSON.parse(msg.payload); } catch(e) { continue; }
            if (payload.type !== 'emergency') continue;

            // Mostra notifica
            await self.registration.showNotification('🚨 EMERGENZA — BimboSafe', {
                body:               (msg.fromName || msg.from || 'Contatto') + ' ha un bambino solo in auto!',
                icon:               '/BimboSafex/icons/icon-192.png',
                badge:              '/BimboSafex/icons/icon-72.png',
                vibrate:            [1000, 500, 1000, 500, 2000],
                requireInteraction: true,
                tag:                'bimbosafe-emergency',
                renotify:           true,
                data:               { url: payload.mapsUrl || '/BimboSafex/' }
            });

            // Rimuove il messaggio letto
            await fetch(
                `https://bimbosafe-1-default-rtdb.firebaseio.com/inbox/${myId}/${key}.json`,
                { method: 'DELETE' }
            );
        }
    } catch(e) {
        console.log('[SW] checkInbox error:', e);
    }
}

async function checkEmergency() {
    return checkInbox();
}

async function checkConnection() {
    try {
        const myId = await getFromIDB('myId');

        // 1. Salva timestamp heartbeat in cache
        const cache = await caches.open('bimbosafe-cache');
        await cache.put('/last-heartbeat', new Response(Date.now().toString()));

        if (!myId) return;

        // 2. Aggiorna presenza su Firebase
        await fetch(
            `https://bimbosafe-1-default-rtdb.firebaseio.com/signaling/${myId}.json`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ online: true, ts: Date.now() })
            }
        );

        // 3. Controlla inbox per emergenze non lette
        await checkInbox();

        console.log('[SW] Heartbeat OK — ', new Date().toLocaleTimeString());
    } catch(e) {
        console.log('[SW] Heartbeat error:', e.message);
    }
}

// ==================== INDEXEDDB HELPER ====================
function getFromIDB(key) {
    return new Promise((resolve) => {
        try {
            const req = indexedDB.open('bimbosafe-sw', 1);
            req.onupgradeneeded = e => e.target.result.createObjectStore('data');
            req.onsuccess = e => {
                const tx = e.target.result.transaction('data', 'readonly');
                const store = tx.objectStore('data');
                const get = store.get(key);
                get.onsuccess = () => resolve(get.result || null);
                get.onerror = () => resolve(null);
            };
            req.onerror = () => resolve(null);
        } catch(e) { resolve(null); }
    });
}

// ==================== MESSAGGI DALL'APP ====================
self.addEventListener('message', event => {
    // Salva myId in IndexedDB per uso in background
    if (event.data?.type === 'SET_MY_ID') {
        saveToIDB('myId', event.data.myId);
    }
    // Mostra notifica di emergenza
    if (event.data?.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification(
            event.data.title || '🚨 EMERGENZA — BimboSafe', {
            body:               event.data.body || 'Controlla immediatamente l\'auto!',
            icon:               '/BimboSafex/icons/icon-192.png',
            badge:              '/BimboSafex/icons/icon-72.png',
            vibrate:            [1000, 500, 1000, 500, 2000],
            requireInteraction: true,
            tag:                'bimbosafe-emergency',
            renotify:           true,
            data:               { url: event.data.mapsUrl || '/BimboSafex/' }
        });
    }
});

function saveToIDB(key, value) {
    try {
        const req = indexedDB.open('bimbosafe-sw', 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore('data');
        req.onsuccess = e => {
            const tx = e.target.result.transaction('data', 'readwrite');
            tx.objectStore('data').put(value, key);
        };
    } catch(e) {}
}

// ==================== NOTIFICA CLICCATA ====================
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = event.notification.data?.url || '/BimboSafex/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const client of list) {
                if ('focus' in client) return client.focus();
            }
            return clients.openWindow(url);
        })
    );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
