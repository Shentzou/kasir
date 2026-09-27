/* ============================================================
   KasirKu — Aplikasi Kasir Toko
   app.js — Navigasi SPA, LocalStorage, dan manajemen produk
   ============================================================ */

"use strict";

/* ============================================================
   VERSI APLIKASI & DATA
   - APP_VERSION: versi app (harus sama dengan CACHE_VERSION di service-worker.js)
   - DATA_VERSION: versi skema LocalStorage. Jika skema berubah, naikkan
     dan tambahkan langkah migrasi di migrasiData() — JANGAN hapus data.
   ============================================================ */
const APP_VERSION = "1.0.1";
const DATA_VERSION = 1;
const DATA_VERSION_KEY = "kasirku_data_version";

function migrasiData() {
  const versi = Number(localStorage.getItem(DATA_VERSION_KEY) || 0);
  if (versi === DATA_VERSION) return;
  /* Contoh migrasi versi berikutnya:
     if (versi < 2) { ...pindahkan/ubah key lama... }
  */
  localStorage.setItem(DATA_VERSION_KEY, String(DATA_VERSION));
  console.info("KasirKu: data versi " + DATA_VERSION + " siap (dari " + versi + ")");
}
migrasiData();

/* ============================================================
   LAPISAN PENYIMPANAN (LocalStorage)
   ============================================================ */
const Storage = {
  KEYS: {
    PRODUK: "kasirku_produk",
    TRANSAKSI: "kasirku_transaksi",
    PENGATURAN: "kasirku_pengaturan",
    KERANJANG: "kasirku_keranjang",
    DISKON: "kasirku_diskon",
    PENGELUARAN: "kasirku_pengeluaran",
    PROFIL: "kasirku_profil",
    USERS: "kasirku_users",
    SHIFTS: "kasirku_shifts",
    HELD: "kasirku_held",
    STOKLOG: "kasirku_stoklog",
  },

  baca(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("Gagal membaca " + key + ":", e);
      return fallback;
    }
  },

  tulis(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn("Gagal menulis " + key + ":", e);
      tampilkanToast("Gagal menyimpan data ke penyimpanan browser!");
      return false;
    }
  },

  hapus(key) {
    localStorage.removeItem(key);
  },

  /* ---- Facade semantik: SATU pintu akses data (konsisten untuk semua halaman;
     saat dibungkus desktop, cukup ganti lapisan ini) ---- */
  getProducts() {
    return this.baca(this.KEYS.PRODUK, []);
  },
  saveProducts(data) {
    return this.tulis(this.KEYS.PRODUK, data);
  },
  getTransactions() {
    return this.baca(this.KEYS.TRANSAKSI, []);
  },
  saveTransactions(data) {
    return this.tulis(this.KEYS.TRANSAKSI, data);
  },
  getExpenses() {
    return this.baca(this.KEYS.PENGELUARAN, []);
  },
  saveExpenses(data) {
    return this.tulis(this.KEYS.PENGELUARAN, data);
  },
  getSettings() {
    return this.baca(this.KEYS.PENGATURAN, {});
  },
  saveSettings(data) {
    return this.tulis(this.KEYS.PENGATURAN, data);
  },
  getCart() {
    return this.baca(this.KEYS.KERANJANG, []);
  },
  saveCart(data) {
    return this.tulis(this.KEYS.KERANJANG, data);
  },
};

/* ============================================================
   DATA AWAL (dipakai hanya saat pertama kali / storage kosong)
   ============================================================ */
const PRODUK_AWAL = [
  { id: 1, nama: "Beras Premium 5kg", kategori: "Sembako", beli: 61000, jual: 68000, stok: 24, minStok: 5 },
  { id: 2, nama: "Minyak Goreng 1L", kategori: "Sembako", beli: 15200, jual: 17500, stok: 40, minStok: 5 },
  { id: 3, nama: "Gula Pasir 1kg", kategori: "Sembako", beli: 14200, jual: 16000, stok: 8, minStok: 5 },
  { id: 4, nama: "Telur Ayam 1kg", kategori: "Sembako", beli: 25500, jual: 28000, stok: 15, minStok: 5 },
  { id: 5, nama: "Tepung Terigu 1kg", kategori: "Sembako", beli: 11500, jual: 13000, stok: 3, minStok: 5 },
  { id: 6, nama: "Indomie Goreng", kategori: "Makanan", beli: 2900, jual: 3500, stok: 120, minStok: 10 },
  { id: 7, nama: "Sarden Kaleng 155g", kategori: "Makanan", beli: 8000, jual: 9500, stok: 30, minStok: 6 },
  { id: 8, nama: "Kopi Sachet Kapal Api", kategori: "Minuman", beli: 1600, jual: 2000, stok: 200, minStok: 24 },
  { id: 9, nama: "Teh Kotak 250ml", kategori: "Minuman", beli: 4200, jual: 5000, stok: 48, minStok: 10 },
  { id: 10, nama: "Air Mineral 600ml", kategori: "Minuman", beli: 3000, jual: 4000, stok: 72, minStok: 12 },
  { id: 11, nama: "Sabun Mandi Batang", kategori: "Kebersihan", beli: 4300, jual: 5500, stok: 36, minStok: 6 },
  { id: 12, nama: "Deterjen Bubuk 800g", kategori: "Kebersihan", beli: 16000, jual: 18500, stok: 2, minStok: 4 },
];

/*
 * Transaksi mulai dari KOSONG — semua data berasal dari penjualan nyata di halaman Kasir.
 * Setiap transaksi menyimpan snapshot produk & harga saat transaksi (bukan referensi),
 * sehingga perubahan harga produk di kemudian hari TIDAK mengubah transaksi lama.
 */
const TRANSAKSI_AWAL = [];

/* ============================================================
   STATE APLIKASI
   ============================================================ */
let produkData = Storage.baca(Storage.KEYS.PRODUK, null);
if (!Array.isArray(produkData)) {
  produkData = PRODUK_AWAL;
  Storage.tulis(Storage.KEYS.PRODUK, produkData);
}

let transaksiData = Storage.baca(Storage.KEYS.TRANSAKSI, null);
if (!Array.isArray(transaksiData)) {
  transaksiData = TRANSAKSI_AWAL;
  Storage.tulis(Storage.KEYS.TRANSAKSI, transaksiData);
}

let keranjang = Storage.baca(Storage.KEYS.KERANJANG, []);
if (!Array.isArray(keranjang)) keranjang = [];

/* Migrasi data lama: pastikan setiap produk punya batas minimum stok (default 5).
   Dipanggil setiap load — murah dan membuat data lama otomatis ikut skema baru. */
function migrasiProduk() {
  let berubah = false;
  produkData.forEach((p) => {
    if (!Number.isFinite(p.minStok) || p.minStok < 0) {
      /* produk tanpa batas sendiri → pakai default dari Settings */
      p.minStok = Number(pengaturan.lowStockDefault) || 5;
      berubah = true;
    }
    if (!p.sku) {
      p.sku = "SKU-" + String(p.id).padStart(4, "0");
      berubah = true;
    }
    if (!p.barcode) {
      p.barcode = "899" + String(p.id).padStart(10, "0");
      berubah = true;
    }
  });
  if (berubah) Storage.tulis(Storage.KEYS.PRODUK, produkData);
}
migrasiProduk();
/* Normalisasi transaksi lama/rusak (format `items`, objek tunggal, null, dsb.) */
migrasiTransaksi();

/* Diskon transaksi aktif (persen), ikut tersimpan di LocalStorage */
let diskonPersen = Storage.baca(Storage.KEYS.DISKON, 0);
if (!Number.isFinite(diskonPersen) || diskonPersen < 0 || diskonPersen > 100) diskonPersen = 0;

/* Metode pembayaran aktif di halaman kasir */
let metodeBayar = "Tunai";
/* Nominal uang tunai yang diketik kasir (angka murni, tanpa titik) */
let uangDiterima = 0;

/* ID berikutnya = max(id) + 1, aman setelah hapus */
function idProdukBerikutnya() {
  return produkData.reduce((max, p) => Math.max(max, p.id), 0) + 1;
}

/* ============================================================
   PENGELUARAN (data nyata — tersimpan di LocalStorage)
   ============================================================ */
const KATEGORI_PENGELUARAN = ["Belanja stok", "Operasional", "Transportasi", "Listrik", "Internet", "Lainnya"];

let pengeluaranData = Storage.baca(Storage.KEYS.PENGELUARAN, []);
if (!Array.isArray(pengeluaranData)) pengeluaranData = [];

/* SATU generator nomor urut untuk semua ID (INV/EXP/HOLD):
   nomor berikutnya = max nomor existing + 1 — aman dari duplikat setelah hapus/void */
function nomorBerikutnya(daftar, prefix) {
  return (
    daftar.reduce((m, x) => {
      const n = parseInt(String(x.id || "").replace(prefix, ""), 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0) + 1
  );
}

/* ID berikutnya = max nomor EXP + 1, aman setelah hapus */
function idPengeluaranBerikutnya() {
  return "EXP-" + String(nomorBerikutnya(pengeluaranData, "EXP-")).padStart(4, "0");
}

/* ============================================================
   PENGATURAN TOKO & STRUK (identitas struk, printer thermal)
   ============================================================ */
const PENGATURAN_DEFAULT = {
  namaToko: "Toko Sembako Berkah",
  alamatToko: "Jl. Merdeka No. 45, Bandung",
  teleponToko: "0812-3456-7890",
  kasir: "Budi Santoso",
  logoStruk: "", /* dataURL gambar logo (opsional) */
  logoInisial: "K", /* fallback inisial jika tanpa gambar */
  lebarKertas: 80, /* 58mm / 80mm printer thermal */
  strukFooter: "Terima kasih telah berbelanja",
  strukCatatan: "Barang yang sudah dibeli tidak dapat ditukar",

  /* --- Pengaturan fungsional (v2) --- */
  mataUang: "IDR",            /* IDR | USD — formatter tunggal */
  taxEnabled: false,          /* PPN default NONAKTIF */
  taxRate: 0,                 /* 0–100; non-numerik dianggap 0 */
  qrisEnabled: true,          /* QRIS sebagai metode bayar */
  tema: "terang",             /* terang | gelap | sistem */
  lowStockDefault: 5,         /* batas menipis utk produk tanpa minStok sendiri */
  autoPrint: false,           /* cetak struk otomatis setelah bayar (default: manual) */
  suaraKasir: false,          /* beep saat scan */
  qrisImage: "",              /* dataURL upload user; kosong → file assets/qris/qris-toko.png */
  strukShowLogo: true,
  strukShowAlamat: true,
  strukShowTelepon: true,
  strukShowKasir: true,
};

/* Bersihkan nilai pengaturan: setting rusak/kosong → default aman (tanpa NaN) */
function sanitasiPengaturan(raw) {
  const s = Object.assign({}, PENGATURAN_DEFAULT, raw && typeof raw === "object" ? raw : {});
  const num = (v, def, min, maks) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(maks, Math.max(min, n)) : def;
  };
  s.taxEnabled = s.taxEnabled === true;
  s.taxRate = num(s.taxRate, 0, 0, 100);
  s.lowStockDefault = Math.round(num(s.lowStockDefault, 5, 0, 9999));
  s.lebarKertas = Number(s.lebarKertas) === 58 ? 58 : 80;
  s.mataUang = s.mataUang === "USD" ? "USD" : "IDR";
  s.tema = ["terang", "gelap", "sistem"].includes(s.tema) ? s.tema : "terang";
  s.qrisEnabled = s.qrisEnabled !== false;
  s.autoPrint = s.autoPrint === true;
  s.suaraKasir = s.suaraKasir === true;
  s.strukShowLogo = s.strukShowLogo !== false;
  s.strukShowAlamat = s.strukShowAlamat !== false;
  s.strukShowTelepon = s.strukShowTelepon !== false;
  s.strukShowKasir = s.strukShowKasir !== false;
  if (!s.namaToko) s.namaToko = PENGATURAN_DEFAULT.namaToko;
  return s;
}

/* Terapkan tema (Terang/Gelap/Sistem) ke seluruh aplikasi — data-[tema] di <html> */
function terapkanTema() {
  let tema = pengaturan.tema;
  if (tema === "sistem") tema = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "gelap" : "terang";
  document.documentElement.setAttribute("data-tema", tema);
  /* Meta theme-color ikut tema (warna bar browser/PWA standalone) */
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", tema === "gelap" ? "#0b1220" : "#ffffff");
}

let pengaturan = sanitasiPengaturan(Storage.baca(Storage.KEYS.PENGATURAN, {}));

/* ---- Users (lokal, tanpa password asli — hanya PIN hash sederhana) ----
   Tidak ada API eksternal; PIN disimpan sebagai hash SHA-256 (bukan plaintext). */
let users = Storage.baca(Storage.KEYS.USERS, null);
if (!Array.isArray(users) || users.length === 0) {
  users = [{ id: 1, nama: "Budi Santoso", peran: "Administrator", pinHash: null }];
  Storage.tulis(Storage.KEYS.USERS, users);
}

/* ---- Profil pengguna aktif (single-user lokal, terkait users[].id) ----
   Field: nama, username, telepon, alamat, bio, avatar (dataURL terkompres).
   Role/userId TIDAK dapat diubah dari halaman profil (informasi saja). */
const PROFIL_DEFAULT = { userId: 1, nama: "Budi Santoso", username: "budi", telepon: "", alamat: "", bio: "", avatar: "" };
let profil = Object.assign({}, PROFIL_DEFAULT, Storage.baca(Storage.KEYS.PROFIL, {}));
if (profil.userId !== 1 && !users.some((u) => u.id === profil.userId)) profil.userId = 1; /* user harus ada */

function simpanProfil() {
  Storage.tulis(Storage.KEYS.PROFIL, profil);
}
/* Inisial untuk avatar tanpa foto (maks 2 huruf) */
function inisialAvatar(nama) {
  return String(nama || "?").trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?";
}
/* Kompres gambar via canvas (maks size px) — hindari LocalStorage penuh.
   mime: "image/jpeg" (avatar) atau "image/png" (QR — pola harus tajam). */
function kompresGambar(file, ukuranMaks, kualitas, mime) {
  mime = mime || "image/jpeg";
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      reject(new Error("File harus berupa gambar (PNG/JPG/WEBP)."));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("Ukuran file terlalu besar (maksimal 8 MB)."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const s = Math.min(img.naturalWidth, img.naturalHeight); /* crop persegi tengah */
      const canvas = document.createElement("canvas");
      canvas.width = ukuranMaks;
      canvas.height = ukuranMaks;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, ukuranMaks, ukuranMaks);
      resolve(canvas.toDataURL(mime, kualitas));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gambar tidak dapat dibaca."));
    };
    img.src = url;
  });
}

/* ---- Shift kasir (buka/tutup dengan perhitungan kas) ---- */
let shifts = Storage.baca(Storage.KEYS.SHIFTS, []);
if (!Array.isArray(shifts)) shifts = [];
function shiftAktif() {
  return shifts.find((s) => s.status === "OPEN") || null;
}

/* ---- Held sales (Tunda/Recall) — tidak mengurangi stok ---- */
let heldSales = Storage.baca(Storage.KEYS.HELD, []);
if (!Array.isArray(heldSales)) heldSales = [];

/* ---- Riwayat perubahan stok (terlacak, paling baru di depan) ---- */
let stokLog = Storage.baca(Storage.KEYS.STOKLOG, []);
if (!Array.isArray(stokLog)) stokLog = [];

/* ============================================================
   HELPER
   ============================================================ */
/* Formatter mata uang TUNGGAL — semua nominal lewat sini (Settings → mataUang).
   IDR: "Rp 10.000" · USD: "$10.00" */
const rupiah = (n) => {
  const v = Number(n || 0);
  if (pengaturan.mataUang === "USD") return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "Rp " + v.toLocaleString("id-ID", { maximumFractionDigits: 0 });
};
/* Versi singkat untuk label grafik: 1.250.000 → "1,3jt", 74.000 → "74rb" */
const rupiahSingkat = (n) => {
  if (n >= 1e9) return Number((n / 1e9).toFixed(1)).toLocaleString("id-ID") + " M";
  if (n >= 1e6) return Number((n / 1e6).toFixed(1)).toLocaleString("id-ID") + "jt";
  if (n >= 1e3) return Math.round(n / 1e3) + "rb";
  return String(Math.round(n || 0));
};
/* Tanggal dalam format YYYY-MM-DD lokal (untuk filter & perbandingan) */
const tanggalISO = (d) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const escapeHTML = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const KATEGORI_DEFAULT = ["Sembako", "Makanan", "Minuman", "Kebersihan"];

/* ============================================================
   NORMALISASI TRANSAKSI — single source of truth akses item.

   Format standar aplikasi: field `item` = ARRAY snapshot item transaksi.
   (Dipertahankan demi backward-compat data yang sudah tersimpan.)

   Sumber error "t.item.forEach is not a function": transaksi lama/dari
   file lama bisa punya `item` berupa objek tunggal, null, undefined, atau
   format lain — sehingga (t.item || []).forEach() meledak.

   Dua lapis pertahanan:
   1. migrasiTransaksi()  — perbaiki data di LocalStorage saat load (sekali).
   2. trxItems(t)         — helper AMAN yang selalu mengembalikan ARRAY,
                            dipakai semua fitur yang membaca transaksi.
   ============================================================ */
/* Ubah satu entri item (apa pun bentuknya) menjadi item standar; null jika tidak valid */
function normalisasiSatuItem(i) {
  if (!i || typeof i !== "object") return null;
  const qty = Math.max(0, Number(i.qty) || 0);
  const harga = Math.max(0, Number(i.harga) || 0);
  const subtotal = Number.isFinite(Number(i.subtotal)) ? Number(i.subtotal) : harga * qty;
  return {
    id: Number.isFinite(Number(i.id)) ? Number(i.id) : null,
    nama: String(i.nama || "(tanpa nama)"),
    sku: i.sku != null ? String(i.sku) : null,
    barcode: i.barcode != null ? String(i.barcode) : null,
    harga,
    qty,
    subtotal,
    hargaBeli: Math.max(0, Number(i.hargaBeli) || 0),
  };
}

