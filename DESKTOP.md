# KasirKu — Catatan Desktop (Electron / Tauri)

Aplikasi ini sengaja dibuat **tanpa backend** dan **tanpa API browser yang wajib**,
sehingga dapat dibungkus menjadi aplikasi desktop (`KasirKu.exe` / `.AppImage` / `.dmg`)
tanpa mengubah logika bisnis.

## Pemisahan yang sudah ada

| Lapisan | Lokasi | Catatan |
|---|---|---|
| Logika bisnis | `js/app.js` | 100% vanilla JS, tanpa dependensi |
| Tampilan | `index.html`, `css/style.css` | Statik, tanpa framework |
| Penyimpanan | LocalStorage via objek `Storage` | Satu titik akses — mudah diganti IPC/file JSON saat dibungkus desktop |

## Kode yang sadar-lingkungan (browser-specific)

Semua API browser sudah dibungkus guard sehingga aman di webview Electron/Tauri:

- **Service worker**: hanya diregistrasi jika `"serviceWorker" in navigator` dan
  protokol `https:`/`localhost`. Di `file://` atau Electron tanpa SW → dilewati senyap.
- **beforeinstallprompt / install**: hanya di browser Chromium; di desktop app → tidak muncul (memang tidak relevan).
- **navigator.onLine**: dipakai hanya untuk indikator; desktop selalu "online" secara logika.
- **window.print()**: bekerja di Electron (export PDF) dan Tauri (plugin print) tanpa perubahan kode.

## Langkah membungkus nanti (ringkas)

### Electron
1. `npm init -y && npm i -D electron`
2. Buat `main.js`: `BrowserWindow` memuat `index.html`, `webPreferences: { contextIsolation: true }`.
3. (Opsional) Ganti objek `Storage` di app.js dengan IPC ke file JSON — satu-satunya titik perubahan.

### Tauri
1. Arahkan `distDir` ke folder project ini (statis murni, tak perlu dev server).
2. Data LocalStorage tetap berjalan di webview; untuk persist file, gunakan plugin `fs` nanti.

## Yang TIDAK boleh dilakukan saat membungkus

- Jangan hapus/reset LocalStorage saat update app (lihat `DATA_VERSION` + `migrasiData()` di `js/app.js`).
- Jangan pindahkan logika kasir ke proses main/native — biarkan di `js/app.js` agar tetap satu sumber.
