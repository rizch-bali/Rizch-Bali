# Perbaikan sitemap RizchBali

Paket ini dibuat dari ZIP proyek New-Konsep-RizchBali yang diberikan pengguna dan mempertahankan seluruh file proyek asli.

## Perubahan
- `vercel.json`: menambahkan rewrite untuk URL sitemap yang stabil menuju `/api/sitemap`.
- `api/sitemap.js`: menghasilkan sitemap berdasarkan halaman statis dan CMS yang berstatus `published`, `deleted_at` kosong, dan tidak `noindex`.
- `api/sitemap-static-data.json`: mengambil halaman statis dari sitemap XML asli.
- Sitemap XML statis tetap disertakan dalam proyek. Dua URL konten CMS yang diketahui sudah dihapus dikeluarkan dari XML statis:
  - `/artikel/konten/syarat-membuat-kitas-atau-kitap-di-jawa-timur`
  - `/jual-beli/jual-mobil-listrik-terbaru-di-surabaya/`

## Catatan penting
- Sitemap CMS hanya dapat mencerminkan data Supabase yang dapat dibaca oleh public/anon key dan kebijakan RLS.
- Endpoint ini perlu diuji pada preview Vercel sebelum dipush ke produksi. Jangan menganggap pengindeksan Google otomatis terjadi; sitemap membantu penemuan URL, bukan menjamin indeks.
- Generator Python lama tetap disertakan. Untuk perubahan CMS, endpoint dinamis yang dirutekan melalui `vercel.json` menjadi sumber sitemap live.
