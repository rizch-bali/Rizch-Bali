# Perubahan CMS RizchBali — FAQ dan CTA per konten

## Perubahan
- Menu Kelola Homepage dihapus dari sidebar admin; halaman homepage HTML di root tidak diubah.
- Global Settings dipertahankan, termasuk seluruh pengaturan identitas dan kontak bersama.
- Form Buat/Edit Konten kini memiliki CTA dan FAQ khusus untuk konten tersebut.
- FAQ/CTA disimpan pada kolom `cms_content.faq_json` dan `cms_content.cta_json`.
- Halaman detail publik menampilkan FAQ/CTA milik konten yang dibuka, bukan FAQ/CTA bersama dari `cms_settings.homepage`.
- Pengaturan lama `cms_settings.homepage` tidak dihapus dari database.

## Langkah Supabase
Untuk proyek yang sudah ada, jalankan `admin/upgrade-content-faq-cta.sql` di Supabase SQL Editor, lalu muat ulang dashboard. Untuk instalasi baru, `admin/schema.sql` juga sudah mencakup kolom tersebut.

## Catatan
FAQ/CTA konten lama akan kosong sampai diisi lewat Edit Konten. Data lama di pengaturan homepage tetap aman di database, tetapi tidak lagi digunakan sebagai FAQ/CTA otomatis pada halaman detail konten.


## Fitur Sampah (soft delete)
- Daftar konten memiliki filter Konten aktif dan Sampah.
- Tombol Pindahkan ke Sampah menyimpan status sebelumnya, lalu mengubah status menjadi Draft sehingga konten tidak tampil di website.
- Tombol Pulihkan mengembalikan konten ke status sebelumnya (Draft atau Terbit).
- Kolom `deleted_at` dan `status_before_trash` ditambahkan melalui `admin/upgrade-content-faq-cta.sql`; jalankan ulang file SQL ini di Supabase sebelum memakai fitur Sampah.
