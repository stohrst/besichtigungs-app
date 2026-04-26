// sw.js – BesichtigungsApp v7.3
// KORREKTUR: Network-First für HTML (Updates funktionieren)
// Cache-First für CDN (Offline funktioniert)

const VERSION = 'v7-3';
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

// INSTALL
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.allSettled(
        RESOURCES.map(function(url) {
          return cache.add(url).catch(function() {});
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ACTIVATE
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

// FETCH
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  
  var url = new URL(event.request.url);
  var isHTML = event.request.destination === 'document' || 
               url.pathname.endsWith('.html') || 
               url.pathname === '/' || 
               url.pathname.endsWith('/');
  
  // HTML: Network-First (Updates funktionieren)
  if (isHTML) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(function() {
          return caches.match(event.request).then(function(cached) {
            if (cached) return cached;
            return new Response(
              '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Offline</title></head>' +
              '<body style="font-family:sans-serif;padding:2rem;text-align:center">' +
              '<h1>Offline</h1><p>Bitte Internetverbindung herstellen.</p></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          });
        })
    );
    return;
  }
  
  // CDN & Assets: Cache-First (Offline funktioniert)
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
      }).catch(function() {
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
