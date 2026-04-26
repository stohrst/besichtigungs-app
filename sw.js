// sw.js – BesichtigungsApp v7.0
// Strategie:
//   CDN-Assets (React, Babel, Tailwind): Cache-first → Offline-Betrieb gesichert
//   App-Shell (HTML, Manifest, Icons):   Network-first → Updates werden eingespielt
//
// WICHTIG: Bei einer neuen App-Version CACHE_VERSION erhöhen.
// Der alte Cache wird dann beim nächsten SW-Activate automatisch gelöscht.

const CACHE_VERSION  = 'v7-0';
const CACHE_APP      = 'besichtigung-app-'  + CACHE_VERSION;
const CACHE_CDN      = 'besichtigung-cdn-'  + CACHE_VERSION;
const VALID_CACHES   = [CACHE_APP, CACHE_CDN];

// App-Shell: alle Dateien müssen erreichbar sein (addAll schlägt sonst fehl)
const APP_SHELL = [
  './BesichtigungsApp_v7_0.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// CDN-Assets: best-effort – kein Installationsfehler bei Offline-Install
const CDN_ASSETS = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.tailwindcss.com',
];

// ── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_APP)
      .then(function (cache) {
        return cache.addAll(APP_SHELL);
      })
      .then(function () {
        // CDN best-effort: Promise.allSettled verhindert Install-Fehler bei
        // schlechter Verbindung. CDN wird beim ersten echten Request gecacht.
        return caches.open(CACHE_CDN).then(function (cache) {
          return Promise.allSettled(
            CDN_ASSETS.map(function (url) {
              return fetch(url, { mode: 'cors', credentials: 'omit' })
                .then(function (resp) {
                  if (resp.ok || resp.type === 'opaque') {
                    return cache.put(url, resp);
                  }
                })
                .catch(function () { /* offline – wird beim ersten Request gecacht */ });
            })
          );
        });
      })
      .then(function () {
        // Neuen SW sofort aktivieren, ohne auf Tab-Schließen zu warten
        return self.skipWaiting();
      })
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) { return !VALID_CACHES.includes(k); })
            .map(function (k) {
              console.log('[SW] Alter Cache gelöscht:', k);
              return caches.delete(k);
            })
        );
      })
      .then(function () {
        // SW übernimmt sofort alle offenen Clients (Tabs)
        return self.clients.claim();
      })
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', function (event) {
  // Nur GET abfangen
  if (event.request.method !== 'GET') return;

  var url;
  try {
    url = new URL(event.request.url);
  } catch (e) {
    return;
  }

  // Chrome-Interna und nicht-http(s) ignorieren
  if (!url.protocol.startsWith('http')) return;

  var isCDN = (url.hostname === 'unpkg.com' || url.hostname === 'cdn.tailwindcss.com');

  if (isCDN) {
    // CDN: Cache-first → garantiertes Offline-Rendering
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        if (cached) return cached;
        return fetch(event.request, { mode: 'cors', credentials: 'omit' })
          .then(function (resp) {
            if (resp.ok || resp.type === 'opaque') {
              caches.open(CACHE_CDN).then(function (c) {
                c.put(event.request, resp.clone());
              });
            }
            return resp;
          })
          .catch(function () {
            return new Response(
              '/* CDN offline – kein Cache vorhanden */',
              { status: 503, headers: { 'Content-Type': 'text/javascript' } }
            );
          });
      })
    );
    return;
  }

  // Same-Origin (App-Shell): Network-first → Updates werden automatisch geladen
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then(function (resp) {
          if (resp.ok) {
            caches.open(CACHE_APP).then(function (c) {
              c.put(event.request, resp.clone());
            });
          }
          return resp;
        })
        .catch(function () {
          return caches.match(event.request).then(function (cached) {
            if (cached) return cached;
            // Fallback: leere Offline-Seite, damit kein Chrome-Fehler angezeigt wird
            return new Response(
              '<html><body style="font-family:sans-serif;padding:2rem">' +
              '<h2>Offline</h2><p>App wird aus dem Cache geladen – bitte Tab neu öffnen.</p>' +
              '</body></html>',
              { status: 503, headers: { 'Content-Type': 'text/html' } }
            );
          });
        })
    );
  }
});
