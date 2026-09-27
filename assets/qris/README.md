# Gambar QRIS Toko

Letakkan gambar QRIS statis milik toko di folder ini dengan nama file:

```
assets/qris/qris-toko.png
```

## Cara Mendapatkan Gambar QRIS

Gunakan QRIS **statis** yang sudah diterbitkan bank/PJSP untuk toko Anda (misal dari
GoPay Merchant, BCA, BRI, atau penyedia lain). Gambar biasanya berupa stiker/kartu QR.
Foto atau scan stiker tersebut, simpan sebagai PNG, lalu beri nama `qris-toko.png`
dan taruh di folder ini.

> Catatan: aplikasi ini TIDAK membuat QRIS dinamis dan TIDAK terhubung ke payment
> gateway/API mana pun. QRIS di sini murni gambar statis yang ditampilkan kepada
> pelanggan untuk dipindai.

## Jika Gambar Belum Dipasang

Selama `qris-toko.png` belum ada, modal pembayaran QRIS otomatis menampilkan
placeholder berisi petunjuk lokasi file. Begitu file diletakkan, gambar langsung
tampil tanpa perlu mengubah kode apa pun.

## Format yang Disarankan

- Format: PNG
- Rasio 1:1 (persegi), minimal 512×512 px agar mudah dipindai
- Usahakan latar putih dan QR tidak terpotong
