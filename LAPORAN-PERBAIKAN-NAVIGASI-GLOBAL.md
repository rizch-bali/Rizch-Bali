# Laporan Perubahan Navigasi Global — Rizch Bali

## Cakupan
- Menyamakan navbar publik pada semua halaman HTML yang memiliki navbar.
- Menghapus tautan sosial media dari navbar desktop/mobile dan menggantinya dengan Admin (`/admin/`).
- Menyamakan tujuan Beranda, Layanan, Jual Beli, Artikel, Testimoni, dan FAQ menggunakan path same-origin.
- Mengubah tautan internal `https://rizchbali.com...` di semua elemen anchor HTML menjadi path lokal agar localhost tidak berpindah ke website live.
- Mempertahankan tautan sosial media di footer, konten, URL canonical/OG/schema, URL gambar, struktur folder, serta konfigurasi Supabase.
- Tidak mengubah database atau website live.

## File HTML yang berubah
- `syarat-perpanjang-stnk-di-bali.html`
- `syarat-mengurus-skck-di-bali.html`
- `index.html`
- `jasa-pengurusan-sim-di-bali.html`
- `cara-mengurus-stnk-hilang-di-bali.html`
- `mutasi-kendaraan-keluar-masuk-di-bali.html`
- `prosedur-balik-nama-kendaraan-di-bali.html`
- `jual-beli/index.html`
- `layanan-sim/denpasar/index.html`
- `artikel/blog-index.html`
- `artikel/edukasi/sim/cara-perpanjang-sim-di-bali/index.html`
- `konten/detail.html`

## Batas pengujian
- Pemeriksaan statis kode dan integritas ZIP dilakukan.
- Browser localhost, tampilan visual desktop/mobile, dan navigasi runtime belum diuji di komputer pengguna; lakukan pengujian lokal sebelum mengganti folder aktif.
