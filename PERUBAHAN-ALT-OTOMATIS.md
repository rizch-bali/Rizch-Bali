# Perubahan ALT Otomatis — Rizch Bali CMS

## Perubahan
- Saat menyimpan konten melalui admin, gambar di dalam `body_html` yang belum memiliki atribut `alt` atau memiliki ALT kosong akan diberi ALT otomatis berdasarkan caption/teks judul gambar/konteks judul konten.
- ALT manual yang sudah terisi dipertahankan.
- Halaman detail publik (`konten/detail.js`) menerapkan fallback ALT otomatis pada gambar isi konten lama yang belum memiliki ALT.
- Gambar utama pada halaman detail menggunakan judul konten sebagai ALT.
- Pratinjau gambar utama di admin memakai ALT deskriptif.
- Kartu dinamis Artikel/Layanan dan Jual Beli sudah menggunakan judul konten sebagai ALT.

## Database
Tidak ada perubahan skema database. Tidak perlu menjalankan SQL baru untuk perubahan ini.

## Pengujian
- `node --check` berhasil untuk `admin/admin.js`, `konten/detail.js`, dan `jual-beli/jual-beli.js`.
- Belum diuji di browser localhost dengan Supabase aktif.
- ALT otomatis adalah fallback berbasis konteks. Untuk hasil paling akurat, teks gambar dapat memakai caption atau judul yang sesuai di isi konten; tidak ada kolom ALT tambahan yang diwajibkan.
