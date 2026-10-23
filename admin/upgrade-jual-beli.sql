-- Upgrade ADITIF: kolom khusus jual beli. Aman dijalankan berkali-kali.
-- Dampak: tidak mengubah/menghapus data atau kolom lama;
-- baris lama otomatis bernilai '' (kosong). PostgREST perlu reload schema.
alter table public.cms_content
  add column if not exists price text not null default '';
alter table public.cms_content
  add column if not exists jb_info_html text not null default '';
notify pgrst, 'reload schema';