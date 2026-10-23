# Laporan Perubahan — Footer dan Jual Beli CMS

## Sumber
- ZIP yang diperiksa: `RizchBali-CMS-pratinjau-SEO-Google(2).zip`
- Perubahan dibuat pada salinan lokal source ZIP; website live tidak diubah.

## Temuan
1. Pada `index.html` dan `artikel/blog-index.html`, footer pada source ZIP ini sudah tidak memiliki tautan/menu bernama **Wilayah**.
2. Halaman utama masih memiliki section **Wilayah Layanan Bali** tepat sebelum footer (`id="wilayah"`). Section tersebut bukan bagian footer dan dipertahankan agar struktur halaman utama tidak berubah.
3. Halaman daftar Jual Beli sebelumnya memakai layout sederhana terpisah, belum mengikuti desain halaman blog Rizch Bali.
4. Detail CMS sebelumnya mencari konten berdasarkan slug tanpa membatasi `content_type`. Jika tipe konten lain menggunakan slug sama, detail bisa gagal atau ambigu.
5. Trigger SQL lama mengisi `published_at` saat update, tetapi tidak saat konten baru langsung dibuat dengan status `published`.

## Perubahan
- `jual-beli/index.html`: layout, navigasi, hero, kartu daftar, footer, dan responsive styling diselaraskan dengan template visual `artikel/blog-index.html`.
- `jual-beli/jual-beli.js`: hanya mengambil konten `content_type = jual_beli` dan `status = published`; pencarian dan kartu memakai pola desain blog; URL detail dibentuk sebagai `/jual-beli/{slug}/`.
- `admin/admin.js`: URL yang direncanakan untuk tipe `jual_beli` kini memakai trailing slash: `/jual-beli/{slug}/`.
- `vercel.json`: rewrite detail Jual Beli menerima URL dengan dan tanpa trailing slash.
- `konten/detail.js`: pencarian detail dibatasi berdasarkan jenis konten sesuai namespace URL; canonical otomatis untuk Jual Beli memakai `/jual-beli/{slug}/`.
- `konten/detail.html` dan `konten/detail.css`: header/footer, tipografi, warna, kartu konten, dan tampilan mobile diselaraskan dengan gaya blog Rizch Bali.
- `admin/schema.sql` dan `admin/upgrade-global-settings.sql`: menambahkan trigger insert untuk mengisi `published_at` saat konten baru langsung diterbitkan. Skrip upgrade bersifat additive dan tidak menghapus data.

## Pengujian yang dilakukan
- Pemeriksaan sintaks JavaScript dengan `node --check` pada `admin/admin.js`, `jual-beli/jual-beli.js`, dan `konten/detail.js`: lulus.
- Pemeriksaan struktur `vercel.json`: lulus.
- Pemeriksaan rewrite detail Jual Beli untuk URL dengan dan tanpa trailing slash: lulus.
- Pemeriksaan isolasi jenis konten Jual Beli dan filter jenis konten di halaman detail: lulus.
- Pemeriksaan bahwa footer pada homepage, blog, daftar Jual Beli, dan detail CMS tidak memiliki label tautan **Wilayah**: lulus.
- Pemeriksaan bahwa section homepage `Wilayah Layanan Bali` tetap ada: lulus.

## Belum terverifikasi
- Alur end-to-end membuat draft, menerbitkan dari dashboard, melihat kartu di `/jual-beli/`, dan membuka detail melalui Supabase belum dapat diuji dari sini terhadap proyek database pengguna.
- Tampilan visual di browser desktop/mobile belum diuji melalui browser nyata; pengujian yang dilakukan adalah pemeriksaan kode statis.

## Langkah yang diperlukan
Karena trigger `published_at` ditambahkan pada SQL, jalankan ulang file `admin/upgrade-global-settings.sql` yang ada di ZIP ini melalui **Supabase → SQL Editor → New query → tempel isi file → Run**. Skrip menggunakan `create or replace`, `drop trigger if exists`, dan `create trigger`, sehingga dapat dijalankan ulang tanpa menghapus data CMS.
