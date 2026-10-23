-- RizchBali CMS: pengaturan homepage CTA dan FAQ menggunakan cms_settings.setting_key='homepage'.
-- Aman dijalankan berulang kali; tidak menghapus atau menimpa data yang sudah ada.
create table if not exists public.cms_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.cms_settings enable row level security;
drop policy if exists "public reads settings" on public.cms_settings;
create policy "public reads settings" on public.cms_settings for select to anon, authenticated using (true);
drop policy if exists "admins manage settings" on public.cms_settings;
create policy "admins manage settings" on public.cms_settings for all to authenticated using (public.rizch_is_admin()) with check (public.rizch_is_admin());
grant select on public.cms_settings to anon, authenticated;
grant insert, update, delete on public.cms_settings to authenticated;
notify pgrst, 'reload schema';