/* Normalisasi SATU transaksi: pastikan t.item adalah ARRAY valid */
function normalisasiSatuTransaksi(t) {
  if (!t || typeof t !== "object") return null;
  /* Dukung format eksternal `items` (array) → salin ke `item` standar */
  let arr = null;
  if (Array.isArray(t.item)) arr = t.item;
  else if (Array.isArray(t.items)) arr = t.items;
  else if (t.items && typeof t.items === "object" && !Array.isArray(t.items) && Array.isArray(t.items.list)) arr = t.items.list;
  else if (t.item && typeof t.item === "object") {
    /* Bedakan: objek ITEM tunggal ({nama,qty,...}) vs MAP {"0":{...},"1":{...}}.
       Deteksi: entri berupa objek dengan kunci nama/qty → map (urutan cek
       penting; cabang ini harus sebelum cabang objek tunggal). */
    const vals = Object.values(t.item);
    const miripMap =
      vals.length > 0 &&
      vals.every((v) => v && typeof v === "object" && !Array.isArray(v) && ("nama" in v || "name" in v)) &&
      !("qty" in t.item);
    arr = miripMap ? vals : [t.item]; /* map → array; objek tunggal → array 1 elemen */
  }

  const item = (arr || []).map(normalisasiSatuItem).filter(Boolean);
  const out = Object.assign({}, t, { item });
  /* Field alias lama dihapus setelah dikonversi (tanpa kehilangan data) */
  if ("items" in out) delete out.items;
  /* totalItem konsisten dengan isi array */
  if (!Number.isFinite(Number(t.totalItem)) || Number(t.totalItem) !== item.reduce((a, i) => a + i.qty, 0)) {
    out.totalItem = item.reduce((a, i) => a + i.qty, 0);
  }
  return out;
}

/* Helper AMAN pembaca item transaksi — selalu ARRAY. Gunakan di semua fitur. */
function trxItems(t) {
  if (Array.isArray(t)) return t; /* sudah array item */
  if (Array.isArray(t && t.item)) return t.item;
  if (Array.isArray(t && t.items)) return t.items;
  return [];
}

/* Migrasi data transaksi di LocalStorage: konversi format lama/rusak → standar.
   TIDAK menghapus data — hanya memperbaiki bentuk. */
function migrasiTransaksi() {
  if (!Array.isArray(transaksiData)) {
    transaksiData = [];
    Storage.tulis(Storage.KEYS.TRANSAKSI, transaksiData);
    return;
  }
  let berubah = false;
  transaksiData = transaksiData.map((t) => {
    const n = normalisasiSatuTransaksi(t);
    if (n && JSON.stringify(n) !== JSON.stringify(t)) berubah = true;
    return n || t;
  }).filter(Boolean);
  if (berubah) Storage.tulis(Storage.KEYS.TRANSAKSI, transaksiData);
}

/* ---- FUNGSI PUSAT perubahan stok. SEMUA perubahan wajib lewat sini.
   reason: SALE | VOID | RESTOCK | MANUAL_ADJUSTMENT
   Stok dijamin tidak pernah negatif; setiap perubahan tercatat di stokLog. */
function adjustStock(productId, quantity, reason, catatan) {
  const p = produkData.find((x) => x.id === productId);
  if (!p) return { ok: false, pesan: "Produk tidak ditemukan (id " + productId + ")" };
  const delta = Number(quantity);
  if (!Number.isInteger(delta) || delta === 0) return { ok: false, pesan: "Jumlah stok tidak valid" };
  const stokBaru = p.stok + delta;
  if (stokBaru < 0) {
    return { ok: false, pesan: "Stok \"" + p.nama + "\" hanya tersisa " + p.stok + " — tidak boleh minus" };
  }
  const lama = p.stok;
  p.stok = stokBaru;
  stokLog.unshift({
    id: p.id,
    nama: p.nama,
    dari: lama,
    ke: stokBaru,
    delta,
    reason,
    catatan: catatan || "",
    tanggal: tanggalISO(new Date()),
    waktu: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
  });
  if (stokLog.length > 500) stokLog.length = 500; /* batasi ukuran log */
  Storage.tulis(Storage.KEYS.STOKLOG, stokLog);
  return { ok: true, dari: lama, ke: stokBaru };
}

/* Kategori dinamis: gabungan default + kategori dari data produk */
function semuaKategori() {
  const set = new Set(KATEGORI_DEFAULT);
  produkData.forEach((p) => p.kategori && set.add(p.kategori));
  return [...set].sort();
}

/* ============================================================
   NAVIGASI HALAMAN
   ============================================================ */
const pageMeta = {
  dashboard: { title: "Dashboard", subtitle: "Ringkasan performa toko hari ini" },
  kasir: { title: "Kasir", subtitle: "Buat transaksi penjualan baru" },
  produk: { title: "Produk", subtitle: "Kelola daftar produk & stok toko" },
  transaksi: { title: "Transaksi", subtitle: "Riwayat semua transaksi penjualan" },
  keuangan: { title: "Keuangan", subtitle: "Pemasukan, pengeluaran, dan laba" },
  laporan: { title: "Laporan", subtitle: "Buat dan unduh laporan toko" },
  pengaturan: { title: "Pengaturan", subtitle: "Konfigurasi aplikasi & toko" },
};

function navigasiKe(page) {
  $$(".page").forEach((p) => p.classList.remove("active"));
  const target = $("#page-" + page);
  if (target) target.classList.add("active");

  $$(".nav-link").forEach((l) => l.classList.toggle("active", l.dataset.page === page));

  const meta = pageMeta[page];
  if (meta) {
    $("#pageTitle").textContent = meta.title;
    $("#pageSubtitle").textContent = meta.subtitle;
  }

  $("#sidebar").classList.remove("open");
  $("#sidebarOverlay").classList.remove("show");
  window.scrollTo({ top: 0 });
}

/* ============================================================
   TOAST
   ============================================================ */
let toastTimer;
let beepCtx = null;

/* Debounce util (map timer per-key) — dipakai search input agar render
   tidak jalan di setiap keystroke saat data besar. Perilaku akhir sama. */
const debounceTimers = {};
function debounce(key, fn, ms) {
  clearTimeout(debounceTimers[key]);
  debounceTimers[key] = setTimeout(fn, ms || 150);
}

function tampilkanToast(pesan) {
  const toast = $("#toast");
  toast.textContent = pesan;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

/* Beep Web Audio (tanpa file) — dipakai saat scan sukses & pembayaran sukses.
   Diaktifkan/dimatikan lewat pengaturan suaraKasir. Guard aman di semua browser. */
function bunyiBeep(freq) {
  if (pengaturan.suaraKasir !== true) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    beepCtx = beepCtx || new Ctx();
    if (beepCtx.state === "suspended") beepCtx.resume();
    const osc = beepCtx.createOscillator();
    const gain = beepCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq || 1200;
    gain.gain.setValueAtTime(0.06, beepCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, beepCtx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(beepCtx.destination);
    osc.start();
    osc.stop(beepCtx.currentTime + 0.15);
  } catch (e) {
    /* audio tidak tersedia — abaikan, jangan ganggu alur kasir */
  }
}

/* ============================================================
   PWA: service worker, install prompt, indikator online/offline
   (Semua dibungkus guard — jika SW tidak tersedia (file://, Electron
   nanti), app tetap jalan normal tanpa error.)
   ============================================================ */
let deferredInstallPrompt = null;
let swRegistering = null;
const INSTALL_DISMISS_KEY = "kasirku_install_dismissed";

/* Tampilkan banner install bila: bisa diinstall & belum ter-install & tidak di-dismiss.
   iOS Safari tidak punya beforeinstallprompt → tampilkan hint manual (share menu). */
function perbaruiBannerInstall() {
  const banner = $("#installBanner");
  if (!banner) return;
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const iosTanpaPrompt = /iphone|ipad|ipod/i.test(navigator.userAgent) && !deferredInstallPrompt;
  const sudahDitutup = localStorage.getItem(INSTALL_DISMISS_KEY) === "1";

  if (standalone || sudahDitutup) {
    banner.hidden = true;
    return;
  }
  if (deferredInstallPrompt) {
    $("#installBannerSub").textContent = "Aplikasi kasir & keuangan toko — bisa dipakai offline";
    banner.hidden = false;
  } else if (iosTanpaPrompt) {
    $("#installBannerSub").textContent = "iOS: ketuk ikon Share ⬆️ lalu pilih \"Add to Home Screen\"";
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }
}

function setupInstallBanner() {
  const btn = $("#btnInstallBanner");
  const dismiss = $("#btnInstallDismiss");
  if (!btn || !dismiss) return;
  btn.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      perbaruiBannerInstall();
    } else {
      tampilkanToast("Gunakan menu browser → Install / Add to Home Screen");
    }
  });
  dismiss.addEventListener("click", () => {
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    } catch (e) {
      /* storage penuh — banner saja yang di-hide */
    }
    $("#installBanner").hidden = true;
  });
  perbaruiBannerInstall();
}

function statusInstalasiText() {
  const el = $("#installStatusText");
  if (!el) return;
  if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true) {
    el.textContent = "✅ Aplikasi Terinstall";
  } else if (deferredInstallPrompt) {
    el.textContent = "Siap diinstall di perangkat ini";
  } else {
    el.textContent = "Browser belum menawarkan install (gunakan Chrome/Edge, atau menu → Install)";
  }
}

function setupPWA() {
  /* Versi app di UI */
  const v = $("#appVersionText");
  if (v) v.textContent = "Version " + APP_VERSION;

  /* Indikator online/offline — hanya tampil saat offline, toast saat pulih */
  const badge = $("#connBadge");
  const perbaruiKoneksi = () => {
    if (!badge) return;
    const online = navigator.onLine;
    badge.hidden = online;
    $("#connBadgeText").textContent = online ? "Online" : "Mode Offline";
    badge.classList.toggle("offline", !online);
  };
  window.addEventListener("online", () => {
    perbaruiKoneksi();
    tampilkanToast("🌐 Online — koneksi tersambung kembali");
  });
  window.addEventListener("offline", () => {
    perbaruiKoneksi();
    tampilkanToast("📴 Mode Offline — aplikasi tetap berfungsi penuh");
  });
  perbaruiKoneksi();

  /* Registrasi service worker (hanya http/https; dilewati di mirror preview) */
  if (!window.__KASIRKU_MIRROR && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    swRegistering = navigator.serviceWorker.register("service-worker.js").then((reg) => {
      /* Deteksi SW baru → update otomatis, data LocalStorage tak tersentuh */
      reg.addEventListener("updatefound", () => {
        const swBaru = reg.installing;
        if (!swBaru) return;
        swBaru.addEventListener("statechange", () => {
          if (swBaru.state === "activated") tampilkanToast("✨ KasirKu diperbarui ke v" + APP_VERSION + " — data aman");
        });
      });
      return reg;
    }).catch(() => {}); /* offline pertama kali / SW gagal: abaikan senyap */
  }

  /* Install prompt (Chromium/Android) */
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = $("#btnInstallApp");
    if (btn) btn.hidden = false;
    statusInstalasiText();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    const btn = $("#btnInstallApp");
    if (btn) btn.hidden = true;
    statusInstalasiText();
    perbaruiBannerInstall();
    tampilkanToast("🎉 KasirKu terinstall di perangkat ini");
  });

  const btnInstall = $("#btnInstallApp");
  if (btnInstall) {
    btnInstall.addEventListener("click", async () => {
      if (!deferredInstallPrompt) {
        tampilkanToast("Gunakan menu browser → \"Install app\" / \"Add to Home Screen\"");
        return;
      }
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      statusInstalasiText();
    });
  }

  /* Tombol cek update: minta SW yang menunggu untuk langsung aktif */
  const btnUpdate = $("#btnCekUpdate");
  if (btnUpdate) {
    btnUpdate.addEventListener("click", async () => {
      if (!swRegistering) {
        tampilkanToast("Service worker tidak aktif di lingkungan ini");
        return;
      }
      try {
        const reg = await swRegistering;
        await reg.update();
        tampilkanToast("Cache diperbarui — data kasir tetap aman 💾");
      } catch (e) {
        tampilkanToast("Gagal memeriksa update (offline?)");
      }
    });
  }

  statusInstalasiText();
  setupInstallBanner();
}

/* ============================================================
   BACKUP & RESTORE (JSON) — seluruh data kasir dalam satu file
   ============================================================ */
function buatBackup() {
  return {
    app: "KasirKu",
    type: "kasirku-backup",
    backupVersion: 2,
    appVersion: APP_VERSION,
    dataVersion: DATA_VERSION,
    dibuat: new Date().toISOString(),
    produk: JSON.parse(JSON.stringify(produkData)),
    kategori: semuaKategori(),
    transaksi: JSON.parse(JSON.stringify(transaksiData)),
    pengeluaran: JSON.parse(JSON.stringify(pengeluaranData)),
    pengaturan: JSON.parse(JSON.stringify(pengaturan)),
    users: JSON.parse(JSON.stringify(users)),
    profil: JSON.parse(JSON.stringify(profil)),
    shifts: JSON.parse(JSON.stringify(shifts)),
    heldSales: JSON.parse(JSON.stringify(heldSales)),
  };
}

