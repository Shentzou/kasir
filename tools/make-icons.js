/* ============================================================
   make-icons.js — Generator icon PWA KasirKu (PNG murni Node,
   tanpa dependensi). Menghasilkan:
     assets/icons/icon-192.png
     assets/icons/icon-512.png
     assets/icons/icon-maskable-512.png
   Jalankan dari project root:  node tools/make-icons.js
   ============================================================ */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

/* ---------- PNG encoder (RGB, zlib) ---------- */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, pixels) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, truecolor RGB
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0; // filter none
    pixels.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/* ---------- Gambar icon: rounded square + "K" + aksen ---------- */
const BG = [79, 70, 229];      // indigo #4F46E5
const BG2 = [99, 102, 241];    // indigo terang
const FG = [255, 255, 255];    // putih
const ACCENT = [250, 204, 21]; // kuning #FACC15

function gambarIcon(size, maskable) {
  const px = Buffer.alloc(size * size * 3);
  const safe = maskable ? 0.12 : 0.0; // padding zona aman untuk maskable
  const radius = maskable ? size * 0.22 : size * 0.21;
  const half = size / 2;
  const set = (x, y, c) => {
    const i = (y * size + x) * 3;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      /* rounded-rect mask */
      const dx = Math.max(Math.abs(x - half + 0.5) - (half - radius), 0);
      const dy = Math.max(Math.abs(y - half + 0.5) - (half - radius), 0);
      const d = Math.sqrt(dx * dx + dy * dy);
      const dalam = maskable ? true : d <= radius + 0.5;
      if (!dalam) continue;
      /* gradasi diagonal halus */
      const t = (x + y) / (2 * size);
      const warna = [
        Math.round(BG[0] + (BG2[0] - BG[0]) * t),
        Math.round(BG[1] + (BG2[1] - BG[1]) * t),
        Math.round(BG[2] + (BG2[2] - BG[2]) * t),
      ];
      set(x, y, warna);
    }
  }

  /* Huruf "K" tebal (rect-based, skala terhadap size, aman di zona maskable) */
  const s = size;
  const ketebalan = Math.max(2, Math.round(s * (maskable ? 0.09 : 0.11)));
  const tinggiK = Math.round(s * (maskable ? 0.38 : 0.44));
  const kiri = Math.round(half - s * (maskable ? 0.22 : 0.18));
  const atas = Math.round(half - tinggiK / 2);
  const rect = (x0, y0, w, h, c) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, c);
    }
  };
  /* batang vertikal */
  rect(kiri, atas, ketebalan, tinggiK, FG);
  /* lengan atas & bawah (diagonal disederhanakan jadi dua blok miring via tangga) */
  const langkah = Math.round(tinggiK * 0.32);
  for (let i = 0; i < langkah; i++) {
    const y = atas + i;
    const off = Math.round((i / langkah) * s * 0.12);
    rect(kiri + ketebalan - 1 + off, y, Math.round(s * 0.10) + 1, 1, FG); // atas
    rect(kiri + ketebalan - 1 + off, atas + tinggiK - 1 - i, Math.round(s * 0.10) + 1, 1, FG); // bawah
  }
  /* titik aksen (kanan bawah) */
  const dr = Math.max(2, Math.round(s * 0.035));
  rect(Math.round(half + s * 0.16), Math.round(half + s * 0.10), dr * 2, dr * 2, ACCENT);

  return encodePNG(size, size, px);
}

/* ---------- Tulis file ---------- */
const outDir = path.join(__dirname, "..", "assets", "icons");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "icon-192.png"), gambarIcon(192, false));
fs.writeFileSync(path.join(outDir, "icon-512.png"), gambarIcon(512, false));
fs.writeFileSync(path.join(outDir, "icon-maskable-512.png"), gambarIcon(512, true));
console.log("✅ Icons dibuat di assets/icons/ (192, 512, maskable-512)");
