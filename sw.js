// sw.js – BesichtigungsApp v7.2
// Vereinfachte Strategie: Cache-First für alles
// Garantiert Offline-Funktion nach erstem vollständigen Laden

const VERSION = 'v7-2';
const CACHE_NAME = 'besichtigung-' + VERSION;

const RESOURCES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.tailwindcss.com',
];

// INSTALL: Versuche alles zu cachen, aber fail nicht wenn CDN offline ist
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Versuche alle Ressourcen zu cachen
      return Promise.allSettled(
        RESOURCES.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] Konnte nicht cachen:', url);
          });
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ACTIVATE: Lösche alte Caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_NAME;
        }).map(function(key) {
          return caches.delete(key);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// FETCH: Cache-First für alles
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      // Wenn im Cache, sofort zurückgeben
      if (cached) {
        return cached;
      }
      
      // Sonst vom Netzwerk holen und cachen
      return fetch(event.request).then(function(response) {
        // Nur erfolgreiche Responses cachen
        if (response && response.status === 200) {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(function() {
        // Offline und nicht im Cache
        if (event.request.destination === 'document') {
          return new Response(
            '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Offline</title></head>' +
            '<body style="font-family:sans-serif;padding:2rem;text-align:center">' +
            '<h1>Offline</h1><p>Bitte Internetverbindung herstellen.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
