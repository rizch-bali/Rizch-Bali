-- RizchBali CMS: hapus permanen konten yang sudah 30 hari di Sampah.
-- Jalankan sekali di Supabase SQL Editor pada proyek yang dipakai website.
-- Aman untuk gambar: skrip ini hanya menghapus baris cms_content, tidak menghapus Storage.
-- Catatan: pg_cron harus tersedia/diizinkan pada proyek Supabase.

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.rizch_purge_expired_trash()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  deleted_count integer;
begin
  delete from public.cms_content
   where deleted_at is not null
     and deleted_at <= now() - interval '30 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Jangan izinkan pengunjung/admin memanggil fungsi penghapusan ini secara langsung.
revoke all on function public.rizch_purge_expired_trash() from public;
revoke all on function public.rizch_purge_expired_trash() from anon;
revoke all on function public.rizch_purge_expired_trash() from authenticated;

-- Ganti job lama dengan nama yang sama agar skrip bisa dijalankan ulang.
do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'rizch-purge-expired-cms-trash'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  perform cron.schedule(
    'rizch-purge-expired-cms-trash',
    '0 * * * *',
    $job$select public.rizch_purge_expired_trash();$job$
  );
end;
$$;

-- Verifikasi setelah dijalankan:
-- select jobname, schedule, active, command
-- from cron.job
-- where jobname = 'rizch-purge-expired-cms-trash';
