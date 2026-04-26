// sw.js – BesichtigungsApp v7.1
// KORREKTUR: index.html statt BesichtigungsApp_v7_0.html

const CACHE_VERSION  = 'v7-1';
const CACHE_APP      = 'besichtigung-app-'  + CACHE_VERSION;
const CACHE_CDN      = 'besichtigung-cdn-'  + CACHE_VERSION;
const VALID_CACHES   = [CACHE_APP, CACHE_CDN];

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

const CDN_ASSETS = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.tailwindcss.com',
];

self.addEventListener('install', function (event) {
  console.log('[SW] Install v7-1');
  event.waitUntil(
    caches.open(CACHE_APP)
      .then(function (cache) {
        return cache.addAll(APP_SHELL);
      })
      .then(function () {
        return caches.open(CACHE_CDN).then(function (cache) {
          return Promise.allSettled(
            CDN_ASSETS.map(function (url) {
              return fetch(url, { mode: 'cors', credentials: 'omit' })
                .then(function (resp) {
                  if (resp.ok || resp.type === 'opaque') {
                    return cache.put(url, resp);
                  }
                })
                .catch(function () {});
            })
          );
        });
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys.filter(function (k) { return !VALID_CACHES.includes(k); })
              .map(function (k) { return caches.delete(k); })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  var url;
  try {
    url = new URL(event.request.url);
  } catch (e) {
    return;
  }

  if (!url.protocol.startsWith('http')) return;

  var isCDN = (url.hostname === 'unpkg.com' || url.hostname === 'cdn.tailwindcss.com');

  if (isCDN) {
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
              '/* CDN offline */',
              { status: 503, headers: { 'Content-Type': 'text/javascript' } }
            );
          });
      })
    );
    return;
  }

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
            return new Response(
              '<!DOCTYPE html><html><body><h2>Offline</h2><p>Cache wird geladen...</p></body></html>',
              { status: 503, headers: { 'Content-Type': 'text/html' } }
            );
          });
        })
    );
  }
});
