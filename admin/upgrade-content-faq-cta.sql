-- RizchBali CMS: FAQ dan CTA per konten.
-- Jalankan sekali di Supabase SQL Editor sebelum menggunakan editor baru.
-- Tidak menghapus data lama; pengaturan homepage lama tetap tersimpan tetapi tidak lagi dipakai oleh halaman detail konten.
alter table public.cms_content
  add column if not exists faq_json jsonb not null default '[]'::jsonb;
alter table public.cms_content
  add column if not exists cta_json jsonb not null default '{}'::jsonb;
-- Fitur Sampah: konten dipindahkan secara soft-delete dan bisa dipulihkan.
alter table public.cms_content add column if not exists deleted_at timestamptz;
alter table public.cms_content add column if not exists status_before_trash text;
create index if not exists cms_content_deleted_at_idx on public.cms_content(deleted_at);
notify pgrst, 'reload schema';
