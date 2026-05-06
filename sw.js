const CACHE_NAME = 'cleanit-diluciones-v1';
const ASSETS = [
  './',
  './index.html',
  './admin.html',
  './styles.css',
  './config.js',
  './data.js',
  './app.js',
  './admin.js',
  './assets/logo.svg'
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => null));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((res) => res || caches.match('./index.html'))));
});
