// sw.js - BesichtigungsApp v8.7
// Network-First fuer HTML (Updates sofort wirksam)
// Cache-First fuer CDN-Libs (Offline-Betrieb)
// Stale-While-Revalidate fuer Icons/Manifest

var VERSION = 'v8-7';
var CACHE_NAME = 'besichtigung-' + VERSION;

var CDN_RESOURCES = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js'
];

var APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

var ALL_RESOURCES = APP_SHELL.concat(CDN_RESOURCES);

// INSTALL: Alle Ressourcen vorab cachen
self.addEventListener('install', function(event) {
  console.log('[SW] Install ' + VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.allSettled(
        ALL_RESOURCES.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] Cache fehlgeschlagen:', url, err);
          });
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ACTIVATE: Alte Caches entfernen, sofort Kontrolle uebernehmen
self.addEventListener('activate', function(event) {
  console.log('[SW] Activate ' + VERSION);
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key.startsWith('besichtigung-') && key !== CACHE_NAME;
        }).map(function(key) {
          console.log('[SW] Loesche alten Cache:', key);
          return caches.delete(key);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// FETCH: Strategie je nach Ressourcentyp
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  var url = new URL(event.request.url);

  // Nur eigene Origin und CDN-Requests behandeln
  var isSameOrigin = url.origin === self.location.origin;
  var isCDN = url.hostname === 'unpkg.com';

  if (!isSameOrigin && !isCDN) return;

  var isHTML = event.request.destination === 'document' ||
               url.pathname.endsWith('.html') ||
               url.pathname === '/' ||
               url.pathname.endsWith('/');

  // HTML: Network-First (Updates sofort wirksam)
  if (isHTML) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return caches.match(event.request).then(function(cached) {
          if (cached) return cached;
          return caches.match('./index.html').then(function(indexCached) {
            if (indexCached) return indexCached;
            return new Response(
              '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">' +
              '<meta name="viewport" content="width=device-width,initial-scale=1">' +
              '<title>Offline</title>' +
              '<style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#124d5c;color:#fff;text-align:center}' +
              '.c{padding:2rem}h1{font-size:1.5rem;margin-bottom:1rem}p{opacity:.8}</style></head>' +
              '<body><div class="c"><h1>Besichtigungs-App</h1>' +
              '<p>Offline. Bitte erstmalig mit Internetverbindung starten.</p>' +
              '<p style="margin-top:1rem;font-size:.85rem">Danach ist die App vollstaendig offline nutzbar.</p>' +
              '</div></body></html>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          });
        });
      })
    );
    return;
  }

  // CDN-Libraries: Cache-First (aendern sich nicht, Offline-kritisch)
  if (isCDN) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // App-Shell (Icons, Manifest): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var fetchPromise = fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return cached || new Response('Offline', { status: 503 });
      });
      return cached || fetchPromise;
    })
  );
});
