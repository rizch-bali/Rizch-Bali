# Implementasi awal CMS RizchBali

## Perubahan pada salinan lokal
- Menambahkan dashboard `admin/` dengan login Supabase, daftar dan filter konten, editor, draft/terbit, pratinjau, dan upload gambar.
- Menambahkan skema database/RLS dan bucket Storage di `admin/schema.sql`.
- Menambahkan halaman daftar Jual Beli di `jual-beli/`.
- Menambahkan template detail konten dinamis di `konten/`.
- Menambahkan rewrite CMS di `vercel.json` tanpa menghapus rewrite lama.
- Menambahkan integrasi konten terbit untuk daftar artikel dan daftar layanan homepage (konten lama tetap dipertahankan).
- Mengganti tautan navigasi Wilayah yang mengarah ke `#wilayah` menjadi Jual Beli pada halaman yang ditemukan, tanpa menghapus section wilayah layanan dari homepage.

## Belum dapat dinyatakan selesai
- Supabase belum dikonfigurasi karena project URL, anon key, dan UUID dua admin belum dibuat/disediakan.
- Login, RLS, database, dan upload gambar belum diuji terhadap project nyata.
- File Root fisik dan pola URL layanan lama belum dapat ditulis otomatis dari browser. Dashboard menggunakan namespace CMS (`/halaman/`, `/layanan-konten/`, `/artikel/konten/`, `/jual-beli/`) agar tidak menimpa file yang ada. Penerbitan sebagai file HTML fisik membutuhkan proses server-side/build yang memiliki kredensial deployment/repository.
- Belum ada pengujian browser visual/desktop/mobile atau deployment preview.

## Keamanan
RLS dan Storage policies ada di schema SQL. Hanya dua pengguna yang dimasukkan secara eksplisit ke `public.admin_users` yang dapat mengubah konten. Jangan masukkan service-role key ke frontend.
