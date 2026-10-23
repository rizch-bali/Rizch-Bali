# Setup CMS Admin RizchBali (Supabase Free)

## Yang tersedia
- Satu dashboard untuk Halaman Root, Layanan, Edukasi/Artikel, dan Jual Beli.
- Login email/password, pencarian/filter, draft/terbit, edit, pratinjau, upload gambar.
- Kebijakan RLS di database untuk membaca konten terbit dan membatasi perubahan ke akun admin yang didaftarkan.
- Halaman daftar Jual Beli dan template detail konten dinamis.

## Penting sebelum dipakai
File `admin/supabase-config.js` sudah berisi URL project dan publishable/anon key. Pastikan nilainya sesuai project Supabase yang sedang digunakan dan kedua akun admin sudah terdaftar di `public.admin_users`. Jangan pernah memasukkan `service_role` key ke file frontend. Hanya gunakan anon/public key.

## Langkah setup
1. Buat project Supabase di https://supabase.com/ dan pilih paket Free untuk uji coba. Periksa kuota dan ketentuan terbaru sebelum penggunaan produksi.
2. Buka SQL Editor, lalu jalankan seluruh isi `admin/schema.sql`.
3. Di Authentication > Users, buat dua akun admin menggunakan email yang kamu kuasai. Nonaktifkan public sign-up bila tidak diperlukan.
4. Salin UUID kedua akun. Di SQL Editor jalankan:
   ```sql
   insert into public.admin_users (user_id, display_name) values
   ('UUID_ADMIN_PERTAMA', 'Admin 1'),
   ('UUID_ADMIN_KEDUA', 'Admin 2');
   ```
   Ganti placeholder dengan UUID asli. Jangan menaruh password di SQL atau source code.
5. Buka Project Settings > API. Salin Project URL dan anon/public key ke `admin/supabase-config.js`. Jangan menggunakan `service_role` key.
6. Jalankan website di localhost dengan server statis. Cara mudah: klik dua kali `MULAI-LOCALHOST.bat` di folder utama hasil ekstrak. Alternatif PowerShell: masuk ke folder `Rizch-Bali-main`, lalu jalankan `py -m http.server 8000`. Buka `http://localhost:8000/` dan `http://localhost:8000/admin/`. Hindari membuka HTML langsung dengan `file://` karena fetch/API dapat diblokir browser.
7. Login dengan akun admin yang sudah terdaftar, lalu uji simpan draft, edit, pratinjau, upload gambar, terbitkan, dan jadikan draft.

## URL konten baru
Dashboard memberi namespace CMS agar tidak menimpa file lama:
- Halaman Root: `/halaman/{slug}`
- Layanan: `/layanan-konten/{slug}`
- Edukasi/Artikel: `/artikel/konten/{slug}`
- Jual Beli: `/jual-beli/{slug}`

`vercel.json` memiliki rewrite untuk rute tersebut. Halaman root fisik dan pola URL layanan lama tidak ditulis otomatis ke disk dari browser. Untuk menerbitkan file statis di root atau menghasilkan halaman layanan dengan pola lama secara otomatis, diperlukan tahap build/publish server-side atau CI yang memiliki kredensial repo. Karena itu, jangan anggap workflow static-file generation sudah aktif pada paket ini.

## Rewrite Vercel
Tambahkan aturan berikut ke `vercel.json` di dalam array `rewrites`, tanpa menghapus aturan lama:
```json
{ "source": "/halaman/:slug", "destination": "/konten/detail.html?slug=:slug" },
{ "source": "/layanan-konten/:slug", "destination": "/konten/detail.html?slug=:slug" },
{ "source": "/artikel/konten/:slug", "destination": "/konten/detail.html?slug=:slug" },
{ "source": "/jual-beli/:slug", "destination": "/konten/detail.html?slug=:slug" }
```
Aturan `/jual-beli/:slug` jangan menggantikan route `/jual-beli/` untuk halaman daftar. Pastikan pengujian deployment dilakukan pada preview environment.

## Keamanan
- Admin yang bisa menulis harus tercantum di `public.admin_users`.
- RLS mengontrol operasi database/storage; menyembunyikan tombol saja tidak cukup.
- Jangan mengirim password, anon key boleh dipakai di browser, `service_role` key tidak boleh.
- Konten HTML disaring dari elemen script/event handler pada tampilan detail; tetap review konten sebelum terbit.
- Gunakan HTTPS di hosting produksi.

## Batas pengujian paket ini
Yang dapat diuji lokal tanpa kredensial: struktur HTML/CSS/JS, parse JSON, konfigurasi route, dan fallback ketika Supabase belum disiapkan. Login, RLS, penyimpanan, upload, serta publikasi database baru bisa diuji setelah project Supabase dan dua akun admin dibuat.


## Pengelolaan CTA dan FAQ Homepage
- Dashboard menyediakan menu **Kelola Homepage** untuk mengubah CTA dan FAQ, menambah/menghapus/mengurutkan FAQ, serta mengaktifkan atau menonaktifkan item.
- Pengaturan disimpan terpisah di `public.cms_settings` dengan `setting_key = 'homepage'`; data artikel, layanan, dan jual beli tidak dicampur.
- Jika tabel `cms_settings` sudah ada, jalankan `admin/upgrade-homepage-cta-faq.sql` di Supabase SQL Editor. Skrip ini bersifat additive dan tidak menghapus data.
- Homepage membaca pengaturan tersebut memakai anon/publishable key dan hanya melakukan SELECT. Hak tulis tetap dibatasi oleh RLS untuk admin terdaftar. Jika belum ada pengaturan tersimpan, homepage tetap memakai CTA/FAQ statis yang lama.