function exportBackup() {
  const d = new Date();
  const nama = "kasirku-backup-" + tanggalISO(d) + ".json";
  const blob = new Blob([JSON.stringify(buatBackup(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
  tampilkanToast("💾 " + nama + " diunduh");
}

/* Validasi ketat file backup: hanya menerima struktur yang dikenal,
   file rusak/asing DITOLAK sebelum menyentuh data aplikasi. */
function validasiBackup(data) {
  if (!data || typeof data !== "object") return "File bukan JSON yang valid.";
  if (data.type !== "kasirku-backup") return "File bukan backup KasirKu.";
  if (!Array.isArray(data.produk)) return "Data produk rusak/berformat lama.";
  if (!Array.isArray(data.transaksi)) return "Data transaksi rusak.";
  if (!Array.isArray(data.pengeluaran)) return "Data pengeluaran rusak.";
  const produkOk = data.produk.every((p) => p && typeof p === "object" && Number.isFinite(Number(p.id)) && typeof p.nama === "string" && Number.isFinite(Number(p.jual)));
  if (!produkOk) return "Ada produk dengan field tidak valid.";
  const trxOk = data.transaksi.every((t) => t && typeof t === "object" && typeof t.inv === "string" && (Array.isArray(t.item) || Array.isArray(t.items)));
  if (!trxOk) return "Ada transaksi dengan field tidak valid.";
  if (data.pengeluaran.some((e) => !e || typeof e !== "object" || !Number.isFinite(Number(e.nominal)))) return "Ada pengeluaran tidak valid.";
  if (data.pengaturan && typeof data.pengaturan !== "object") return "Data pengaturan rusak.";
  return null; /* valid */
}

function importBackup(fileObj) {
  let data;
  try {
    data = JSON.parse(fileObj);
  } catch (e) {
    tampilkanToast("❌ File bukan JSON yang valid");
    return;
  }
  const gagal = validasiBackup(data);
  if (gagal) {
    tampilkanToast("❌ " + gagal);
    return;
  }
  if (!confirm("Import backup akan mengganti data aplikasi saat ini. Lanjutkan?\n\nProduk: " + data.produk.length + " · Transaksi: " + data.transaksi.length + " · Pengeluaran: " + data.pengeluaran.length + "\nBackup dibuat: " + (data.dibuat || "?") + "\n\nData saat ini akan DIGANTI (auto-backup dibuat dulu).")) return;

  /* 5) Auto-backup data LAMA sebelum overwrite — jaring pengaman */
  try {
    localStorage.setItem("kasirku_auto_backup", JSON.stringify(buatBackup()));
  } catch (e) {
    /* penuh — lanjutkan import, backup otomatis bersifat best-effort */
  }

  produkData = data.produk.map((p) => ({ ...p, stok: Math.max(0, Number(p.stok) || 0), minStok: Number.isFinite(Number(p.minStok)) ? Number(p.minStok) : 5 }));
  transaksiData = data.transaksi;
  pengeluaranData = data.pengeluaran;
  if (data.pengaturan && typeof data.pengaturan === "object") pengaturan = Object.assign({}, PENGATURAN_DEFAULT, data.pengaturan);

  Storage.tulis(Storage.KEYS.PRODUK, produkData);
  Storage.tulis(Storage.KEYS.TRANSAKSI, transaksiData);
  Storage.tulis(Storage.KEYS.PENGELUARAN, pengeluaranData);
  Storage.tulis(Storage.KEYS.PENGATURAN, pengaturan);
  if (Array.isArray(data.users) && data.users.length) {
    users = data.users;
    Storage.tulis(Storage.KEYS.USERS, users);
  }
  if (data.profil && typeof data.profil === "object") {
    profil = Object.assign({}, PROFIL_DEFAULT, data.profil);
    simpanProfil();
    renderUserCard();
  }
  if (Array.isArray(data.shifts)) {
    shifts = data.shifts;
    Storage.tulis(Storage.KEYS.SHIFTS, shifts);
  }
  if (Array.isArray(data.heldSales)) {
    heldSales = data.heldSales;
    Storage.tulis(Storage.KEYS.HELD, heldSales);
  }
  keranjang = [];
  Storage.tulis(Storage.KEYS.KERANJANG, keranjang);

  renderIdentitasToko();
  muatFormPengaturan();
  renderSemuaProduk();
  renderTransaksi();
  renderDashboardLainnya();
  renderKeuangan();
  renderLaporan();
  tampilkanToast("✅ Backup diimport — " + produkData.length + " produk, " + transaksiData.length + " transaksi");
}

/* ============================================================
   MODAL GENERIC
   ============================================================ */
function bukaModal(id) {
  $(id).classList.add("show");
}
function tutupModal(id) {
  $(id).classList.remove("show");
}
function setupModalTutup() {
  $$(".modal").forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target === m || e.target.closest("[data-close-modal]")) tutupModal("#" + m.id);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") $$(".modal.show").forEach((m) => tutupModal("#" + m.id));
  });
}

/* ============================================================
   CRUD PRODUK
   ============================================================ */
let produkEditId = null;

function bukaModalTambah() {
  produkEditId = null;
  $("#modalProdukJudul").textContent = "Tambah Produk";
  $("#formProduk").reset();
  $("#produkMinStok").value = 5;
  isiOpsiKategori($("#produkKategori"), "");
  $("#formError").textContent = "";
  bukaModal("#modalProduk");
  setTimeout(() => $("#produkNama").focus(), 60);
}

function bukaModalEdit(id) {
  const p = produkData.find((x) => x.id === id);
  if (!p) return;
  produkEditId = id;
  $("#modalProdukJudul").textContent = "Edit Produk";
  $("#produkNama").value = p.nama;
  $("#produkBeli").value = p.beli;
  $("#produkJual").value = p.jual;
  $("#produkStok").value = p.stok;
  $("#produkMinStok").value = Number.isFinite(p.minStok) ? p.minStok : 5;
  isiOpsiKategori($("#produkKategori"), p.kategori);
  $("#formError").textContent = "";
  bukaModal("#modalProduk");
  setTimeout(() => $("#produkNama").focus(), 60);
}

function isiOpsiKategori(selectEl, terpilih) {
  const kategori = semuaKategori();
  if (terpilih && !kategori.includes(terpilih)) kategori.push(terpilih);
  selectEl.innerHTML =
    '<option value="">— Pilih kategori —</option>' +
    kategori.map((k) => `<option value="${escapeHTML(k)}" ${k === terpilih ? "selected" : ""}>${escapeHTML(k)}</option>`).join("") +
    '<option value="__lainnya">+ Kategori baru…</option>';
}

function simpanProdukDariForm(e) {
  e.preventDefault();
  const nama = $("#produkNama").value.trim();
  let kategori = $("#produkKategori").value;
  const kategoriBaru = $("#produkKategoriBaru").value.trim();
  const beli = Number($("#produkBeli").value);
  const jual = Number($("#produkJual").value);
  const stok = Number($("#produkStok").value);
  const minStok = Number($("#produkMinStok").value);
  const err = $("#formError");

  if (kategori === "__lainnya") kategori = kategoriBaru;

  // Validasi
  if (!nama) return (err.textContent = "Nama produk wajib diisi.");
  if (!kategori) return (err.textContent = "Kategori wajib dipilih atau diisi.");
  if (!Number.isFinite(beli) || beli < 0) return (err.textContent = "Harga beli tidak valid.");
  if (!Number.isFinite(jual) || jual < 0) return (err.textContent = "Harga jual tidak valid.");
  if (jual < beli && !confirm("Harga jual lebih kecil dari harga beli. Lanjutkan saja?")) return;
  if (!Number.isInteger(stok) || stok < 0) return (err.textContent = "Stok harus bilangan bulat ≥ 0.");
  if (!Number.isInteger(minStok) || minStok < 0) return (err.textContent = "Stok minimum harus bilangan bulat ≥ 0.");

  if (produkEditId === null) {
    produkData.push({ id: idProdukBerikutnya(), nama, kategori, beli, jual, stok, minStok, sku: "SKU-" + String(idProdukBerikutnya()).padStart(4, "0"), barcode: "899" + String(idProdukBerikutnya()).padStart(10, "0") });
    tampilkanToast("Produk \"" + nama + "\" ditambahkan ✅");
  } else {
    const p = produkData.find((x) => x.id === produkEditId);
    if (p) Object.assign(p, { nama, kategori, beli, jual, stok, minStok });
    tampilkanToast("Perubahan \"" + nama + "\" disimpan ✅");
  }

  Storage.tulis(Storage.KEYS.PRODUK, produkData);
  tutupModal("#modalProduk");
  renderSemuaProduk();
}

function konfirmasiHapus(id) {
  const p = produkData.find((x) => x.id === id);
  if (!p) return;
  $("#hapusNama").textContent = p.nama;
  $("#btnHapusYa").dataset.id = id;
  bukaModal("#modalHapus");
}

function hapusProduk(id) {
  const p = produkData.find((x) => x.id === id);
  produkData = produkData.filter((x) => x.id !== id);
  // Buang juga dari keranjang bila ada
  keranjang = keranjang.filter((i) => i.id !== id);
  Storage.tulis(Storage.KEYS.PRODUK, produkData);
  Storage.tulis(Storage.KEYS.KERANJANG, keranjang);
  tutupModal("#modalHapus");
  renderSemuaProduk();
  tampilkanToast("Produk \"" + (p ? p.nama : "") + "\" dihapus 🗑️");
}

/* ============================================================
   FILTER / CARI / URUT PRODUK (halaman Produk)
   ============================================================ */
const filterProduk = { cari: "", kategori: "Semua", urut: "nama-asc" };

function produkTerfilter() {
  const q = filterProduk.cari.toLowerCase();
  let daftar = produkData.filter((p) => {
    const cocokKategori = filterProduk.kategori === "Semua" || p.kategori === filterProduk.kategori;
    const cocokCari = p.nama.toLowerCase().includes(q) || p.kategori.toLowerCase().includes(q);
    return cocokKategori && cocokCari;
  });

  const [kolom, arah] = filterProduk.urut.split("-");
  daftar.sort((a, b) => {
    let va = a[kolom];
    let vb = b[kolom];
    if (typeof va === "string") {
      va = va.toLowerCase();
      vb = vb.toLowerCase();
      return arah === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return arah === "asc" ? va - vb : vb - va;
  });
  return daftar;
}

/* ---- Status stok per produk: Aman / Menipis / Habis (batas = p.minStok) ---- */
function statusStok(p) {
  const min = Number.isFinite(p.minStok) ? p.minStok : (Number(pengaturan.lowStockDefault) || 5);
  if (p.stok <= 0) return "Habis";
  if (p.stok <= min) return "Menipis";
  return "Aman";
}

function badgeStatusStok(p) {
  const s = statusStok(p);
  if (s === "Habis") return '<span class="badge badge-danger">Habis</span>';
  if (s === "Menipis") return '<span class="badge badge-warning">Menipis</span>';
  return '<span class="badge badge-success">Aman</span>';
}

/* Daftar produk yang stoknya menipis/habis (untuk peringatan) */
function produkStokMenipis() {
  return produkData.filter((p) => statusStok(p) !== "Aman");
}

/* ---- Void transaksi: kembalikan stok, ubah status jadi Dibatalkan ---- */
function voidTransaksi(inv) {
  const t = cariTransaksi(inv);
  if (!t) return;
  if (t.status === "Dibatalkan") {
    tampilkanToast("Transaksi " + inv + " sudah dibatalkan sebelumnya.");
    return;
  }
  if (!confirm("Void transaksi " + inv + "?\n\nStok produk akan dikembalikan dan transaksi ditandai Dibatalkan.")) return;

  /* Kembalikan stok VIA adjustStock (VOID) — satu pintu perubahan stok */
  for (const i of trxItems(t)) {
    const r = adjustStock(i.id, i.qty, "VOID", "Pembatalan " + inv);
    if (!r.ok) {
      tampilkanToast("❌ " + r.pesan);
      return;
    }
  }
  t.status = "Dibatalkan";
  t.voidPada = { tanggal: tanggalISO(new Date()), waktu: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) };

  Storage.tulis(Storage.KEYS.PRODUK, produkData);
  Storage.tulis(Storage.KEYS.TRANSAKSI, transaksiData);

  renderSemuaProduk();
  renderTransaksi();
  renderDashboardLainnya();
  renderKeuangan();
  renderLaporan();
  tampilkanToast("Transaksi " + inv + " dibatalkan — stok dikembalikan ↩️");
}

function renderTabelProduk() {
  const daftar = produkTerfilter();
  const body = $("#produkBody");
  const info = $("#produkCount");

  if (info) {
    info.textContent = "Menampilkan " + daftar.length + " dari " + produkData.length + " produk";
  }

  if (daftar.length === 0) {
    body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:36px 0" class="muted">
      ${produkData.length === 0 ? 'Belum ada produk. <button class="btn btn-primary btn-sm" onclick="bukaModalTambah()">+ Tambah Produk</button>' : "Tidak ada produk yang cocok dengan pencarian/filter."}
    </td></tr>`;
    return;
  }

  body.innerHTML = daftar
    .map(
      (p) => `<tr>
      <td><div class="prod-cell">
        <div class="thumb">${escapeHTML(p.nama.charAt(0))}</div>
        <div><strong>${escapeHTML(p.nama)}</strong><span>Kode: PRD-${String(p.id).padStart(4, "0")}</span></div>
      </div></td>
      <td><span class="badge badge-neutral">${escapeHTML(p.kategori)}</span></td>
      <td><strong>${rupiah(p.jual)}</strong></td>
      <td class="muted">${rupiah(p.beli)}</td>
      <td class="stok-txt ${p.stok === 0 ? "stok-habis-txt" : p.stok <= p.minStok ? "stok-menipis-txt" : ""}"><strong>${p.stok}</strong> pcs</td>
      <td class="muted">Min ${p.minStok}</td>
      <td>${badgeStatusStok(p)}</td>
      <td>
        <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Edit</button>
        <button class="btn btn-ghost btn-sm danger" data-hapus="${p.id}">Hapus</button>
      </td>
    </tr>`
    )
    .join("");
}

function renderFilterKategori() {
  const select = $("#filterKategori");
  if (!select) return;
  const current = filterProduk.kategori;
  select.innerHTML =
    '<option value="Semua">Semua Kategori</option>' +
    semuaKategori().map((k) => `<option value="${escapeHTML(k)}" ${k === current ? "selected" : ""}>${escapeHTML(k)}</option>`).join("");
}

/* Render semua bagian yang bergantung pada data produk */
function renderSemuaProduk() {
  renderFilterKategori();
  renderTabelProduk();
  renderPosKategori();
  renderPosProduk();
  renderKeranjang();
  renderPeringatanStok();
  renderMetodeBayar();
  renderShiftBox();
  renderHeldList();
  renderDashboardProduk();
}

/* ============================================================
   SHIFT KASIR — buka/tutup dengan perhitungan kas
   Kas seharusnya = modal awal + penjualan Tunai − pengeluaran Tunai-equivalent*
   (*pengeluaran dibayar tunai — dalam app ini semua pengeluaran dianggap tunai)
   Transaksi TIDAK diubah saat shift ditutup.
   ============================================================ */
function bukaShift(modalAwal) {
  if (shiftAktif()) {
    tampilkanToast("Masih ada shift terbuka — tutup dulu");
    return false;
  }
  const s = {
    id: "SHIFT-" + tanggalISO(new Date()).replace(/-/g, "") + "-" + (shifts.length + 1),
    kasir: pengaturan.kasir || "Kasir",
    bukaWaktu: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    bukaTanggal: tanggalISO(new Date()),
    modalAwal: Math.max(0, Number(modalAwal) || 0),
    status: "OPEN",
  };
  shifts.unshift(s);
  Storage.tulis(Storage.KEYS.SHIFTS, shifts);
  renderShiftBox();
  tampilkanToast("Shift " + s.id + " dibuka (modal " + rupiah(s.modalAwal) + ") ✅");
  return true;
}

function hitungShift(s) {
  const trx = transaksiData.filter((t) => t.shiftId === s.id && t.status === "Selesai");
  const tunai = trx.filter((t) => t.metode === "Tunai").reduce((a, t) => a + t.total, 0);
  const qris = trx.filter((t) => t.metode === "QRIS").reduce((a, t) => a + t.total, 0);
  const debit = trx.filter((t) => t.metode !== "Tunai" && t.metode !== "QRIS").reduce((a, t) => a + t.total, 0);
  const eluar = pengeluaranData
    .filter((e) => e.shiftId === s.id)
    .reduce((a, e) => a + e.nominal, 0);
  const kasSeharusnya = s.modalAwal + tunai - eluar;
  return { jmlTrx: trx.length, tunai, qris, debit, pengeluaran: eluar, kasSeharusnya };
}

function tutupShift(kasAktual) {
  const s = shiftAktif();
  if (!s) {
    tampilkanToast("Tidak ada shift terbuka");
    return false;
  }
  const r = hitungShift(s);
  const selisih = (Number(kasAktual) || 0) - r.kasSeharusnya;
  s.status = "CLOSED";
  s.tutupWaktu = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  s.rekap = { ...r, kasAktual: Number(kasAktual) || 0, selisih };
  Storage.tulis(Storage.KEYS.SHIFTS, shifts);
  renderShiftBox();
  tampilkanToast(
    "Shift ditutup — kas seharusnya " + rupiah(r.kasSeharusnya) + ", selisih " + (selisih === 0 ? "0 ✅" : rupiah(Math.abs(selisih)) + (selisih > 0 ? " (lebih)" : " (kurang)"))
  );
  return true;
}

/* Kartu shift di halaman Kasir (buka/tutup + ringkasan) */
function renderShiftBox() {
  const wrap = $("#shiftBox");
  if (!wrap) return;
  const aktif = shiftAktif();
  if (!aktif) {
    wrap.innerHTML =
      '<div class="shift-closed"><div><strong>Tidak ada shift aktif</strong><span class="muted" style="font-size:12.5px">Buka shift sebelum berjualan — transaksi tetap tercatat tanpa shift.</span></div>' +
      '<div class="shift-form"><input type="text" id="shiftModalAwal" inputmode="numeric" placeholder="Modal awal (Rp)" /><button class="btn btn-primary" id="btnBukaShift">Buka Shift</button></div></div>';
    return;
  }
  const r = hitungShift(aktif);
  wrap.innerHTML =
    '<div class="shift-open"><div class="shift-info"><strong>⚡ ' +
    escapeHTML(aktif.id) +
    '</strong><span class="muted" style="font-size:12.5px">Kasir: ' +
    escapeHTML(aktif.kasir) +
    " · Buka " +
    escapeHTML(aktif.bukaWaktu) +
    " · Modal " +
    rupiah(aktif.modalAwal) +
    '</span></div><div class="shift-rekap">' +
    '<span>Tunai <b>' +
    rupiah(r.tunai) +
    "</b></span><span>QRIS <b>" +
    rupiah(r.qris) +
    "</b></span><span>Pengeluaran <b>" +
    rupiah(r.pengeluaran) +
    "</b></span><span>Kas seharusnya <b>" +
    rupiah(r.kasSeharusnya) +
    '</b></span></div><div class="shift-form"><input type="text" id="shiftKasAktual" inputmode="numeric" placeholder="Kas aktual (Rp)" /><button class="btn btn-danger" id="btnTutupShift">Tutup Shift</button></div></div>';
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDashboardProduk() {
  const jml = produkData.length;
  const menipis = produkData.filter((p) => statusStok(p) === "Menipis").length;
  const habis = produkData.filter((p) => statusStok(p) === "Habis").length;
  $("#statProduk").textContent = jml;
  const trendEl = $("#statProdukTrend");
  if (trendEl) {
    trendEl.textContent = menipis + " stok menipis" + (habis ? " · " + habis + " habis" : "");
    trendEl.className = "stat-trend " + (habis ? "down" : menipis ? "warn" : "up");
  }

  const stokMenipis = produkStokMenipis().slice(0, 5);
  const badgeList = $("#listStokMenipis");
  if (badgeList) {
    badgeList.innerHTML =
      stokMenipis.length === 0
        ? '<li class="muted" style="justify-content:center;padding:18px 0">Semua stok aman 👍</li>'
        : stokMenipis
            .map(
              (p) => `<li>
          <div class="list-icon warn">${escapeHTML(p.nama.charAt(0))}</div>
          <div class="list-body"><strong>${escapeHTML(p.nama)}</strong><span>Sisa ${p.stok} pcs (min ${p.minStok})</span></div>
          <div class="list-right">${badgeStatusStok(p)}</div>
        </li>`
            )
            .join("");
  }
  const badgeJml = $("#badgeStokMenipis");
  if (badgeJml) badgeJml.textContent = produkStokMenipis().length + " item";
}

function renderDashboardLainnya() {
  /* Semua angka dari transaksi nyata (bukan dummy) */
  const hariIni = tanggalISO(new Date());
  const selesaiHariIni = transaksiData.filter((t) => t.tanggal === hariIni && t.status === "Selesai");
  const omzetHariIni = selesaiHariIni.reduce((a, t) => a + t.total, 0);
  $("#statOmzet").textContent = rupiah(omzetHariIni);
  $("#statTrx").textContent = String(selesaiHariIni.length);

  /* Laba kotor hari ini: omzet − modal barang terjual (definisi sama dengan
     halaman Keuangan & Laporan; transaksi void otomatis tidak dihitung) */
  const laba = hitungKeuangan(rentangPeriode("hari")).labaKotor;
  $("#statLaba").textContent = rupiah(laba);

  /* Grafik 7 hari dari transaksi nyata */
  const chart7Hari = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = tanggalISO(d);
    const nilai = transaksiData
      .filter((t) => t.tanggal === iso && t.status === "Selesai")
      .reduce((a, t) => a + t.total, 0);
    chart7Hari.push({ hari: d.toLocaleDateString("id-ID", { weekday: "short" }), nilai, iso });
  }
  const maxVal = Math.max(...chart7Hari.map((d) => d.nilai), 1);
  $("#chartPenjualan").innerHTML = chart7Hari
    .map(
      (d) => `<div class="bar-group">
        <div class="bar blue" style="height:${Math.round((d.nilai / maxVal) * 100)}%" title="${rupiah(d.nilai)}"><span class="bar-val">${d.nilai > 0 ? Math.round(d.nilai / 1000) + "k" : ""}</span></div>
      </div>`
    )
    .join("");
  $("#chartDays").innerHTML = chart7Hari.map((d) => `<span>${escapeHTML(d.hari)}</span>`).join("");

  /* Transaksi terakhir */
  $("#trxTerakhirBody").innerHTML =
    transaksiData.length === 0
      ? '<tr><td colspan="4" class="muted" style="text-align:center;padding:24px 0">Belum ada transaksi.</td></tr>'
      : transaksiData
          .slice(0, 5)
          .map(
            (t) => `<tr>
        <td><strong>${escapeHTML(t.inv)}</strong></td>
        <td>${escapeHTML(t.tgl)} ${escapeHTML(t.waktu)}</td>
        <td><strong>${rupiah(t.total)}</strong></td>
        <td>${badgeStatus(t.status)}</td>
      </tr>`
          )
          .join("");

  /* Produk terlaris dihitung dari snapshot item transaksi yang Selesai saja */
  const perProduk = {};
  transaksiData.filter((t) => t.status === "Selesai").forEach((t) => {
    trxItems(t).forEach((i) => {
      if (!perProduk[i.nama]) perProduk[i.nama] = { terjual: 0, omzet: 0 };
      perProduk[i.nama].terjual += i.qty;
      perProduk[i.nama].omzet += i.subtotal;
    });
  });
  const terlaris = Object.entries(perProduk)
    .map(([nama, v]) => ({ nama, ...v }))
    .sort((a, b) => b.terjual - a.terjual)
    .slice(0, 5);
  $("#listTerlaris").innerHTML =
    terlaris.length === 0
      ? '<li class="muted" style="justify-content:center;padding:18px 0">Belum ada penjualan.</li>'
      : terlaris
          .map(
            (p, i) => `<li>
        <div class="list-icon">${i + 1}</div>
        <div class="list-body"><strong>${escapeHTML(p.nama)}</strong><span>${p.terjual} terjual</span></div>
        <div class="list-right"><strong>${rupiah(p.omzet)}</strong><span>omzet</span></div>
      </li>`
          )
          .join("");
}

function badgeStatus(status) {
  if (status === "Selesai") return '<span class="badge badge-success">Selesai</span>';
  if (status === "Pending") return '<span class="badge badge-warning">Pending</span>';
  return '<span class="badge badge-danger">Dibatalkan</span>';
}

/* ============================================================
   KASIR (POS)
   ============================================================ */
let kategoriAktif = "Semua";

function renderPosKategori() {
  const wrap = $("#posCategories");
  if (!wrap) return;
  wrap.innerHTML = ["Semua", ...semuaKategori()]
    .map((k) => `<button class="chip ${k === kategoriAktif ? "active" : ""}" data-kat="${escapeHTML(k)}">${escapeHTML(k)}</button>`)
    .join("");
}

function renderPosProduk() {
  const wrap = $("#posProducts");
  if (!wrap) return;
  const cari = ($("#posSearch").value || "").toLowerCase();
  const daftar = produkData.filter((p) => {
    const cocokKategori = kategoriAktif === "Semua" || p.kategori === kategoriAktif;
    const cocokCari =
      p.nama.toLowerCase().includes(cari) ||
      String(p.sku || "").toLowerCase().includes(cari) ||
      String(p.barcode || "").includes(cari);
    return cocokKategori && cocokCari;
  });

  wrap.innerHTML =
    daftar.length === 0
      ? `<p class="muted" style="grid-column:1/-1;text-align:center;padding:30px 0">Produk tidak ditemukan.</p>`
      : daftar
          .map(
            (p) => {
              const s = statusStok(p);
              const kelas = s === "Habis" ? "out" : s === "Menipis" ? "low" : "";
              const stokTxt = s === "Aman" ? "Stok: " + p.stok : "Stok: " + p.stok + " · " + s;
              return `<button class="product-item ${kelas}" data-id="${p.id}" ${s === "Habis" ? "disabled" : ""}>
        <div class="product-thumb">${escapeHTML(p.nama.charAt(0))}</div>
        <strong>${escapeHTML(p.nama)}</strong>
        <span class="price">${rupiah(p.jual)}</span>
        <span class="stock">${escapeHTML(stokTxt)}</span>
      </button>`;
            }
          )
          .join("");
}

/* Tampilkan/sembunyikan tombol QRIS sesuai Settings (qrisEnabled) */
function renderMetodeBayar() {
  const btnQris = document.querySelector('#payMethods .pay-method[data-metode="QRIS"]');
  if (btnQris) btnQris.style.display = pengaturan.qrisEnabled ? "" : "none";
  if (!pengaturan.qrisEnabled && metodeBayar === "QRIS") setMetodeBayar("Tunai");
}

/* Banner peringatan stok di halaman Kasir — muncul hanya jika ada produk Menipis/Habis */
function renderPeringatanStok() {
  const wrap = $("#alertStok");
  if (!wrap) return;
  const daftar = produkStokMenipis();
  if (daftar.length === 0) {
    wrap.hidden = true;
    wrap.innerHTML = "";
    return;
  }
  const habis = daftar.filter((p) => statusStok(p) === "Habis");
  const menipis = daftar.filter((p) => statusStok(p) === "Menipis");
  const ringkas = daftar
    .slice(0, 4)
    .map((p) => p.nama + " (sisa " + p.stok + ")")
    .join(", ");
  const sisanya = daftar.length > 4 ? " +" + (daftar.length - 4) + " lainnya" : "";
  wrap.innerHTML =
    '<span class="alert-stok-icon">⚠️</span>' +
    '<div class="alert-stok-teks"><strong>Peringatan stok:</strong> ' +
    escapeHTML(ringkas + sisanya) +
    (habis.length ? ' — <b>' + habis.length + ' habis</b>' : '') +
    (menipis.length ? (habis.length ? ', ' : ' — ') + '<b>' + menipis.length + ' menipis</b>' : '') +
    '.</div>' +
    '<button class="btn btn-ghost btn-sm" data-goto="produk">Kelola Stok</button>';
  wrap.hidden = false;
}

function tambahKeKeranjang(id) {
  const p = produkData.find((x) => x.id === id);
  if (!p) return;
  if (p.stok <= 0) {
    tampilkanToast("Stok \"" + p.nama + "\" habis!");
    return;
  }
  const item = keranjang.find((i) => i.id === id);
  const qtyDiKeranjang = item ? item.qty : 0;
  if (qtyDiKeranjang + 1 > p.stok) {
    tampilkanToast("Stok \"" + p.nama + "\" tidak cukup (sisa " + p.stok + ")");
    return;
  }
  if (item) item.qty++;
  else keranjang.push({ id: p.id, nama: p.nama, harga: p.jual, qty: 1 });
  bunyiBeep(1200); /* beep sukses — terdengar saat scan barcode & klik produk */
  Storage.tulis(Storage.KEYS.KERANJANG, keranjang);
  renderKeranjang();
}

function ubahQty(id, delta) {
  const item = keranjang.find((i) => i.id === id);
  if (!item) return;
  const p = produkData.find((x) => x.id === id);
  const stokMaks = p ? p.stok : Infinity;
  if (delta > 0 && item.qty + 1 > stokMaks) {
    tampilkanToast("Maksimal stok " + p.nama + ": " + p.stok);
    return;
  }
  item.qty += delta;
  if (item.qty <= 0) keranjang = keranjang.filter((i) => i.id !== id);
  Storage.tulis(Storage.KEYS.KERANJANG, keranjang);
  renderKeranjang();
}

/* Validasi stok semua item keranjang terhadap stok produk terkini.
   Mengembalikan daftar kekurangan; array kosong = aman.
   Dipanggil SEBELUM stok dikurangi — jika gagal, stok tidak boleh berubah. */
function validasiStokCukup() {
  return keranjang
    .map((i) => {
      const p = produkData.find((x) => x.id === i.id);
      const tersedia = p ? p.stok : 0;
      if (i.qty > tersedia) return { nama: i.nama, butuh: i.qty, tersedia };
      return null;
    })
    .filter(Boolean);
}

/* ============================================================
   HOLD / RECALL — simpan keranjang sementara TANPA mengurangi stok.
   ============================================================ */
function holdKeranjang() {
  if (keranjang.length === 0) {
    tampilkanToast("Keranjang masih kosong — tidak ada yang bisa ditunda");
    return;
  }
  /* ID unik via generator pusat (max+1) */
  const n = nomorBerikutnya(heldSales, "HOLD-");
  heldSales.unshift({
    id: "HOLD-" + String(n).padStart(3, "0"),
    waktu: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    tanggal: tanggalISO(new Date()),
    item: JSON.parse(JSON.stringify(keranjang)),
    diskonPersen: Number(diskonPersen) || 0, /* hold: item array — stok belum berkurang */
  });
  Storage.tulis(Storage.KEYS.HELD, heldSales);
  keranjang = [];
  diskonPersen = 0;
  Storage.tulis(Storage.KEYS.KERANJANG, keranjang);
  Storage.tulis(Storage.KEYS.DISKON, diskonPersen);
  $("#inputDiskon").value = diskonPersen;
  renderKeranjang();
  renderHeldList();
  tampilkanToast("Pesanan " + heldSales[0].id + " ditunda (stok belum berkurang) ⏸️");
}

function recallHeld(id) {
  const h = heldSales.find((x) => x.id === id);
  if (!h) return;
  if (keranjang.length > 0) {
    tampilkanToast("Keranjang aktif harus dikosongkan dulu sebelum recall");
    return;
  }
  /* Validasi stok saat recall — stok bisa berubah sejak hold */
  const hItem = trxItems(h);
  const kekurangan = hItem
    .map((i) => {
      const p = produkData.find((x) => x.id === i.id);
      const tersedia = p ? p.stok : 0;
      return i.qty > tersedia ? i.nama + " (butuh " + i.qty + ", sisa " + tersedia + ")" : null;
    })
    .filter(Boolean);
  if (kekurangan.length > 0) {
    tampilkanToast("⛔ Stok tidak cukup: " + kekurangan.join(", "));
    return;
  }
  if (hItem.some((i) => !produkData.some((x) => x.id === i.id))) {
    tampilkanToast("Ada produk yang sudah dihapus — pesanan tidak dapat di-recall");
    return;
  }
  keranjang = JSON.parse(JSON.stringify(hItem));
  diskonPersen = Number(h.diskonPersen) || 0;
  Storage.tulis(Storage.KEYS.KERANJANG, keranjang);
  Storage.tulis(Storage.KEYS.DISKON, diskonPersen);
  $("#inputDiskon").value = diskonPersen;
  heldSales = heldSales.filter((x) => x.id !== id);
  Storage.tulis(Storage.KEYS.HELD, heldSales);
  renderKeranjang();
  renderHeldList();
  tampilkanToast("Pesanan " + id + " dipanggil kembali ✅");
}

function buangHeld(id) {
  heldSales = heldSales.filter((x) => x.id !== id);
  Storage.tulis(Storage.KEYS.HELD, heldSales);
  renderHeldList();
  tampilkanToast("Pesanan " + id + " dibuang 🗑️");
}

/* Daftar held di atas keranjang (hanya tampil bila ada) */
function renderHeldList() {
  const wrap = $("#heldList");
  if (!wrap) return;
  if (heldSales.length === 0) {
    wrap.innerHTML = "";
    return;
  }
  wrap.innerHTML =
    '<div class="held-title">⏸️ Pesanan Ditunda (' + heldSales.length + ')</div>' +
    heldSales
      .map(
        (h) => `<div class="held-item">
        <div><strong>${escapeHTML(h.id)}</strong> · ${trxItems(h).reduce((a, i) => a + i.qty, 0)} item · ${escapeHTML(h.waktu)}</div>
        <div class="held-actions">
          <button class="btn btn-ghost btn-sm" data-recall="${escapeHTML(h.id)}">Recall</button>
          <button class="btn btn-ghost btn-sm danger" data-buang-held="${escapeHTML(h.id)}">Buang</button>
        </div>
      </div>`
      )
      .join("");
}

/* Hapus satu item dari keranjang (dipanggil tombol tempah) */
function hapusDariKeranjang(id) {
  keranjang = keranjang.filter((i) => i.id !== id);
  Storage.tulis(Storage.KEYS.KERANJANG, keranjang);
  renderKeranjang();
  tampilkanToast("Item dihapus dari keranjang");
}

/* FUNGSI PUSAT perhitungan total (Kasir, checkout, transaksi, struk, laporan):
   Subtotal − Diskon = Dasar pajak; jika PPN aktif: + PPN (taxRate dari Settings).
   PPN nonaktif / rate tidak valid → pajak 0 (tidak pernah NaN). */
function hitungTotal() {
  const subtotal = keranjang.reduce((a, i) => a + Number(i.harga || 0) * Number(i.qty || 0), 0);
  const diskon = Math.round(subtotal * (Number(diskonPersen) || 0) / 100);
  const dasar = subtotal - diskon;
  const pajak = pengaturan.taxEnabled && pengaturan.taxRate > 0 ? Math.round(dasar * pengaturan.taxRate / 100) : 0;
  return { subtotal, diskon, pajak, total: dasar + pajak };
}

function renderKeranjang() {
  const wrap = $("#cartItems");
  if (!wrap) return;

  if (keranjang.length === 0) {
    wrap.innerHTML = `<div class="cart-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
      <p>Keranjang masih kosong.<br>Klik produk untuk menambah.</p>
    </div>`;
  } else {
    wrap.innerHTML = keranjang
      .map(
        (i) => `<div class="cart-item">
      <div class="cart-item-info">
        <strong>${escapeHTML(i.nama)}</strong>
        <span>${rupiah(i.harga)} × ${i.qty} = <b>${rupiah(i.harga * i.qty)}</b></span>
      </div>
      <div class="qty-control">
        <button class="qty-btn" data-minus="${i.id}" title="Kurangi">−</button>
        <span class="qty-val">${i.qty}</span>
        <button class="qty-btn" data-plus="${i.id}" title="Tambah">+</button>
      </div>
      <button class="item-remove" data-hapus-item="${i.id}" title="Hapus dari keranjang">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      </button>
    </div>`
      )
      .join("");
  }

  const t = hitungTotal();
  const rowPajak = $("#sumPajak").closest(".summary-row");
  rowPajak.style.display = pengaturan.taxEnabled ? "" : "none";
  rowPajak.querySelector("span").textContent = "PPN" + (pengaturan.taxEnabled && pengaturan.taxRate > 0 ? " (" + pengaturan.taxRate + "%)" : "");
  $("#sumSubtotal").textContent = rupiah(t.subtotal);
  $("#sumDiskon").textContent = "−" + rupiah(t.diskon);
  $("#sumPajak").textContent = rupiah(t.pajak);
  $("#sumTotal").textContent = rupiah(t.total);

  renderPanelTunai();
}

/* ============================================================
   PANEL PEMBAYARAN TUNAI
   ============================================================ */
const UANG_PAS = [5000, 10000, 20000, 50000, 100000];

function renderPanelTunai() {
  const box = $("#cashBox");
  if (!box) return;
  const t = hitungTotal();
  const kurang = uangDiterima < t.total;

  // Tampilkan panel hanya untuk metode Tunai + ada isi keranjang
  box.style.display = metodeBayar === "Tunai" && keranjang.length > 0 ? "" : "none";

  const input = $("#uangDiterima");
  input.value = uangDiterima > 0 ? uangDiterima.toLocaleString("id-ID") : "";

  // Tombol nominal cepat: pecahan umum + "Uang Pas"
  $("#quickCash").innerHTML =
    UANG_PAS.map((n) => `<button type="button" class="quick-btn" data-nominal="${n}">${n >= 1000 ? n / 1000 + "rb" : n}</button>`).join("") +
    `<button type="button" class="quick-btn exact" data-exact="1">Uang Pas</button>`;

  // Kembalian / kekurangan
  const elKembalian = $("#kembalian");
  const elWarning = $("#cashWarning");
  const selisih = Math.abs(t.total - uangDiterima);
  box.classList.toggle("kurang", kurang && uangDiterima > 0);
  box.classList.toggle("pas", uangDiterima === t.total && t.total > 0);

  if (uangDiterima === 0) {
    elKembalian.textContent = rupiah(0);
    elKembalian.className = "";
    elWarning.hidden = true;
  } else if (kurang) {
    elKembalian.textContent = "−" + rupiah(selisih);
    elKembalian.className = "minus";
    elWarning.hidden = false;
    elWarning.textContent = "Kurang " + rupiah(selisih) + " — transaksi tidak bisa diselesaikan.";
  } else {
    elKembalian.textContent = rupiah(selisih);
    elKembalian.className = "plus";
    elWarning.hidden = true;
  }

  // State tombol bayar
  const btnPay = $("#btnPay");
  if (metodeBayar === "Tunai" && keranjang.length > 0 && kurang) {
    btnPay.disabled = true;
    btnPay.textContent = "Uang Kurang";
  } else {
    btnPay.disabled = false;
    btnPay.textContent = "Bayar Sekarang";
  }
}

function setMetodeBayar(m) {
  metodeBayar = m;
  $$("#payMethods .pay-method").forEach((b) => b.classList.toggle("active", b.dataset.metode === m));
  if (m !== "Tunai") uangDiterima = 0;
  renderPanelTunai();
}

/* ============================================================
   PEMBAYARAN QRIS (gambar statis lokal, tanpa API/gateway)
   ============================================================ */
/* SATU sumber path gambar QRIS (jangan hardcode path di banyak tempat).
   Prioritas: upload user (dataURL di Settings) → file lokal assets/qris/.
   Path RELATIF — aman untuk localhost, subfolder GitHub Pages, PWA, & Capacitor. */
function getQrisImageUrl() {
  return pengaturan.qrisImage || "assets/qris/qris-toko.png";
}

/* SATU pintu kebenaran "QRIS siap dipakai di checkout":
   READY = fitur diaktifkan DI Settings DAN ada sumber gambar (upload ATAU file lokal).
   Tidak ada flag terpisah (qrisConfirmed/dst) — keduanya dari `pengaturan` yang sama,
   sehingga tidak mungkin tidak sinkron. QR yang valid = langsung READY, tanpa
   "konfirmasi tambahan". Kegagalan LOAD file adalah kondisi runtime terpisah yang
   ditangani lewat event error gambar — bukan lewat flag. */
function isQrisReady() {
  return pengaturan.qrisEnabled !== false && !!getQrisImageUrl();
}

/* Terapkan gambar QRIS ke <img> modal + zoom. QR valid → tampil tanpa pesan apapun.
   Kegagalan load ditangani event error (bukan preemptive) agar QR yang sudah OK
   tidak pernah keliru dianggap "belum dikonfigurasi". */
function terapkanQrisGambar() {
  const src = getQrisImageUrl();
  const img = $("#qrisImage");
  const zoom = $("#qrisZoomImg");
  if (img) {
    if (!isQrisReady()) {
      /* Fitur dimatikan di Settings — pesan konfigurasi memang tepat */
      img.style.display = "none";
      $("#qrisFallback").hidden = false;
      $("#qrisFallbackPesan").innerHTML = "<strong>QRIS belum dikonfigurasi.</strong><br>Silakan aktifkan & tambahkan QRIS toko di Pengaturan.";
      return;
    }
    /* QR siap: sembunyikan fallback, tampilkan gambar */
    $("#qrisFallback").hidden = true;
    img.style.display = "";
    if (img.getAttribute("src") !== src) {
      img.setAttribute("src", src); /* load baru → event load/error yang menentukan */
    } else if (img.complete && img.naturalWidth === 0) {
      /* State 404 basi (file baru ditambahkan saat halaman terbuka): paksa request ulang */
      img.setAttribute("src", src + (src.indexOf("?") >= 0 ? "&" : "?") + "r=" + Date.now());
    }
  }
  if (zoom && zoom.getAttribute("src") !== src) zoom.setAttribute("src", src);
}

function bukaModalQris(total) {
  $("#qrisTotal").textContent = rupiah(total);
  $("#qrisStatus").textContent = "Menunggu pembayaran pelanggan…";
  $("#qrisStatus").className = "qris-status";
  const btn = $("#btnQrisDiterima");
  btn.disabled = false;
  btn.dataset.total = total;
  terapkanQrisGambar(); /* gambar diperiksa & ditampilkan sebelum konfirmasi */
  bukaModal("#modalQris");
}

/* Tombol "Pembayaran Diterima" di modal QRIS */
function konfirmasiQrisDiterima() {
  const total = Number($("#btnQrisDiterima").dataset.total || 0);
  const btn = $("#btnQrisDiterima");
  const statusEl = $("#qrisStatus");

  statusEl.textContent = "Pembayaran diterima — memproses transaksi…";
  statusEl.className = "qris-status sukses";
  btn.disabled = true;

  withTransactionLock(() => {
    /* Konsistensi total: hitung ULANG saat konfirmasi — keranjang bisa berubah
       antara modal terbuka dan tombol ditekan (kasir menambah/hapus item). */
    const totalSekarang = hitungTotal().total;
    if (keranjang.length === 0) {
      statusEl.textContent = "Keranjang kosong — pembayaran tidak dapat diproses.";
      statusEl.className = "qris-status";
      btn.disabled = false;
      return;
    }
    if (totalSekarang !== total) {
      statusEl.textContent = "Keranjang berubah — total diperbarui menjadi " + rupiah(totalSekarang) + ". Periksa lalu tekan lagi.";
      statusEl.className = "qris-status";
      $("#qrisTotal").textContent = rupiah(totalSekarang);
      btn.dataset.total = String(totalSekarang);
      btn.disabled = false;
      return;
    }
    selesaikanTransaksi(total, "QRIS", total, 0, (sukses) => {
      if (sukses) {
        setTimeout(() => tutupModal("#modalQris"), 450);
      } else {
        /* Stok berubah di antara buka-modal dan konfirmasi — transaksi ditolak,
           modal tetap terbuka agar kasir bisa menyesuaikan keranjang. */
        statusEl.textContent = "Stok tidak cukup — transaksi ditolak. Sesuaikan keranjang lalu coba lagi.";
        statusEl.className = "qris-status";
        btn.disabled = false;
      }
    });
  });
}

/* ---- Transaction lock (idempotency sederhana): mencegah double payment
   dari double-click atau race antar-metode. ---- */
let trxLock = false;
function withTransactionLock(fn) {
  if (trxLock) {
    tampilkanToast("⏳ Memproses…");
    return false;
  }
  trxLock = true;
  const btn = $("#btnPay");
  const lama = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Memproses…";
  }
  const lepas = () => {
    trxLock = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = lama;
    }
  };
  try {
    const r = fn();
    if (r && typeof r.then === "function") r.then(lepas, lepas);
    else lepas();
    return r;
  } catch (e) {
    lepas();
    tampilkanToast("❌ Terjadi kesalahan: " + (e && e.message ? e.message : "tidak diketahui"));
    return false;
  }
}

/* Finalisasi transaksi: kurangi stok, catat (dengan SNAPSHOT harga), kosongkan keranjang.
   GERBANG STOK: validasi dijalankan dulu. Jika stok tidak cukup, transaksi DITOLAK
   dan tidak ada data (stok/transaksi/keranjang) yang berubah. Stok baru hanya
ditulis setelah transaksi berhasil disimpan. */
function selesaikanTransaksi(total, metode, diterima, kembalian, selesai) {
  /* Proteksi idempotensi: keranjang kosong tidak boleh menghasilkan transaksi
     (mencegah transaksi "hantu" dari double-click saat keranjang sudah terbayar) */
  if (keranjang.length === 0) {
    tampilkanToast("❌ Keranjang kosong — transaksi tidak dibuat");
    if (typeof selesai === "function") selesai(false, null);
    return false;
  }
  const kekurangan = validasiStokCukup();
  if (kekurangan.length > 0) {
    tampilkanToast("Stok tidak cukup: " + kekurangan.map((k) => k.nama + " (butuh " + k.butuh + ", sisa " + k.tersedia + ")").join(", "));
    if (typeof selesai === "function") selesai(false, null);
    return false;
  }

  /* Snapshot item: salin nama & harga saat transaksi — BUKAN referensi ke produkData.
     Perubahan harga produk di masa depan tidak akan mengubah transaksi lama. */
  const snapshotItem = keranjang.map((i) => {
    const p = produkData.find((x) => x.id === i.id);
    return {
      id: i.id,
      nama: i.nama,
      sku: p && p.sku ? p.sku : null,
      barcode: p && p.barcode ? p.barcode : null,
      harga: i.harga,
      qty: i.qty,
      subtotal: i.harga * i.qty,
      hargaBeli: p ? p.beli : 0,
    };
  });

  /* ---- ATOMIC: backup state untuk rollback ---- */
  const stokBackup = new Map();
  keranjang.forEach((i) => {
    const p = produkData.find((x) => x.id === i.id);
    if (p) stokBackup.set(p.id, p.stok);
  });
  const produkBackup = JSON.parse(JSON.stringify(produkData));
  const trxBackup = JSON.parse(JSON.stringify(transaksiData));
  const logBackup = JSON.parse(JSON.stringify(stokLog));

  /* Kurangi stok VIA adjustStock (SALE) — jika ada yang gagal: ROLLBACK total */
  for (const i of keranjang) {
    const r = adjustStock(i.id, -i.qty, "SALE", "Penjualan " + metode);
    if (!r.ok) {
      produkData = produkBackup;
      transaksiData = trxBackup;
      stokLog = logBackup;
      tampilkanToast("❌ " + r.pesan + " — transaksi dibatalkan, keranjang dipertahankan");
      if (typeof selesai === "function") selesai(false, null);
      return false;
    }
  }
  Storage.tulis(Storage.KEYS.PRODUK, produkData);

  const now = new Date();
  const t = hitungTotal();
  const inv = "INV-" + String(nomorBerikutnya(transaksiData, "INV-")).padStart(4, "0");

  /* Normalisasi sebelum simpan: field `item` dijamin ARRAY valid + totalItem konsisten */
  transaksiData.unshift(
    normalisasiSatuTransaksi({
    id: inv,
    inv,
    tanggal: tanggalISO(now),
    waktu: now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    tgl: now.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
    pelanggan: "Walk-in",
    metode,
    item: snapshotItem,
    totalItem: snapshotItem.reduce((a, i) => a + i.qty, 0),
    subtotal: t.subtotal,
    diskonPersen: Number(diskonPersen) || 0,
    diskon: t.diskon,
    pajak: t.pajak,
    total,
    uangDiterima: diterima,
    kembalian,
    status: "Selesai",
    shiftId: shiftAktif() ? shiftAktif().id : null,
  })
  );
  Storage.tulis(Storage.KEYS.TRANSAKSI, transaksiData);

  /* ATOMIC integrity check: kalau stok entah bagaimana minus, rollback total */
  const adaMinus = produkData.some((p) => p.stok < 0);
  if (adaMinus) {
    produkData = produkBackup;
    transaksiData = trxBackup;
    stokLog = logBackup;
    Storage.tulis(Storage.KEYS.PRODUK, produkData);
    Storage.tulis(Storage.KEYS.TRANSAKSI, transaksiData);
    tampilkanToast("❌ Terdeteksi stok minus — transaksi dibatalkan (rollback)");
    if (typeof selesai === "function") selesai(false, null);
    return false;
  }

  keranjang = [];
  uangDiterima = 0;
  diskonPersen = 0; /* reset diskon — pelanggan berikutnya tidak mewarisi diskon sebelumnya */
  Storage.tulis(Storage.KEYS.KERANJANG, keranjang);
  Storage.tulis(Storage.KEYS.DISKON, diskonPersen);
  const inputDiskon = $("#inputDiskon");
  if (inputDiskon) inputDiskon.value = diskonPersen;
  renderSemuaProduk();
  renderTransaksi();
  renderDashboardLainnya();
  renderKeuangan();
  renderLaporan();

  /* Peringatan stok setelah transaksi sukses (stok memang baru saja berkurang) */
  const menipisBaru = snapshotItem
    .map((i) => produkData.find((x) => x.id === i.id))
    .filter((p) => p && statusStok(p) !== "Aman");
  tampilkanToast("Pembayaran " + rupiah(total) + " berhasil — " + inv + " \ud83c\udf89");
  bunyiBeep(1500);
  if (pengaturan.autoPrint === true) {
    setTimeout(() => cetakStruk(inv), 400); /* cetak struk otomatis setelah bayar */
  }
  if (menipisBaru.length > 0) {
    setTimeout(() => {
      tampilkanToast("\u26a0\ufe0f Stok menipis: " + menipisBaru.map((p) => p.nama + " (sisa " + p.stok + ")").join(", "));
    }, 2800);
  }

  if (typeof selesai === "function") selesai(true, inv);
}

/* SATU pintu masuk pembayaran (semua metode).
   Validasi stok selalu dijalankan paling awal — sebelum modal QRIS dibuka atau
   uang tunai dicek. Jika stok kurang: transaksi ditolak, stok TIDAK berubah. */
function cobaSelesaikanPembayaran() {
  withTransactionLock(() => {
    if (keranjang.length === 0) {
      tampilkanToast("Keranjang masih kosong!");
      return;
    }

    /* 1) Validasi stok dulu untuk SEMUA metode */
    const kekurangan = validasiStokCukup();
    if (kekurangan.length > 0) {
      tampilkanToast("\u26d4 Stok tidak cukup: " + kekurangan.map((k) => k.nama + " (butuh " + k.butuh + ", sisa " + k.tersedia + ")").join(", "));
      return;
    }

    const t = hitungTotal();

    /* 2) Validasi Tunai: uang harus >= total */
    if (metodeBayar === "Tunai") {
      if (uangDiterima < t.total) {
        const box = $("#cashBox");
        box.classList.add("shake");
        setTimeout(() => box.classList.remove("shake"), 450);
        tampilkanToast("Uang kurang " + rupiah(t.total - uangDiterima) + "!");
        $("#uangDiterima").focus();
        return; // gagal bayar — stok tidak disentuh
      }
      const kembalian = uangDiterima - t.total;
      selesaikanTransaksi(t.total, "Tunai", uangDiterima, kembalian, (sukses, inv) => {
        if (sukses) tampilkanToast("Kembalian " + rupiah(kembalian) + " — " + inv);
      });
      return;
    }

    /* 3) QRIS: buka modal pembayaran, finalisasi menunggu tombol "Pembayaran Diterima".
       Tutup modal (batal) = tidak ada transaksi, stok tetap. */
    if (metodeBayar === "QRIS") {
      bukaModalQris(t.total);
      return;
    }

    /* 4) Debit & metode lain: langsung selesai */
    selesaikanTransaksi(t.total, metodeBayar, t.total, 0);
  });
}

/* ============================================================
   TRANSAKSI / KEUANGAN / LAPORAN
   ============================================================ */
/* ============================================================
   HALAMAN TRANSAKSI: filter, search, pagination, detail, struk
   ============================================================ */
const TRANSAKSI_PER_HALAMAN = 10;
const filterTrx = { cari: "", tanggal: "", metode: "Semua", status: "Semua", halaman: 1 };

function transaksiTerfilter() {
  const q = filterTrx.cari.toLowerCase();
  return transaksiData.filter((t) => {
    const cocokTanggal = !filterTrx.tanggal || t.tanggal === filterTrx.tanggal;
    const cocokMetode = filterTrx.metode === "Semua" || t.metode === filterTrx.metode;
    const cocokStatus = filterTrx.status === "Semua" || t.status === filterTrx.status;
    const cocokCari =
      !q ||
      t.inv.toLowerCase().includes(q) ||
      t.pelanggan.toLowerCase().includes(q) ||
      trxItems(t).some((i) => i.nama.toLowerCase().includes(q));
    return cocokTanggal && cocokMetode && cocokStatus && cocokCari;
  });
}

function renderTransaksi() {
  const body = $("#transaksiBody");
  if (!body) return;

  const daftar = transaksiTerfilter();
  const totalHalaman = Math.max(1, Math.ceil(daftar.length / TRANSAKSI_PER_HALAMAN));
  if (filterTrx.halaman > totalHalaman) filterTrx.halaman = totalHalaman;
  const mulai = (filterTrx.halaman - 1) * TRANSAKSI_PER_HALAMAN;
  const potongan = daftar.slice(mulai, mulai + TRANSAKSI_PER_HALAMAN);

  // Ringkasan dari data TERFILTER (nyata) — transaksi Dibatalkan (void) tidak dihitung
  const omzet = daftar.filter((t) => t.status === "Selesai").reduce((a, t) => a + t.total, 0);
  const hariIni = tanggalISO(new Date());
  const trxHariIni = daftar.filter((t) => t.tanggal === hariIni && t.status === "Selesai");
  const omzetHariIni = trxHariIni.reduce((a, t) => a + t.total, 0);
  const rata = daftar.length ? Math.round(omzet / daftar.filter((t) => t.status === "Selesai").length || 0) : 0;
  $("#statTrxHariIni").textContent = rupiah(omzetHariIni);
  $("#statTrxJmlHariIni").textContent = trxHariIni.length + " transaksi";
  $("#statTrxTotal").textContent = rupiah(omzet);
  $("#statTrxJml").textContent = daftar.length + " transaksi";
  $("#statTrxRata").textContent = rupiah(rata);
  $("#statTrxItem").textContent = daftar.filter((t) => t.status === "Selesai").reduce((a, t) => a + (t.totalItem || 0), 0) + " item terjual";

  $("#transaksiCount").textContent =
    "Menampilkan " + (potongan.length ? mulai + 1 + "–" + (mulai + potongan.length) : 0) + " dari " + daftar.length + " transaksi";

  if (daftar.length === 0) {
    body.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center;padding:36px 0">' +
      (transaksiData.length === 0
        ? 'Belum ada transaksi. Lakukan penjualan di halaman <strong>Kasir</strong> — transaksi akan tercatat di sini secara otomatis.'
        : "Tidak ada transaksi yang cocok dengan filter.") + "</td></tr>";
  } else {
    body.innerHTML = potongan
      .map(
        (t) => `<tr>
      <td><strong>${escapeHTML(t.inv)}</strong></td>
      <td class="muted">${escapeHTML(t.tgl)}<br><span style="font-size:11.5px">${escapeHTML(t.waktu)}</span></td>
      <td>${t.totalItem} item (${trxItems(t).length} jenis)</td>
      <td><span class="badge badge-neutral">${escapeHTML(t.metode)}</span></td>
      <td><strong>${rupiah(t.total)}</strong></td>
      <td>${badgeStatus(t.status)}</td>
      <td>
        <button class="btn btn-ghost btn-sm" data-detail="${escapeHTML(t.inv)}">Detail</button>
        <button class="btn btn-ghost btn-sm" data-struk="${escapeHTML(t.inv)}">Struk</button>
      </td>
    </tr>`
      )
      .join("");
  }

  renderPaginationTransaksi(totalHalaman);
}

function renderPaginationTransaksi(totalHalaman) {
  const wrap = $("#paginationTrx");
  if (!wrap) return;
  if (totalHalaman <= 1) {
    wrap.innerHTML = "";
    return;
  }
  let html = `<button class="page-btn" data-page-trx="prev" ${filterTrx.halaman === 1 ? "disabled" : ""}>&lsaquo;</button>`;
  for (let i = 1; i <= totalHalaman; i++) {
    if (totalHalaman > 7 && i > 2 && i < totalHalaman - 1 && Math.abs(i - filterTrx.halaman) > 1) {
      if (!html.endsWith("…</span>")) html += '<span class="page-ellipsis">…</span>';
      continue;
    }
    html += `<button class="page-btn ${i === filterTrx.halaman ? "active" : ""}" data-page-trx="${i}">${i}</button>`;
  }
  html += `<button class="page-btn" data-page-trx="next" ${filterTrx.halaman === totalHalaman ? "disabled" : ""}>&rsaquo;</button>`;
  wrap.innerHTML = html;
}

function cariTransaksi(inv) {
  return transaksiData.find((t) => t.inv === inv);
}

/* ---- Modal Detail Transaksi ---- */
function bukaDetailTransaksi(inv) {
  const t = cariTransaksi(inv);
  if (!t) return;

  $("#detailJudul").textContent = "Detail " + t.inv;
  $("#detailMeta").innerHTML =
    `${escapeHTML(t.tgl)} · ${escapeHTML(t.waktu)} · <span class="badge badge-neutral">${escapeHTML(t.metode)}</span> · ${badgeStatus(t.status)}`;

  $("#detailItems").innerHTML = trxItems(t)
    .map(
      (i) => `<tr>
        <td>${escapeHTML(i.nama)}</td>
        <td>${rupiah(i.harga)}</td>
        <td>×${i.qty}</td>
        <td style="text-align:right"><strong>${rupiah(i.subtotal)}</strong></td>
      </tr>`
    )
    .join("");

  $("#detailSubtotal").textContent = rupiah(t.subtotal);
  $("#detailDiskon").textContent = "−" + rupiah(t.diskon) + " (" + (t.diskonPersen || 0) + "%)";
  /* PPN: hanya tampil jika transaksi itu memang memuat pajak (snapshot) */
  $("#detailRowPajak").style.display = t.pajak > 0 ? "" : "none";
  $("#detailPajak").textContent = rupiah(t.pajak);
  $("#detailTotal").textContent = rupiah(t.total);
  $("#grpDetailTunai").style.display = t.metode === "Tunai" ? "" : "none";
  $("#detailDiterima").textContent = rupiah(t.uangDiterima || t.total);
  $("#detailKembalian").textContent = rupiah(t.kembalian || 0);

  /* Void hanya tersedia untuk transaksi yang masih Selesai */
  $("#btnVoidTrx").style.display = t.status === "Dibatalkan" ? "none" : "";

  $("#btnDetailStruk").dataset.inv = t.inv;
  $("#btnVoidTrx").dataset.inv = t.inv;
  bukaModal("#modalDetail");
}

/* ---- Struk (cetak) ---- */
/* ============================================================
   STRUK — satu sumber markup untuk preview & cetak.
   SEMUA isi dibangun dari objek transaksi (snapshot saat transaksi):
   nama, harga, qty, subtotal, diskon, total, metode, uang diterima,
   kembalian. Cetak-ulang transaksi lama TIDAK membaca harga terbaru
   dari produkData — hasilnya identik dengan transaksi aslinya.
   ============================================================ */

/* HTML struk lengkap dari snapshot transaksi (t) + pengaturan toko (toko) */
function bangunStrukMarkup(t, toko) {
  const items = trxItems(t)
    .map(
      (i) => `<div class="si">
        <div class="si-nama">${escapeHTML(i.nama)}</div>
        <div class="si-baris">
          <span class="si-qty">${i.qty} x ${rupiah(i.harga)}</span>
          <span class="si-sub">${rupiah(i.subtotal)}</span>
        </div>
      </div>`
    )
    .join("");

  const logo = toko.logoStruk
    ? `<img class="struk-logo-img" src="${toko.logoStruk}" alt="Logo" />`
    : `<div class="struk-logo">${escapeHTML(toko.logoInisial || "K")}</div>`;

  const alamat = toko.strukShowAlamat && toko.alamatToko ? `<div class="sh-alamat">${escapeHTML(toko.alamatToko)}</div>` : "";
  const telp = toko.strukShowTelepon && toko.teleponToko ? `<div class="sh-telp">${escapeHTML(toko.teleponToko)}</div>` : "";
  const barisDiskon =
    t.diskon > 0 ? `<div><span>Diskon (${t.diskonPersen || 0}%)</span><span>-${rupiah(t.diskon)}</span></div>` : "";
  const barisPajak = t.pajak > 0 ? `<div><span>PPN ${t.taxRate > 0 ? t.taxRate + "%" : ""}</span><span>${rupiah(t.pajak)}</span></div>` : "";
  const logoHtml = toko.strukShowLogo ? logo : "";
  const barisKasir = toko.strukShowKasir ? `<div class="sm-row"><span>Kasir</span><span>${escapeHTML(toko.kasir || "-")}</span></div>` : "";

  return `<div class="struk" data-inv="${escapeHTML(t.inv)}">
    <div class="struk-header">
      ${logoHtml}
      <h4>${escapeHTML(toko.namaToko)}</h4>
      ${alamat}${telp}
    </div>
    <div class="struk-meta">
      <div class="sm-row"><span>No</span><span>${escapeHTML(t.inv)}</span></div>
      <div class="sm-row"><span>Tanggal</span><span>${escapeHTML(t.tgl)}</span></div>
      <div class="sm-row"><span>Waktu</span><span>${escapeHTML(t.waktu)}</span></div>
      ${barisKasir}
    </div>
    <div class="struk-items">${items}</div>
    <div class="struk-summary">
      <div><span>Subtotal</span><span>${rupiah(t.subtotal)}</span></div>
      ${barisDiskon}
      ${barisPajak}
      <div class="struk-total"><span>TOTAL</span><span>${rupiah(t.total)}</span></div>
      <div><span>Metode</span><span>${escapeHTML(t.metode)}</span></div>
      ${t.metode === "Tunai" ? `<div><span>Uang Diterima</span><span>${rupiah(t.uangDiterima || t.total)}</span></div>
      <div><span>Kembalian</span><span>${rupiah(t.kembalian || 0)}</span></div>` : ""}
    </div>
    <div class="struk-footer">
      ${toko.strukFooter ? `<div>${escapeHTML(toko.strukFooter)}</div>` : ""}
      ${toko.strukCatatan ? `<div class="struk-catatan">${escapeHTML(toko.strukCatatan)}</div>` : ""}
      <div class="struk-inv-foot">${escapeHTML(t.inv)}</div>
    </div>
  </div>`;
}

/* Buka modal struk (preview kertas di layar) dari snapshot transaksi */
function tampilkanStruk(inv) {
  const t = cariTransaksi(inv);
  if (!t) return;
  $("#strukJudul").textContent = "Struk " + t.inv;
  $("#strukIsi").innerHTML = bangunStrukMarkup(t, pengaturan);
  /* Lebar preview di layar mengikuti ukuran kertas terpilih */
  const strukEl = document.querySelector("#strukIsi .struk");
  if (strukEl) strukEl.style.maxWidth = (pengaturan.lebarKertas === 58 ? 230 : 302) + "px";
  $("#btnCetakStruk").dataset.inv = t.inv;
  $("#btnPreviewStruk").dataset.inv = t.inv;
  bukaModal("#modalStruk");
}

/* Atur @page sesuai lebar kertas thermal (58/80mm) — dipanggil sebelum print */
function terapkanUkuranCetak() {
  let tag = $("#strukPageStyle");
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "strukPageStyle";
    document.head.appendChild(tag);
  }
  const mm = pengaturan.lebarKertas === 58 ? 58 : 80;
  tag.textContent = `@page { size: ${mm}mm auto; margin: 0; }`;
}

/* Cetak: bangun ulang struk dari SNAPSHOT transaksi ke area cetak, lalu
   panggil dialog print browser. Ukuran kertas ikut pengaturan printer. */
function cetakStruk(inv) {
  const t = cariTransaksi(inv);
  if (!t) return;
  const area = $("#printArea");
  if (!area) return;
  area.innerHTML = bangunStrukMarkup(t, pengaturan);
  area.style.width = (pengaturan.lebarKertas === 58 ? 58 : 80) + "mm";
  terapkanUkuranCetak();
  setTimeout(() => window.print(), 350);
}

/* ---- Pengaturan toko & struk: muat/simpan form (v2: semua pengaturan) ---- */
function muatFormPengaturan() {
  const set = (sel, val) => {
    const el = $(sel);
    if (el) el.value = val || "";
  };
  set("#setNamaToko", pengaturan.namaToko);
  set("#setAlamatToko", pengaturan.alamatToko);
  set("#setTeleponToko", pengaturan.teleponToko);
  set("#setKasir", pengaturan.kasir);
  set("#setStrukFooter", pengaturan.strukFooter);
  set("#setStrukCatatan", pengaturan.strukCatatan);
  const lebar = $("#setLebarKertas");
  if (lebar) lebar.value = pengaturan.lebarKertas === 58 ? "58" : "80";
  const logoEl = $("#previewLogoStruk");
  if (logoEl) {
    if (pengaturan.logoStruk) {
      logoEl.src = pengaturan.logoStruk;
      logoEl.style.display = "";
    } else {
      logoEl.style.display = "none";
      logoEl.removeAttribute("src");
    }
  }
  /* v2 */
  const taxEnabled = $("#setTaxEnabled");
  if (taxEnabled) taxEnabled.checked = pengaturan.taxEnabled === true;
  const taxRate = $("#setTaxRate");
  if (taxRate) taxRate.value = pengaturan.taxEnabled ? String(pengaturan.taxRate) : "0";
  const mu = $("#setMataUang");
  if (mu) mu.value = pengaturan.mataUang;
  const tema = $("#setTema");
  if (tema) tema.value = pengaturan.tema;
  const qris = $("#setQrisEnabled");
  if (qris) qris.checked = pengaturan.qrisEnabled === true;
  const low = $("#setLowStock");
  if (low) low.value = String(pengaturan.lowStockDefault);
  const ap = $("#setAutoPrint");
  if (ap) ap.checked = pengaturan.autoPrint === true;
  const sk = $("#setSuaraKasir");
  if (sk) sk.checked = pengaturan.suaraKasir === true;
  const sLogo = $("#setStrukLogo");
  if (sLogo) sLogo.checked = pengaturan.strukShowLogo !== false;
  const sAlamat = $("#setStrukAlamat");
  if (sAlamat) sAlamat.checked = pengaturan.strukShowAlamat !== false;
  const sTelp = $("#setStrukTelepon");
  if (sTelp) sTelp.checked = pengaturan.strukShowTelepon !== false;
  const sKasir = $("#setStrukKasir");
  if (sKasir) sKasir.checked = pengaturan.strukShowKasir !== false;
  /* Preview gambar QRIS + status eksplisit (utk kondisi file lokal belum ada/rusak) */
  const pvQris = $("#previewQrisSettings");
  const statusQris = $("#qrisSettingsStatus");
  if (pvQris) {
    pvQris.src = getQrisImageUrl();
    pvQris.hidden = false;
    pvQris.onload = () => {
      if (statusQris) statusQris.textContent = "✓ QRIS aktif — dipakai di modal pembayaran Kasir.";
    };
    pvQris.onerror = () => {
      /* Pesan netral: file lokal opsional — QRIS tetap bisa lewat upload */
      if (statusQris) statusQris.textContent = "⚠️ File assets/qris/qris-toko.png belum ada/rusak. Upload gambar QRIS untuk memakainya.";
    };
  }
}

/* Ambil nilai dari form → state (dengan sanitasi), tanpa menulis storage */
function bacaFormPengaturan() {
  const ambil = (sel) => {
    const el = $(sel);
    return el ? el.value.trim() : "";
  };
  const cek = (sel) => {
    const el = $(sel);
    return !!el && el.checked;
  };
  pengaturan.namaToko = ambil("#setNamaToko") || PENGATURAN_DEFAULT.namaToko;
  pengaturan.alamatToko = ambil("#setAlamatToko");
  pengaturan.teleponToko = ambil("#setTeleponToko");
  pengaturan.kasir = ambil("#setKasir");
  pengaturan.strukFooter = ambil("#setStrukFooter");
  pengaturan.strukCatatan = ambil("#setStrukCatatan");
  pengaturan = sanitasiPengaturan(Object.assign({}, pengaturan, {
    taxEnabled: cek("#setTaxEnabled"),
    taxRate: Number((ambil("#setTaxRate") || "0").replace(",", ".")) || 0,
    mataUang: ambil("#setMataUang") || "IDR",
    tema: ambil("#setTema") || "terang",
    qrisEnabled: cek("#setQrisEnabled"),
    lowStockDefault: Number(ambil("#setLowStock")) || 0,
    autoPrint: cek("#setAutoPrint"),
    suaraKasir: cek("#setSuaraKasir"),
    strukShowLogo: cek("#setStrukLogo"),
    strukShowAlamat: cek("#setStrukAlamat"),
    strukShowTelepon: cek("#setStrukTelepon"),
    strukShowKasir: cek("#setStrukKasir"),
  }));
  const lebar = $("#setLebarKertas");
  pengaturan.lebarKertas = lebar && lebar.value === "58" ? 58 : 80;
}

function simpanPengaturanDariForm() {
  bacaFormPengaturan();
  const logoInput = $("#btnLogoStruk");
  const preview = $("#previewLogoStruk");
  if (logoInput && logoInput.files && logoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = () => selesaikanSimpanPengaturan(String(reader.result));
    reader.readAsDataURL(logoInput.files[0]);
    return;
  }
  /* Tanpa file baru: logo dihapus bila previewnya disembunyikan tombol Hapus */
  pengaturan.logoStruk = preview && preview.style.display !== "none" && preview.getAttribute("src") ? pengaturan.logoStruk : "";
  selesaikanSimpanPengaturan();
}

function selesaikanSimpanPengaturan(logoData) {
  if (typeof logoData === "string") pengaturan.logoStruk = logoData;
  pengaturan = sanitasiPengaturan(pengaturan);
  Storage.tulis(Storage.KEYS.PENGATURAN, pengaturan);
  terapkanTema();
  terapkanUkuranCetak(); /* @page 58/80mm ikut setting terbaru */
  renderIdentitasToko();
  renderUserCard();
  renderMetodeBayar();
  renderKeranjang(); /* label PPN & total kasir ikut setting terbaru */
  renderSemuaProduk();
  muatFormPengaturan();
  tampilkanToast("✓ Pengaturan berhasil disimpan");
}

/* Terapkan perubahan pengaturan secara programatik (upload QRIS, dsb):
   merge → sanitasi → simpan → apply UI. Satu pintu agar tak ada yang lupa disinkronkan. */
function terapkanPengaturanBaru(perubahan) {
  pengaturan = sanitasiPengaturan(Object.assign({}, pengaturan, perubahan || {}));
  Storage.tulis(Storage.KEYS.PENGATURAN, pengaturan);
  terapkanTema();
  terapkanUkuranCetak();
  renderIdentitasToko();
  renderMetodeBayar();
  renderKeranjang();
  muatFormPengaturan();
}

/* Sinkronkan identitas toko ke elemen lain (sidebar, keranjang) */
function renderIdentitasToko() {
  const el = $("#sidebarNamaToko");
  if (el) el.textContent = pengaturan.namaToko;
  const kasirEl = $("#cartKasirNama");
  if (kasirEl) kasirEl.textContent = pengaturan.kasir || "Kasir";
}

/* ============================================================
   PROFIL SAYA — render user card & edit profil
   ============================================================ */
function userAktif() {
  return users.find((u) => u.id === profil.userId) || users[0] || { nama: profil.nama, peran: "-" };
}

/* Sinkronkan foto/nama/role ke sidebar + topbar (avatar foto atau inisial) */
function renderUserCard() {
  const u = userAktif();
  const inisial = inisialAvatar(u.nama || profil.nama);
  const pasang = (idAvatar, idNama, idRole) => {
    const av = $(idAvatar);
    if (!av) return;
    if (profil.avatar) {
      /* foto: pakai <img> di dalam slot avatar */
      av.innerHTML = '<img class="avatar-foto" src="' + profil.avatar + '" alt="" />';
    } else {
      av.textContent = inisial;
      const foto = av.querySelector(".avatar-foto");
      if (foto) foto.remove();
    }
    const nm = $(idNama);
    if (nm) nm.textContent = u.nama || profil.nama;
    const rl = $(idRole);
    if (rl) rl.textContent = u.peran || "-";
  };
  pasang("#sidebarUserAvatar", "#sidebarUserName", "#sidebarUserRole");
  pasang("#topbarUserAvatar", "#topbarUserName", "#topbarUserRole");
}

function bukaProfil() {
  const u = userAktif();
  $("#profilNama").value = u.nama || profil.nama || "";
  $("#profilUsername").value = profil.username || "";
  $("#profilTelepon").value = profil.telepon || "";
  $("#profilAlamat").value = profil.alamat || "";
  $("#profilBio").value = profil.bio || "";
  $("#profilBioCount").textContent = String((profil.bio || "").length);
  const roleEl = $("#profilRole");
  roleEl.value = u.peran || "-"; /* informasi saja — tidak bisa diedit */
  $("#profilError").textContent = "";

  const img = $("#profilAvatarImg");
  const av = $("#profilAvatar");
  if (profil.avatar) {
    img.src = profil.avatar;
    img.hidden = false;
    av.hidden = true;
  } else {
    av.textContent = inisialAvatar(u.nama || profil.nama);
    av.hidden = false;
    img.hidden = true;
  }
  bukaModal("#modalProfil");
}

/* Preview foto baru di form (belum disimpan sampai Simpan) */
let fotoBaruData = null; /* null = tidak berubah; "" = dihapus */
function pasangPreviewFoto(dataURL) {
  fotoBaruData = dataURL;
  const img = $("#profilAvatarImg");
  const av = $("#profilAvatar");
  if (dataURL) {
    img.src = dataURL;
    img.hidden = false;
    av.hidden = true;
  } else {
    img.hidden = true;
    av.hidden = false;
    av.textContent = inisialAvatar($("#profilNama").value || profil.nama);
  }
}

function validasiProfil() {
  const nama = $("#profilNama").value.trim();
  const username = $("#profilUsername").value.trim();
  const telepon = $("#profilTelepon").value.trim();
  const bio = $("#profilBio").value;
  if (!nama) return "Nama lengkap tidak boleh kosong.";
  if (!username) return "Username tidak boleh kosong.";
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username))
    return "Username 3–30 karakter, hanya huruf, angka, titik, garis bawah/minus.";
  if (telepon && !/^[0-9+()\\s-]{5,20}$/.test(telepon))
    return "Nomor telepon tidak valid (contoh: 0812-3456-7890).";
  if (bio.length > 160) return "Bio maksimal 160 karakter.";
  return null;
}

function simpanProfilDariForm(e) {
  e.preventDefault();
  const err = validasiProfil();
  if (err) {
    $("#profilError").textContent = err;
    return;
  }
  const u = userAktif();
  const namaBaru = $("#profilNama").value.trim();
  const usernameBaru = $("#profilUsername").value.trim().toLowerCase();

  /* Username unik antar user (jika sistem multi-user digunakan nanti) */
  const dipakai = users.some((x) => x.id !== u.id && (x.username || "") === usernameBaru);
  if (dipakai) {
    $("#profilError").textContent = 'Username "" + usernameBaru + "" sudah digunakan pengguna lain.';
    return;
  }

  profil.nama = namaBaru;
  profil.username = usernameBaru;
  profil.telepon = $("#profilTelepon").value.trim();
  profil.alamat = $("#profilAlamat").value.trim();
  profil.bio = $("#profilBio").value.trim();
  if (fotoBaruData !== null) profil.avatar = fotoBaruData; /* berubah / dihapus */

  u.nama = namaBaru; /* sinkron dengan users[] (sumber role/userId) */
  u.username = usernameBaru;
  Storage.tulis(Storage.KEYS.USERS, users);
  simpanProfil();

  renderUserCard();
  tutupModal("#modalProfil");
  tampilkanToast("✓ Profil berhasil diperbarui");
}

function setupProfil() {
  const klikBuka = (el) => {
    if (!el) return;
    el.addEventListener("click", (e) => {
      if (e.target.closest("#btnLogout")) return; /* jangan buka profil saat klik keluar */
      bukaProfil();
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        bukaProfil();
      }
    });
  };
  klikBuka($("#sidebarUserCard"));
  klikBuka($("#topbarUserCard"));

  $("#btnGantiFoto").addEventListener("click", () => $("#fileFotoProfil").click());
  $("#fileFotoProfil").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataURL = await kompresGambar(file, 256, 0.85);
      pasangPreviewFoto(dataURL);
      tampilkanToast("Foto siap — klik Simpan Perubahan");
    } catch (err) {
      $("#profilError").textContent = err.message;
    }
  });
  $("#btnHapusFotoProfil").addEventListener("click", () => {
    fotoBaruData = "";
    pasangPreviewFoto("");
  });
  $("#profilBio").addEventListener("input", (e) => {
    $("#profilBioCount").textContent = String(e.target.value.length);
  });
  $("#formProfil").addEventListener("submit", simpanProfilDariForm);
  $("#btnBatalProfil").addEventListener("click", () => {
    fotoBaruData = null;
    tutupModal("#modalProfil");
  });
}

/* ============================================================
   KEUANGAN — semua angka dari transaksi & pengeluaran NYATA

   Rumus:
   - Omzet          = total penjualan VALID (status "Selesai", void dikecualikan)
   - Modal terjual  = Σ hargaBeli(product) × qty dari snapshot item transaksi
   - Laba kotor     = omzet − modal barang terjual
   - Laba bersih    = laba kotor − pengeluaran operasional (periode sama)
   ============================================================ */

/* ---- Rentang periode: {mulai, akhir} sebagai "YYYY-MM-DD" (inklusif) ---- */
function rentangPeriode(jenis, custom) {
  const akhir = new Date();
  const mulai = new Date();
  if (jenis === "hari") {
    // mulai = akhir = hari ini
  } else if (jenis === "7hari") {
    mulai.setDate(mulai.getDate() - 6); // termasuk hari ini
  } else if (jenis === "bulan") {
    mulai.setDate(1);
  } else if (jenis === "custom" && custom) {
    return { mulai: custom.mulai, akhir: custom.akhir };
  }
  return { mulai: tanggalISO(mulai), akhir: tanggalISO(akhir) };
}

function dalamPeriode(tanggalISOStr, rentang) {
  return tanggalISOStr >= rentang.mulai && tanggalISOStr <= rentang.akhir;
}

/* ---- Inti penghitungan keuangan untuk satu periode ---- */
function hitungKeuangan(rentang) {
  /* Pemasukan: hanya transaksi Selesai (VOID tidak dihitung) */
  const trx = transaksiData.filter((t) => t.status === "Selesai" && dalamPeriode(t.tanggal, rentang));
  const omzet = trx.reduce((a, t) => a + t.total, 0);

  /* Modal barang terjual dari snapshot hargaBeli × qty */
  const modal = trx.reduce((a, t) => a + trxItems(t).reduce((s, i) => s + (i.hargaBeli || 0) * i.qty, 0), 0);

  /* Pengeluaran tercatat pada periode yang sama */
  const eluar = pengeluaranData.filter((e) => dalamPeriode(e.tanggal, rentang));
  const pengeluaran = eluar.reduce((a, e) => a + e.nominal, 0);

  const labaKotor = omzet - modal;
  const labaBersih = labaKotor - pengeluaran;

  /* Rincian pengeluaran per kategori (untuk progress bar) */
  const perKategori = {};
  eluar.forEach((e) => {
    perKategori[e.kategori] = (perKategori[e.kategori] || 0) + e.nominal;
  });
  const kategori = Object.entries(perKategori)
    .map(([nama, nominal]) => ({ nama, nominal }))
    .sort((a, b) => b.nominal - a.nominal);

  return { omzet, modal, pengeluaran, labaKotor, labaBersih, jmlTrx: trx.length, jmlPengeluaran: eluar.length, kategori };
}

/* ---- Filter periode aktif (state halaman Keuangan) ---- */
const filterKeuangan = { jenis: "bulan", custom: null };

function renderFilterKeuanganChip() {
  $$("#keuFilterChips .chip").forEach((c) => {
    c.classList.toggle("active", c.dataset.periode === filterKeuangan.jenis);
  });
  const customBox = $("#keuCustomBox");
  if (customBox) customBox.style.display = filterKeuangan.jenis === "custom" ? "" : "none";
}

function renderFilterLaporanChip() {
  $$("#lapFilterChips .chip").forEach((c) => {
    c.classList.toggle("active", c.dataset.periode === filterLaporan.jenis);
  });
  const customBox = $("#lapCustomBox");
  if (customBox) customBox.style.display = filterLaporan.jenis === "custom" ? "" : "none";
}

/* ---- Pemasukan/pengeluaran harian untuk grafik arus kas periode aktif ---- */
function arusKasHarian(rentang) {
  const hari = [];
  const d = new Date(rentang.mulai + "T00:00:00");
  const akhir = new Date(rentang.akhir + "T00:00:00");
  /* Batasi 31 batang agar grafik tetap terbaca (custom range panjang) */
  let guard = 0;
  while (d <= akhir && guard < 31) {
    const iso = tanggalISO(d);
    const masuk = transaksiData
      .filter((t) => t.status === "Selesai" && t.tanggal === iso)
      .reduce((a, t) => a + t.total, 0);
    const keluar = pengeluaranData.filter((e) => e.tanggal === iso).reduce((a, e) => a + e.nominal, 0);
    hari.push({ iso, masuk, keluar });
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return hari;
}

function renderKeuangan() {
  const rentang = rentangPeriode(filterKeuangan.jenis, filterKeuangan.custom);
  const k = hitungKeuangan(rentang);

  /* Label periode */
  const labelMap = { hari: "Hari ini", "7hari": "7 hari terakhir", bulan: "Bulan ini", custom: "Periode kustom" };
  const label = labelMap[filterKeuangan.jenis] + " · " + formatTanggalSingkat(rentang.mulai) + " – " + formatTanggalSingkat(rentang.akhir);
  $("#keuPeriodeLabel").textContent = label;

  /* 4 kartu utama */
  $("#keuPemasukan").textContent = rupiah(k.omzet);
  $("#keuPengeluaran").textContent = rupiah(k.pengeluaran);
  $("#keuModal").textContent = rupiah(k.modal);
  const labaEl = $("#keuLabaBersih");
  labaEl.textContent = (k.labaBersih < 0 ? "−" : "") + rupiah(Math.abs(k.labaBersih));
  labaEl.className = "stat-value " + (k.labaBersih < 0 ? "laba-negatif" : "");

  /* Sub-label */
  $("#keuPemasukanSub").textContent = k.jmlTrx + " transaksi valid";
  $("#keuPengeluaranSub").textContent = k.jmlPengeluaran + " catatan pengeluaran";
  $("#keuModalSub").textContent = "HPP barang terjual (harga beli × qty)";
  $("#keuLabaBersihSub").textContent = "Laba kotor " + rupiah(k.labaKotor);

  /* Rincian laba rugi */
  $("#keuRugiLaba").innerHTML =
    `<div class="rl-row"><span>Omzet (penjualan valid)</span><strong class="rl-pos">${rupiah(k.omzet)}</strong></div>` +
    `<div class="rl-row"><span>Modal barang terjual</span><strong class="rl-neg">−${rupiah(k.modal)}</strong></div>` +
    `<div class="rl-row rl-total"><span>Laba kotor</span><strong>${rupiah(k.labaKotor)}</strong></div>` +
    `<div class="rl-row"><span>Pengeluaran operasional</span><strong class="rl-neg">−${rupiah(k.pengeluaran)}</strong></div>` +
    `<div class="rl-row rl-grand"><span>Laba bersih</span><strong class="${k.labaBersih < 0 ? "rl-neg" : "rl-pos"}">${k.labaBersih < 0 ? "−" : ""}${rupiah(Math.abs(k.labaBersih))}</strong></div>`;

  /* Grafik arus kas harian (dari data nyata) */
  const harian = arusKasHarian(rentang);
  const maxVal = Math.max(...harian.map((d) => Math.max(d.masuk, d.keluar)), 1);
  $("#chartArusKas").innerHTML = harian
    .map(
      (d) => `<div class="bar-group" title="${d.iso} — Masuk ${rupiah(d.masuk)} · Keluar ${rupiah(d.keluar)}">
        <div class="bar green" style="height:${Math.round((d.masuk / maxVal) * 100)}%">
          <span class="bar-val">${d.masuk > 0 ? rupiahSingkat(d.masuk) : ""}</span></div>
        <div class="bar red" style="height:${Math.round((d.keluar / maxVal) * 100)}%">
          <span class="bar-val">${d.keluar > 0 ? rupiahSingkat(d.keluar) : ""}</span></div>
      </div>`
    )
    .join("");
  $("#chartArusDays").innerHTML = harian
    .map((d) => `<span>${d.iso.slice(8)}</span>`)
    .join("");

  /* Rincian pengeluaran per kategori */
  const totalEluar = Math.max(k.pengeluaran, 1);
  $("#progressPengeluaran").innerHTML =
    k.kategori.length === 0
      ? '<p class="muted" style="text-align:center;padding:18px 0">Belum ada pengeluaran pada periode ini. <button class="btn btn-primary btn-sm" id="btnTambahEluarEmpty">+ Tambah Pengeluaran</button></p>'
      : k.kategori
          .map(
            (p) => `<div class="progress-item">
        <div class="progress-head"><strong>${escapeHTML(p.nama)}</strong><span>${rupiah(p.nominal)} · ${Math.round((p.nominal / totalEluar) * 100)}%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${Math.round((p.nominal / totalEluar) * 100)}%"></div></div>
      </div>`
          )
          .join("");

  /* Tabel catatan pengeluaran periode aktif */
  const bodyEl = $("#pengeluaranBody");
  if (bodyEl) {
    const daftar = pengeluaranData.filter((e) => dalamPeriode(e.tanggal, rentang));
    bodyEl.innerHTML =
      daftar.length === 0
        ? '<tr><td colspan="6" class="muted" style="text-align:center;padding:24px 0">Belum ada pengeluaran pada periode ini. <button class="btn btn-primary btn-sm" id="btnTambahEluarEmptyT">+ Tambah Pengeluaran</button></td></tr>'
        : daftar
            .map(
              (e) => `<tr>
        <td><strong>${escapeHTML(e.id)}</strong></td>
        <td><span class="badge badge-neutral">${escapeHTML(e.kategori)}</span></td>
        <td><strong>${rupiah(e.nominal)}</strong></td>
        <td class="muted">${formatTanggalSingkat(e.tanggal)}</td>
        <td class="muted">${escapeHTML(e.catatan || "—")}</td>
        <td class="text-right"><button class="btn btn-ghost btn-sm danger" data-hapus-eluar="${escapeHTML(e.id)}">Hapus</button></td>
      </tr>`
            )
            .join("");
    const countEl = $("#pengeluaranCount");
    if (countEl) countEl.textContent = daftar.length + " catatan pengeluaran";
  }
}

/* Format "2026-09-27" → "27 Sep 26" */
function formatTanggalSingkat(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit" });
}

/* ============================================================
   CRUD PENGELUARAN
   ============================================================ */
let pengeluaranEditId = null;

function bukaModalPengeluaran() {
  pengeluaranEditId = null;
  $("#modalPengeluaranJudul").textContent = "Tambah Pengeluaran";
  $("#formPengeluaran").reset();
  $("#eluarTanggal").value = tanggalISO(new Date());
  $("#eluarError").textContent = "";
  bukaModal("#modalPengeluaran");
  setTimeout(() => $("#eluarKategori").focus(), 60);
}

function isiOpsiKategoriPengeluaran() {
  const sel = $("#eluarKategori");
  if (!sel) return;
  sel.innerHTML = '<option value="">— Pilih kategori —</option>' + KATEGORI_PENGELUARAN.map((k) => `<option value="${escapeHTML(k)}">${escapeHTML(k)}</option>`).join("");
}

function simpanPengeluaranDariForm(e) {
  e.preventDefault();
  const kategori = $("#eluarKategori").value;
  const nominal = Number($("#eluarNominal").value);
  const tanggal = $("#eluarTanggal").value;
  const catatan = $("#eluarCatatan").value.trim();
  const err = $("#eluarError");

  if (!kategori) return (err.textContent = "Kategori wajib dipilih.");
  if (!Number.isFinite(nominal) || nominal <= 0) return (err.textContent = "Nominal harus lebih dari 0.");
  if (!tanggal) return (err.textContent = "Tanggal wajib diisi.");

  if (pengeluaranEditId) {
    const ex = pengeluaranData.find((x) => x.id === pengeluaranEditId);
    if (ex) Object.assign(ex, { kategori, nominal, tanggal, catatan });
    tampilkanToast("Pengeluaran " + pengeluaranEditId + " diperbarui ✏️");
  } else {
    const id = idPengeluaranBerikutnya();
    const aktif = shiftAktif();
    pengeluaranData.unshift({ id, kategori, nominal, tanggal, catatan, shiftId: aktif ? aktif.id : null });
    tampilkanToast("Pengeluaran " + id + " dicatat ✅");
  }

  Storage.tulis(Storage.KEYS.PENGELUARAN, pengeluaranData);
  tutupModal("#modalPengeluaran");
  renderKeuangan();
  renderLaporan();
  renderDashboardLainnya();
}

function hapusPengeluaran(id) {
  const ex = pengeluaranData.find((x) => x.id === id);
  if (!ex) return;
  if (!confirm("Hapus pengeluaran " + id + " (" + rupiah(ex.nominal) + ")?")) return;
  pengeluaranData = pengeluaranData.filter((x) => x.id !== id);
  Storage.tulis(Storage.KEYS.PENGELUARAN, pengeluaranData);
  renderKeuangan();
  renderLaporan();
  renderDashboardLainnya();
  tampilkanToast("Pengeluaran " + id + " dihapus 🗑️");
}

/* ============================================================
   LAPORAN — rekap lengkap dari transaksi & pengeluaran nyata
   ============================================================ */
const filterLaporan = { jenis: "bulan", custom: null };

function rentangPeriodeLaporan() {
  if (filterLaporan.jenis === "kemarin") {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const iso = tanggalISO(d);
    return { mulai: iso, akhir: iso };
  }
  return rentangPeriode(filterLaporan.jenis, filterLaporan.custom);
}

function renderLaporan() {
  const rentang = rentangPeriodeLaporan();
  const k = hitungKeuangan(rentang);

  /* Label periode */
  const labelMap = { hari: "Hari ini", kemarin: "Kemarin", "7hari": "7 hari terakhir", bulan: "Bulan ini", custom: "Periode kustom" };
  const label = $("#lapPeriodeLabel");
  if (label) label.textContent = labelMap[filterLaporan.jenis] + " · " + formatTanggalSingkat(rentang.mulai) + " – " + formatTanggalSingkat(rentang.akhir);

  /* Ringkasan utama */
  const setTxt = (sel, v) => {
    const el = $(sel);
    if (el) el.textContent = v;
  };
  setTxt("#lapOmzet", rupiah(k.omzet));
  setTxt("#lapOmzetSub", k.jmlTrx + " transaksi valid");
  const jmlVoid = transaksiData.filter((t) => t.status === "Dibatalkan" && dalamPeriode(t.tanggal, rentang)).length;
  setTxt("#lapJmlTrx", String(k.jmlTrx));
  setTxt("#lapJmlTrxSub", jmlVoid + " dibatalkan (void)");
  const qty = transaksiData
    .filter((t) => t.status === "Selesai" && dalamPeriode(t.tanggal, rentang))
    .reduce((a, t) => a + trxItems(t).reduce((s, i) => s + i.qty, 0), 0);
  setTxt("#lapQty", String(qty));
  setTxt("#lapModal", rupiah(k.modal));
  setTxt("#lapLabaKotor", rupiah(k.labaKotor));
  setTxt("#lapPengeluaran", rupiah(k.pengeluaran));
  setTxt("#lapPengeluaranSub", k.jmlPengeluaran + " catatan");
  const labaEl = $("#lapLabaBersih");
  if (labaEl) {
    labaEl.textContent = (k.labaBersih < 0 ? "−" : "") + rupiah(Math.abs(k.labaBersih));
    labaEl.className = "stat-value " + (k.labaBersih < 0 ? "laba-negatif" : "");
  }

  /* Per metode pembayaran (dari transaksi valid) */
  const perMetode = {};
  transaksiData
    .filter((t) => t.status === "Selesai" && dalamPeriode(t.tanggal, rentang))
    .forEach((t) => {
      perMetode[t.metode] = (perMetode[t.metode] || 0) + t.total;
      perMetode[t.metode + "_jml"] = (perMetode[t.metode + "_jml"] || 0) + 1;
    });
  setTxt("#lapTunaiTotal", rupiah(perMetode["Tunai"] || 0));
  setTxt("#lapTunaiBadge", "Tunai " + (perMetode["Tunai_jml"] || 0) + "x");
  setTxt("#lapQrisTotal", "QRIS: " + rupiah(perMetode["QRIS"] || 0));
  setTxt("#lapQrisBadge", "QRIS " + (perMetode["QRIS_jml"] || 0) + "x");
  const debit = perMetode["Debit"] || 0;
  if (debit > 0 && $("#lapQrisBadge")) $("#lapQrisBadge").title = "Debit: " + rupiah(debit);

  /* Grafik omzet per hari (transaksi valid) */
  const harian = arusKasHarian(rentang);
  const maxVal = Math.max(...harian.map((d) => d.masuk), 1);
  const chart = $("#lapChart");
  if (chart) {
    chart.innerHTML = harian
      .map(
        (d) => `<div class="bar-group" title="${d.iso} — ${rupiah(d.masuk)}">
        <div class="bar blue" style="height:${Math.round((d.masuk / maxVal) * 100)}%">
          <span class="bar-val">${d.masuk > 0 ? rupiahSingkat(d.masuk) : ""}</span></div>
      </div>`
      )
      .join("");
  }
  const days = $("#lapChartDays");
  if (days) days.innerHTML = harian.map((d) => `<span>${d.iso.slice(8)}</span>`).join("");

  /* Produk terlaris periode aktif (dari snapshot item) */
  const perProduk = {};
  transaksiData
    .filter((t) => t.status === "Selesai" && dalamPeriode(t.tanggal, rentang))
    .forEach((t) => {
      trxItems(t).forEach((i) => {
        if (!perProduk[i.id]) perProduk[i.id] = { nama: i.nama, qty: 0, omzet: 0, laba: 0 };
        perProduk[i.id].qty += i.qty;
        perProduk[i.id].omzet += i.subtotal;
        perProduk[i.id].laba += (i.harga - (i.hargaBeli || 0)) * i.qty;
        perProduk[i.nama] = perProduk[i.nama]; /* jaga key string tidak dipakai */
      });
    });
  const terlaris = Object.entries(perProduk)
    .filter(([id]) => Number.isFinite(Number(id)))
    .map(([, v]) => v)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);
  const tbody = $("#lapTerlarisBody");
  if (tbody) {
    tbody.innerHTML =
      terlaris.length === 0
        ? '<tr><td colspan="6" class="muted" style="text-align:center;padding:24px 0">Belum ada penjualan pada periode ini.</td></tr>'
        : terlaris
            .map(
              (p, idx) => `<tr>
        <td class="muted">${idx + 1}</td>
        <td><strong>${escapeHTML(p.nama)}</strong></td>
        <td><strong>${p.qty}</strong> pcs</td>
        <td>${rupiah(p.omzet)}</td>
        <td class="rl-pos">${rupiah(p.laba)}</td>
        <td class="text-right muted">${k.omzet > 0 ? Math.round((p.omzet / k.omzet) * 100) + "%" : "0%"}</td>
      </tr>`
            )
            .join("");
  }
  setTxt("#lapTerlarisBadge", terlaris.length + " produk");
}

/* ============================================================
   EXPORT CSV — transaksi, produk, pengeluaran (semua data nyata)
   ============================================================ */
function unduhCSV(namaFile, baris) {
  const esc = (v) => {
    const s = String(v == null ? "" : v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = baris.map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFile;  
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
  tampilkanToast("\ud83d\udce5 " + namaFile + " diunduh");
}

function csvTransaksi() {
  const header = ["Invoice", "Tanggal", "Waktu", "Status", "Metode", "Total Item", "Subtotal", "Diskon", "PPN", "Total", "Uang Diterima", "Kembalian", "Daftar Item (nama x qty @ harga)"];
  const baris = transaksiData.map((t) => [
    t.inv,
    t.tanggal,
    t.waktu,
    t.status,
    t.metode,
    t.totalItem || 0,
    t.subtotal || 0,
    t.diskon || 0,
    t.pajak || 0,
    t.total || 0,
    t.uangDiterima || 0,
    t.kembalian || 0,
    trxItems(t).map((i) => `${i.nama} x${i.qty} @${i.harga}`).join("; "),
  ]);
  unduhCSV("kasirku-transaksi.csv", [header, ...baris]);
}

function csvProduk() {
  const header = ["Kode", "Nama", "Kategori", "Harga Beli", "Harga Jual", "Stok", "Stok Minimum", "Status Stok"];
  const baris = produkData.map((p) => [
    "PRD-" + String(p.id).padStart(4, "0"),
    p.nama,
    p.kategori,
    p.beli,
    p.jual,
    p.stok,
    p.minStok != null ? p.minStok : "",
    statusStok(p),
  ]);
  unduhCSV("kasirku-produk.csv", [header, ...baris]);
}

function csvPengeluaran() {
  const header = ["ID", "Kategori", "Nominal", "Tanggal", "Catatan"];
  const baris = pengeluaranData.map((e) => [e.id, e.kategori, e.nominal, e.tanggal, e.catatan || ""]);
  unduhCSV("kasirku-pengeluaran.csv", [header, ...baris]);
}

/* ============================================================
   SIDEBAR MOBILE
   ============================================================ */
function setupSidebar() {
  const sidebar = $("#sidebar");
  const overlay = $("#sidebarOverlay");

  $("#menuToggle").addEventListener("click", () => {
    sidebar.classList.add("open");
    overlay.classList.add("show");
  });
  overlay.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
  });
}

/* ============================================================
   EVENT
   ============================================================ */
function setupEvents() {
  // Navigasi
  $$(".nav-link").forEach((link) =>
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigasiKe(link.dataset.page);
    })
  );
  $$("[data-goto]").forEach((el) => el.addEventListener("click", () => navigasiKe(el.dataset.goto)));
  $$("[data-toast]").forEach((el) =>
    el.addEventListener("click", () => tampilkanToast(el.dataset.toast))
  );

  // ===== Halaman Produk =====
  $("#btnTambahProduk").addEventListener("click", bukaModalTambah);

  $("#cariProduk").addEventListener("input", (e) => {
    filterProduk.cari = e.target.value;
    debounce("renderTabelProduk", renderTabelProduk, 120);
  });

  $("#filterKategori").addEventListener("change", (e) => {
    filterProduk.kategori = e.target.value;
    renderTabelProduk();
  });

  $("#urutProduk").addEventListener("change", (e) => {
    filterProduk.urut = e.target.value;
    renderTabelProduk();
  });

  $("#produkBody").addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit]");
    const hapus = e.target.closest("[data-hapus]");
    if (edit) bukaModalEdit(Number(edit.dataset.edit));
    if (hapus) konfirmasiHapus(Number(hapus.dataset.hapus));
  });

  // Modal produk
  $("#formProduk").addEventListener("submit", simpanProdukDariForm);
  $("#produkKategori").addEventListener("change", (e) => {
    const grp = $("#grpKategoriBaru");
    if (e.target.value === "__lainnya") {
      grp.style.display = "";
      $("#produkKategoriBaru").focus();
    } else {
      grp.style.display = "none";
    }
  });

  // Modal hapus
  $("#btnHapusYa").addEventListener("click", (e) => hapusProduk(Number(e.currentTarget.dataset.id)));
  $("#btnHapusTidak").addEventListener("click", () => tutupModal("#modalHapus"));

  // ===== Halaman Keuangan: filter periode & CRUD pengeluaran =====
  $("#keuFilterChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    filterKeuangan.jenis = chip.dataset.periode;
    renderFilterKeuanganChip();
    renderKeuangan();
  });

  ["#keuCustomMulai", "#keuCustomAkhir"].forEach((sel) => {
    $(sel).addEventListener("change", () => {
      const mulai = $("#keuCustomMulai").value;
      const akhir = $("#keuCustomAkhir").value;
      if (mulai && akhir) {
        if (mulai > akhir) {
          tampilkanToast("Tanggal mulai harus ≤ tanggal akhir.");
          return;
        }
        filterKeuangan.custom = { mulai, akhir };
        renderKeuangan();
      }
    });
  });

  $("#btnTambahPengeluaran").addEventListener("click", bukaModalPengeluaran);
  $("#formPengeluaran").addEventListener("submit", simpanPengeluaranDariForm);

  // ===== Halaman Laporan: filter periode & export CSV =====
  $("#lapFilterChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    filterLaporan.jenis = chip.dataset.periode;
    renderFilterLaporanChip();
    renderLaporan();
  });

  ["#lapCustomMulai", "#lapCustomAkhir"].forEach((sel) => {
    $(sel).addEventListener("change", () => {
      const mulai = $("#lapCustomMulai").value;
      const akhir = $("#lapCustomAkhir").value;
      if (mulai && akhir) {
        if (mulai > akhir) {
          tampilkanToast("Tanggal mulai harus ≤ tanggal akhir.");
          return;
        }
        filterLaporan.custom = { mulai, akhir };
        renderLaporan();
      }
    });
  });

  $("#btnExportTrx").addEventListener("click", csvTransaksi);
  $("#btnExportProduk").addEventListener("click", csvProduk);
  $("#btnExportEluar").addEventListener("click", csvPengeluaran);

  // ===== Topbar: pencarian global, notifikasi stok, logout =====
  $("#topSearch").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const q = e.target.value.trim();
    if (!q) return;
    const cocokProduk = produkData.some((p) => p.nama.toLowerCase().includes(q.toLowerCase()));
    const cocokTrx = transaksiData.some((t) => t.inv.toLowerCase().includes(q.toLowerCase()) || trxItems(t).some((i) => i.nama.toLowerCase().includes(q.toLowerCase())));
    if (cocokProduk) {
      filterProduk.cari = q;
      $("#cariProduk").value = q;
      renderTabelProduk();
      navigasiKe("produk");
    } else if (cocokTrx) {
      filterTrx.cari = q;
      $("#cariTrx").value = q;
      filterTrx.halaman = 1;
      renderTransaksi();
      navigasiKe("transaksi");
    } else {
      tampilkanToast("Tidak ada produk/transaksi yang cocok dengan \"" + q + "\"");
    }
  });

  $("#topbarBell").addEventListener("click", () => {
    const daftar = produkStokMenipis();
    if (daftar.length === 0) {
      tampilkanToast("Semua stok aman 👍");
      return;
    }
    navigasiKe("kasir"); // banner peringatan stok ada di halaman Kasir
  });

  $("#btnLogout").addEventListener("click", () => {
    tampilkanToast("Tetap masuk — data tersimpan di browser ini 💾");
  });

  // Tombol Batalkan pengaturan: muat ulang form dari data tersimpan
  $("#btnBatalPengaturan").addEventListener("click", () => {
    muatFormPengaturan();
    tampilkanToast("Perubahan belum disimpan dibatalkan");
  });

  /* AUTOSAVE: setiap kontrol pengaturan langsung disimpan saat berubah */
  const kontrolSettings = [
    "#setNamaToko", "#setAlamatToko", "#setTeleponToko", "#setKasir", "#setStrukFooter", "#setStrukCatatan",
    "#setLebarKertas", "#setTaxEnabled", "#setTaxRate", "#setMataUang", "#setTema", "#setQrisEnabled",
    "#setLowStock", "#setAutoPrint", "#setSuaraKasir", "#setStrukLogo", "#setStrukAlamat", "#setStrukTelepon", "#setStrukKasir",
  ];
  kontrolSettings.forEach((sel) => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener("change", () => simpanPengaturanDariForm());
  });

  // ===== Tabs Pengaturan: pindah panel aktif =====
  $$(".settings-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".settings-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      tampilkanToast("Bagian \"" + tab.textContent.trim() + "\" — profil toko tersedia penuh.");
    });
  });

  // ===== Backup & Restore =====
  $("#btnExportBackup").addEventListener("click", exportBackup);
  $("#btnImportBackup").addEventListener("click", () => $("#fileImportBackup").click());
  $("#fileImportBackup").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importBackup(String(reader.result));
    reader.onerror = () => tampilkanToast("Gagal membaca file");
    reader.readAsText(file);
    e.target.value = ""; /* izinkan pilih file yang sama lagi */
  });

  $("#pengeluaranBody").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-hapus-eluar]");
    if (btn) hapusPengeluaran(btn.dataset.hapusEluar);
  });

  // ===== POS =====
  $("#posCategories").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    kategoriAktif = chip.dataset.kat;
    renderPosKategori();
    renderPosProduk();
  });

  $("#posSearch").addEventListener("input", () => debounce("renderPosProduk", renderPosProduk, 120));

  $("#posProducts").addEventListener("click", (e) => {
    const item = e.target.closest(".product-item");
    if (!item) return;
    tambahKeKeranjang(Number(item.dataset.id));
  });

  $("#cartItems").addEventListener("click", (e) => {
    const plus = e.target.closest("[data-plus]");
    const minus = e.target.closest("[data-minus]");
    const hapusItem = e.target.closest("[data-hapus-item]");
    if (plus) ubahQty(Number(plus.dataset.plus), 1);
    if (minus) ubahQty(Number(minus.dataset.minus), -1);
    if (hapusItem) hapusDariKeranjang(Number(hapusItem.dataset.hapusItem));
  });

  // Input diskon (%)
  const inputDiskon = $("#inputDiskon");
  inputDiskon.value = diskonPersen;
  inputDiskon.addEventListener("input", () => {
    let v = Number(inputDiskon.value);
    if (!Number.isFinite(v) || v < 0) v = 0;
    if (v > 100) v = 100;
    diskonPersen = v;
    Storage.tulis(Storage.KEYS.DISKON, diskonPersen);
    renderKeranjang();
  });

  $("#btnClearCart").addEventListener("click", () => {
    if (keranjang.length === 0) return;
    keranjang = [];
    Storage.tulis(Storage.KEYS.KERANJANG, keranjang);
    renderKeranjang();
    tampilkanToast("Keranjang dikosongkan");
  });

  $("#btnHold").addEventListener("click", holdKeranjang);
  $("#btnPay").addEventListener("click", cobaSelesaikanPembayaran);

  // Held list: recall / buang (delegasi)
  $("#heldList").addEventListener("click", (e) => {
    const r = e.target.closest("[data-recall]");
    const b = e.target.closest("[data-buang-held]");
    if (r) recallHeld(r.dataset.recall);
    if (b) buangHeld(b.dataset.buangHeld);
  });

  // Shift: buka / tutup (delegasi karena kartu di-render ulang)
  $("#shiftBox").addEventListener("click", (e) => {
    const normalisasi = (id) => Number(String($(id).value).replace(/[^\d]/g, "") || 0);
    if (e.target.closest("#btnBukaShift")) {
      bukaShift(normalisasi("#shiftModalAwal"));
    } else if (e.target.closest("#btnTutupShift")) {
      const aktif = shiftAktif();
      const r = hitungShift(aktif);
      const aktual = normalisasi("#shiftKasAktual");
      if (!aktual && r.kasSeharusnya > 0) {
        tampilkanToast("Isi kas aktual dulu (kas seharusnya " + rupiah(r.kasSeharusnya) + ")");
        return;
      }
      tutupShift(aktual);
    }
  });

  // Barcode scanner: Enter di search POS → cari & tambah produk, fokus kembali
  $("#posSearch").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = e.target.value.trim();
    if (!q) return;
    const ql = q.toLowerCase();
    const p =
      produkData.find((x) => String(x.barcode || "").toLowerCase() === ql) ||
      produkData.find((x) => String(x.sku || "").toLowerCase() === ql) ||
      produkData.find((x) => x.nama.toLowerCase() === ql) ||
      (produkData.filter((x) => x.nama.toLowerCase().includes(ql)).length === 1 ? produkData.filter((x) => x.nama.toLowerCase().includes(ql))[0] : null);
    if (!p) {
      tampilkanToast("❌ Produk dengan barcode/\"" + q + "\" tidak ditemukan");
      e.target.select();
      return;
    }
    tambahKeKeranjang(p.id);
    e.target.value = "";
    e.target.focus();
  });

  // QRIS zoom — hanya bila gambar modal QRIS benar-benar termuat
  $("#btnQrisZoom").addEventListener("click", () => {
    const img = $("#qrisImage");
    if (!img || img.style.display === "none" || (img.complete && img.naturalWidth === 0)) {
      tampilkanToast("Gambar QRIS belum tersedia — upload di Pengaturan atau letakkan assets/qris/qris-toko.png");
      return;
    }
    terapkanQrisGambar();
    bukaModal("#modalQrisZoom");
  });

  // Empty-state tambah pengeluaran (delegasi, elemen dirender ulang)
  document.addEventListener("click", (e) => {
    if (e.target.closest("#btnTambahEluarEmpty") || e.target.closest("#btnTambahEluarEmptyT")) bukaModalPengeluaran();
  });

  // ===== Halaman Transaksi: filter, pagination, detail, struk =====
  const cariTrx = $("#cariTrx");
  cariTrx.addEventListener("input", () => {
    filterTrx.cari = cariTrx.value;
    filterTrx.halaman = 1;
    debounce("renderTransaksi", renderTransaksi, 150);
  });

  $("#filterTanggalTrx").addEventListener("change", (e) => {
    filterTrx.tanggal = e.target.value;
    filterTrx.halaman = 1;
    renderTransaksi();
  });

  $("#btnResetTanggal").addEventListener("click", () => {
    filterTrx.tanggal = "";
    $("#filterTanggalTrx").value = "";
    filterTrx.halaman = 1;
    renderTransaksi();
  });

  $("#filterMetodeTrx").addEventListener("change", (e) => {
    filterTrx.metode = e.target.value;
    filterTrx.halaman = 1;
    renderTransaksi();
  });

  $("#filterStatusTrx").addEventListener("change", (e) => {
    filterTrx.status = e.target.value;
    filterTrx.halaman = 1;
    renderTransaksi();
  });

  $("#paginationTrx").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-page-trx]");
    if (!btn) return;
    const v = btn.dataset.pageTrx;
    const totalHalaman = Math.max(1, Math.ceil(transaksiTerfilter().length / TRANSAKSI_PER_HALAMAN));
    if (v === "prev") filterTrx.halaman = Math.max(1, filterTrx.halaman - 1);
    else if (v === "next") filterTrx.halaman = Math.min(totalHalaman, filterTrx.halaman + 1);
    else filterTrx.halaman = Number(v);
    renderTransaksi();
  });

  $("#transaksiBody").addEventListener("click", (e) => {
    const detail = e.target.closest("[data-detail]");
    const struk = e.target.closest("[data-struk]");
    if (detail) bukaDetailTransaksi(detail.dataset.detail);
    if (struk) tampilkanStruk(struk.dataset.struk);
  });

  $("#btnDetailStruk").addEventListener("click", (e) => {
    tutupModal("#modalDetail");
    cetakStruk(e.currentTarget.dataset.inv);
  });

  /* Void transaksi dari modal detail: kembalikan stok + status Dibatalkan */
  $("#btnVoidTrx").addEventListener("click", (e) => {
    const inv = e.currentTarget.dataset.inv;
    tutupModal("#modalDetail");
    voidTransaksi(inv);
  });

  /* Cetak struk dari modal struk (membangun ulang dari snapshot transaksi) */
  $("#btnCetakStruk").addEventListener("click", (e) => {
    cetakStruk(e.currentTarget.dataset.inv || $("#strukIsi .struk")?.dataset.inv);
  });

  /* Preview struk: modal struk menampilkan kertas struk (sudah snapshot);
     kilau ulang isi dari snapshot agar selalu konsisten dengan data transaksi */
  $("#btnPreviewStruk").addEventListener("click", (e) => {
    const inv = e.currentTarget.dataset.inv || $("#strukIsi .struk")?.dataset.inv;
    const t = inv && cariTransaksi(inv);
    if (t) {
      $("#strukIsi").innerHTML = bangunStrukMarkup(t, pengaturan);
      tampilkanToast("Preview struk " + inv + " diperbarui");
    }
  });

  /* ===== PENGATURAN TOKO & STRUK ===== */
  muatFormPengaturan();
  $("#btnSimpanPengaturan").addEventListener("click", simpanPengaturanDariForm);
  $("#btnLogoStruk").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      tampilkanToast("File harus gambar (PNG/JPG).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      $("#previewLogoStruk").src = reader.result;
      $("#previewLogoStruk").style.display = "";
      tampilkanToast("Logo dimuat — klik Simpan Perubahan untuk menerapkan.");
    };
    reader.readAsDataURL(file);
  });
  $("#btnHapusLogo").addEventListener("click", () => {
    $("#btnLogoStruk").value = "";
    $("#previewLogoStruk").style.display = "none";
    $("#previewLogoStruk").removeAttribute("src");
    tampilkanToast("Logo dihapus — klik Simpan Perubahan.");
  });

  // Modal QRIS: tombol "Pembayaran Diterima"
  $("#btnQrisDiterima").addEventListener("click", konfirmasiQrisDiterima);

  /* ===== Pengaturan QRIS: upload / hapus / preview gambar QRIS toko =====
     Disimpan sebagai dataURL TERKOMPRESI (PNG, QR harus tajam) — bukan File mentah. */
  const inputQris = $("#inputQrisFile");
  $("#btnUploadQris").addEventListener("click", () => inputQris.click());
  inputQris.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const dataURL = await kompresGambar(file, 600, 1.0, "image/png");
      terapkanPengaturanBaru({ qrisImage: dataURL });
      muatFormPengaturan();
      terapkanQrisGambar(); /* modal kasir langsung pakai QRIS baru */
      tampilkanToast("✅ QRIS toko disimpan — langsung dipakai di pembayaran");
    } catch (err) {
      tampilkanToast("❌ " + (err.message || "Gagal memproses gambar QRIS."));
    }
    e.target.value = "";
  });
  $("#btnHapusQris").addEventListener("click", () => {
    terapkanPengaturanBaru({ qrisImage: "" });
    muatFormPengaturan();
    tampilkanToast("QRIS upload dihapus — fallback ke file assets/qris/qris-toko.png");
  });

  // Fallback di modal QRIS: tombol menuju Pengaturan
  $("#btnBukaQrisSettings").addEventListener("click", () => {
    tutupModal("#modalQris");
    tutupModal("#modalQrisZoom");
    navigasiKe("pengaturan");
  });

  // Fallback bila gambar QRIS gagal dimuat (file hilang/rusak/404) — tanpa broken image
  $("#qrisImage").addEventListener("error", () => {
    $("#qrisImage").style.display = "none";
    $("#qrisFallback").hidden = false;
    $("#qrisFallbackPesan").innerHTML = "<strong>QRIS gagal dimuat.</strong><br>Periksa file QRIS toko atau upload ulang di Pengaturan.";
  });
  $("#qrisImage").addEventListener("load", () => {
    $("#qrisImage").style.display = "";
    $("#qrisFallback").hidden = true;
    /* QR termuat = QRIS VALID: bersihkan pesan error basi agar tidak muncul salah konteks */
    const pesan = $("#qrisFallbackPesan");
    if (pesan) pesan.textContent = "";
  });

  // Jika gambar sudah gagal dimuat sebelum listener terpasang (mis. cache 404)
  const qrisImg = $("#qrisImage");
  if (qrisImg.complete && qrisImg.naturalWidth === 0) {
    qrisImg.style.display = "none";
    $("#qrisFallback").hidden = false;
  }

  // ===== Pembayaran =====
  $("#payMethods").addEventListener("click", (e) => {
    const btn = e.target.closest(".pay-method");
    if (btn) setMetodeBayar(btn.dataset.metode);
  });

  // Input uang diterima: hanya angka, format ribuan saat mengetik
  const inputUang = $("#uangDiterima");
  inputUang.addEventListener("input", () => {
    const digits = inputUang.value.replace(/[^\d]/g, "").slice(0, 12);
    uangDiterima = Number(digits || 0);
    inputUang.value = uangDiterima > 0 ? uangDiterima.toLocaleString("id-ID") : "";
    renderPanelTunai();
  });

  // Tombol nominal cepat & uang pas
  $("#quickCash").addEventListener("click", (e) => {
    const exact = e.target.closest("[data-exact]");
    const nominal = e.target.closest("[data-nominal]");
    if (exact) {
      uangDiterima = hitungTotal().total;
    } else if (nominal) {
      uangDiterima = Number(nominal.dataset.nominal);
    } else return;
    renderPanelTunai();
  });
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  setupSidebar();
  setupModalTutup();
  setupEvents();
  setupPWA();
  terapkanTema();
  isiOpsiKategoriPengeluaran();
  renderIdentitasToko();
  renderUserCard();
  setupProfil();
  renderDashboardLainnya();
  renderSemuaProduk();
  renderTransaksi();
  renderKeuangan();
  renderLaporan();
});
