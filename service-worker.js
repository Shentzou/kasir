/* ============================================================
   service-worker.js — KasirKu PWA

   Prinsip:
   - App shell (HTML/CSS/JS/icon/manifest/QRIS) di-precache saat install.
   - Strategi: cache-first untuk asset statis; network-first untuk
     navigasi HTML (fallback ke cache saat offline).
   - SW TIDAK PERNAH menyentuh LocalStorage — data kasir (produk,
     transaksi, pengeluaran, pengaturan) aman dari update cache.
   - Update: naikkan CACHE_VERSION → cache lama dihapus SETELAH
     cache baru aktif, data pengguna tidak tersentuh.
   ============================================================ */
"use strict";

/* Naikkan versi ini setiap rilis → cache lama dihapus setelah SW baru aktif.
   SW TIDAK PERNAH menyentuh LocalStorage/IndexedDB — data pengguna aman. */
const CACHE_VERSION = "kasirku-v1.0.2";

/* App shell yang di-precache. QRIS lokal ikut di-cache agar tampil offline. */
const PRECACHE = [
  "index.html",
  "manifest.json",
  "css/style.css",
  "js/app.js",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-512.png",
  "assets/qris/qris-toko.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        /* Promise.allSettled: file yang belum ada (mis. QRIS belum disediakan
           user) TIDAK menggagalkan install — hanya dilewati. */
        Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" }))))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* Navigasi halaman: network-first, fallback index.html dari cache (offline OK) */
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put("index.html", copy));
          return res;
        })
        .catch(() =>
          caches.match("index.html").then((hit) => hit || new Response("Offline", { status: 503 }))
        )
    );
    return;
  }

  /* Same-origin statis: cache-first, isi cache saat baru ditemukan */
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
  /* Origin lain (font Google, dll): biarkan lewat network; kalau gagal offline
     browser sudah memakai font fallback — app tetap jalan. */
});
