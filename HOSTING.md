# Hosting KasirKu (HTTPS) & Update PWA

KasirKu adalah PWA statis — cukup di-host sebagai file statis via **HTTPS**.

## 1. Struktur yang di-upload

```text
/ (root hosting ATAU subfolder, keduanya didukung)
├── index.html
├── manifest.json
├── service-worker.js
├── css/style.css
├── js/app.js
└── assets/
    ├── icons/icon-192.png
    ├── icons/icon-512.png
    ├── icons/icon-maskable-512.png
    └── qris/qris-toko.png   ← opsional, QRIS toko
```

Semua path PWA memakai **relatif** (`manifest.json`, `./assets/...`, `service-worker.js`),
sehingga hosting di `https://domain.com/` **maupun** `https://domain.com/kasir/` sama-sama valid.

> `preview.html` tidak perlu di-upload — itu mirror khusus preview lokal.

## 2. Opsi hosting HTTPS gratis

| Hosting | Cara |
|---|---|
| Netlify | Drag & drop folder ini ke app.netlify.com → langsung HTTPS |
| Vercel | `vercel` di folder ini → deploy |
| GitHub Pages | Push ke repo → Settings → Pages → branch main. URL: `https://user.github.io/repo/` |
| Cloudflare Pages | Upload folder → deploy |

Localhost (`http://localhost` / `127.0.0.1`) juga dianggap secure context — PWA bisa dites lokal.

## 3. Alur install di HP Android (Chrome/Edge)

1. Buka URL HTTPS
2. Banner **"Install KasirKu"** muncul (atau menu ⋮ → *Install app / Add to Home screen*)
3. Konfirmasi → icon KasirKu muncul di home screen
4. Buka dari icon → jalan **standalone** (tanpa address bar)
5. Buka lagi saat offline → tetap berfungsi penuh (data di LocalStorage)

iOS Safari: banner menampilkan hint *Share → Add to Home Screen* (iOS tidak mendukung beforeinstallprompt).

## 4. Update aplikasi (aman untuk data)

1. Edit file (mis. `js/app.js`)
2. Naikkan versi:
   - `APP_VERSION` di `js/app.js` (tampil di Pengaturan)
   - `CACHE_VERSION` di `service-worker.js` (mis. `kasirku-v1.0.1` → `kasirku-v1.0.2`)
3. Upload ulang
4. Saat user membuka app: SW baru ter-install otomatis, cache lama dihapus
5. **LocalStorage (produk, transaksi, pengeluaran, pengaturan, shifts, heldSales)
   TIDAK disentuh service worker** — data 100% aman antar versi

User juga bisa memaksa cek update: **Pengaturan → Aplikasi & Data → Cek Update**.

## 5. Catatan

- Service worker hanya aktif via **HTTPS** atau `localhost`.
- Jika SW gagal register, aplikasi tetap jalan normal sebagai website (error ditangani senyap).
- Backup berkala: **Pengaturan → Export Backup** (file JSON berisi semua data).
