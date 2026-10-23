# Laporan Perubahan CMS Rizch Bali

## Yang dikerjakan
- Menambahkan halaman Global Settings di dashboard admin untuk brand, URL utama, logo, WhatsApp, email, alamat, jam kerja, media sosial, default SEO, OG image, dan robots default.
- Menambahkan pengelolaan kategori terpisah menurut jenis konten (Root, Layanan, Artikel, Jual Beli), termasuk pemeriksaan sebelum menghapus kategori yang masih dipakai.
- Menambahkan kolom SEO per konten: keywords, canonical manual, robots, Open Graph, dan Twitter/X.
- Detail konten CMS kini membentuk metadata SEO, canonical otomatis/manual, dan JSON-LD berdasarkan jenis konten.
- Perubahan slug pada konten yang tetap berstatus terbit menyimpan rute lama di tabel pengalihan.
- Mengganti ikon sosial di navbar homepage dengan tautan Admin ke `/admin/`; tautan sosial di footer tidak dihapus.
- Menambahkan pemuatan Global Settings di homepage, halaman Artikel, dan Jual Beli untuk logo, nama brand, tautan sosial, WhatsApp, dan kontak yang sesuai.
- Mempertahankan pemisahan jenis konten dan pola URL yang telah dikonfigurasi di `vercel.json`; menu Layanan tetap menuju `#layanan` di homepage.

## File yang diubah atau ditambahkan
- `admin/index.html`
- `admin/admin.js`
- `admin/schema.sql`
- `index.html`
- `artikel/blog-index.html`
- `jual-beli/index.html`
- `konten/detail.js`
- `global-settings.js` (baru)
- `LAPORAN-PERUBAHAN-CMS.md` (baru)

## Database yang diperlukan
Jalankan `admin/upgrade-global-settings.sql` satu kali melalui Supabase SQL Editor. Pembaruan ini bersifat aditif: menambahkan tabel `cms_settings`, `cms_categories`, `cms_slug_redirects`, kolom SEO yang belum ada, serta kebijakan RLS. Tidak ada perintah penghapusan tabel atau data. Periksa hasil eksekusi SQL sebelum mencoba fitur baru.

## Batasan yang diketahui
- File `admin/supabase-config.js` di ZIP sumber masih berisi placeholder URL dan anon key. Karena nilai proyek Supabase Anda tidak tersedia di ZIP ini, file tersebut sengaja tidak diisi dengan nilai tebakan. Untuk menghubungkan CMS, pertahankan/gunakan URL dan anon public key proyek Anda di file ini; jangan pernah menaruh `service_role` key di browser.
- Pengujian browser interaktif dengan akun Supabase Anda belum dilakukan dari lingkungan ini. Karena itu, penyimpanan nyata ke database, upload gambar, autentikasi, dan rendering live tidak dinyatakan lulus.
- Metadata di `konten/detail.js` dibentuk di browser. Untuk crawler yang tidak menjalankan JavaScript, metadata SEO dinamis belum setara dengan rendering server-side. Halaman statis lama tetap memakai metadata HTML yang sudah ada.
- Pengalihan slug berlaku untuk halaman CMS dinamis yang melewati rewrite di `vercel.json`; belum dilakukan perubahan pada hosting/live.

## Pemeriksaan yang benar-benar dilakukan
- `node --check` untuk `admin/admin.js`, `konten/detail.js`, dan `global-settings.js`.
- Parsing HTML untuk `index.html`, `admin/index.html`, `artikel/blog-index.html`, `jual-beli/index.html`, dan `konten/detail.html`.
- Pemeriksaan referensi ID pada admin; satu ID yang tidak statis adalah `previewBody`, dibuat dinamis oleh fungsi pratinjau.
- Pemeriksaan keberadaan tabel dan kolom baru di `admin/schema.sql`.
- Tidak ada perubahan atau upload ke website online.
