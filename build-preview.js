/* ============================================================
   build-preview.js — Bangun preview.html (mirror satu-file)

   Preview server hanya menyajikan SATU file HTML, sehingga CSS & JS
   harus di-inline. Jalankan setiap kali index.html / css/style.css /
   js/app.js berubah:

       node build-preview.js

   Catatan PWA: manifest & icon TIDAK di-inline (preview tidak bisa
   install PWA). Tag terkait dibuang di mirror + guard registrasi SW
   di app.js berbasis protokol mencegah error — aplikasi kasir tetap
   berfungsi normal di mirror.

   Untuk PWA penuh (install, offline, icon): jalankan index.html via
   server statis, mis. `npx serve` di folder ini.
   ============================================================ */
const fs = require("fs");
const path = require("path");

const root = __dirname;

function baca(rel) {
  const isi = fs.readFileSync(path.join(root, rel), "utf8");
  console.log("Baca", rel, "(" + isi.length + " chars)");
  return isi;
}

const html = baca("index.html");
const css = baca(path.join("css", "style.css"));
const js = baca(path.join("js", "app.js"));

const linkTag = '<link rel="stylesheet" href="css/style.css" />';
const scriptTag = '<script src="js/app.js"></script>';

if (!html.includes(linkTag)) throw new Error("Tag link CSS tidak ditemukan di index.html");
if (!html.includes(scriptTag)) throw new Error("Tag script JS tidak ditemukan di index.html");

/* Replacer HARUS berupa function: kalau string, '$' di kode JS ditafsirkan
   sebagai pola khusus replace() (mis. $&, $`, $') dan script jadi korup. */
let gabung = html
  .replace(linkTag, () => "<style>\n" + css + "\n</style>")
  .replace(scriptTag, () => "<script>window.__KASIRKU_MIRROR=true;\n" + js + "\n</script>");

/* Buang referensi file eksternal PWA yang tidak tersaji oleh preview server:
   manifest, icon, apple-touch-icon (mencegah 404 di console preview). */
gabung = gabung
  .replace(/<link rel="manifest"[^>]*>/g, "")
  .replace(/<link rel="icon"[^>]*>/g, "")
  .replace(/<link rel="apple-touch-icon"[^>]*>/g, "");

fs.writeFileSync(path.join(root, "preview.html"), gabung);
console.log("✅ preview.html dibangun ulang (" + gabung.length + " chars) — sinkron dengan index.html + style.css + app.js");
console.log("ℹ️  PWA (install/offline) aktif saat index.html disajikan via HTTP server statis, bukan di mirror preview.");
