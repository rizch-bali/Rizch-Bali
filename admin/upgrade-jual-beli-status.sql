-- Upgrade aditif untuk status ketersediaan iklan jual-beli.
-- Aman dijalankan berulang kali; tidak menghapus data yang sudah ada.
alter table public.cms_content
  add column if not exists listing_status text not null default 'tersedia';

-- Normalisasi nilai awal untuk semua konten lama.
update public.cms_content
set listing_status = 'tersedia'
where listing_status is null or listing_status not in ('tersedia', 'terjual');

alter table public.cms_content
  drop constraint if exists cms_content_listing_status_check;
alter table public.cms_content
  add constraint cms_content_listing_status_check
  check (listing_status in ('tersedia', 'terjual'));

create index if not exists cms_content_jual_beli_status_idx
  on public.cms_content(content_type, listing_status, status)
  where content_type = 'jual_beli';

notify pgrst, 'reload schema';
