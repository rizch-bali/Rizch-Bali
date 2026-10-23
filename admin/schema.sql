-- RizchBali CMS schema (jalankan di Supabase SQL Editor)
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Admin',
  created_at timestamptz not null default now()
);

create or replace function public.rizch_is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public.rizch_is_admin() from public;
grant execute on function public.rizch_is_admin() to anon, authenticated;

create table if not exists public.cms_content (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('root','service','article','jual_beli')),
  title text not null,
  slug text not null,
  category text not null default '',
  listing_status text not null default 'tersedia' check (listing_status in ('tersedia','terjual')),
  region text not null default '',
  excerpt text not null default '',
  body_html text not null default '',
  faq_json jsonb not null default '[]'::jsonb,
  cta_json jsonb not null default '{}'::jsonb,
  image_url text not null default '',
  status text not null default 'draft' check (status in ('draft','published')),
  deleted_at timestamptz,
  status_before_trash text check (status_before_trash in ('draft','published') or status_before_trash is null),
  public_url text not null,
  seo_title text not null default '',
  seo_description text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (public_url),
  unique (content_type, slug)
);

create index if not exists cms_content_type_status_idx on public.cms_content(content_type, status);
create index if not exists cms_content_updated_idx on public.cms_content(updated_at desc);
create index if not exists cms_content_deleted_at_idx on public.cms_content(deleted_at);

create or replace function public.rizch_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at = now();
  elsif new.status = 'draft' then
    new.published_at = null;
  end if;
  return new;
end; $$;
drop trigger if exists cms_content_updated_at on public.cms_content;
create trigger cms_content_updated_at before update on public.cms_content
for each row execute function public.rizch_set_updated_at();

-- Set published_at immediately when a new record is inserted as published.
create or replace function public.rizch_set_published_at_insert()
returns trigger language plpgsql as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  elsif new.status = 'draft' then
    new.published_at = null;
  end if;
  return new;
end; $$;
drop trigger if exists cms_content_published_at_insert on public.cms_content;
create trigger cms_content_published_at_insert before insert on public.cms_content
for each row execute function public.rizch_set_published_at_insert();

alter table public.admin_users enable row level security;
alter table public.cms_content enable row level security;

drop policy if exists "admins read own admin row" on public.admin_users;
create policy "admins read own admin row" on public.admin_users
for select to authenticated using (user_id = auth.uid() or public.rizch_is_admin());

drop policy if exists "public reads published content" on public.cms_content;
create policy "public reads published content" on public.cms_content
for select to anon, authenticated using (status = 'published' or public.rizch_is_admin());

drop policy if exists "admins insert content" on public.cms_content;
create policy "admins insert content" on public.cms_content
for insert to authenticated with check (public.rizch_is_admin() and (created_by is null or created_by = auth.uid()));

drop policy if exists "admins update content" on public.cms_content;
create policy "admins update content" on public.cms_content
for update to authenticated using (public.rizch_is_admin()) with check (public.rizch_is_admin());

drop policy if exists "admins delete content" on public.cms_content;
create policy "admins delete content" on public.cms_content
for delete to authenticated using (public.rizch_is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rizch-content-images', 'rizch-content-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "public reads CMS images" on storage.objects;
create policy "public reads CMS images" on storage.objects
for select to anon, authenticated using (bucket_id = 'rizch-content-images');

drop policy if exists "admins upload CMS images" on storage.objects;
create policy "admins upload CMS images" on storage.objects
for insert to authenticated with check (bucket_id = 'rizch-content-images' and public.rizch_is_admin());

drop policy if exists "admins update CMS images" on storage.objects;
create policy "admins update CMS images" on storage.objects
for update to authenticated using (bucket_id = 'rizch-content-images' and public.rizch_is_admin())
with check (bucket_id = 'rizch-content-images' and public.rizch_is_admin());

drop policy if exists "admins delete CMS images" on storage.objects;
create policy "admins delete CMS images" on storage.objects
for delete to authenticated using (bucket_id = 'rizch-content-images' and public.rizch_is_admin());

-- Setelah membuat dua pengguna di Supabase Authentication, daftarkan UUID keduanya:
-- insert into public.admin_users (user_id, display_name) values
-- ('UUID_ADMIN_1', 'Admin 1'), ('UUID_ADMIN_2', 'Admin 2');


-- Additive upgrade for Global Settings, scoped categories, and complete SEO metadata.
create table if not exists public.cms_settings (
  setting_key text primary key, setting_value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now()
);
create table if not exists public.cms_categories (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null,
  content_type text not null check (content_type in ('root','service','article','jual_beli')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(content_type, slug), unique(content_type, name)
);
alter table public.cms_content add column if not exists seo_keywords text not null default '';
alter table public.cms_content add column if not exists canonical_url text not null default '';
alter table public.cms_content add column if not exists meta_robots text not null default '';
alter table public.cms_content add column if not exists og_title text not null default '';
alter table public.cms_content add column if not exists og_description text not null default '';
alter table public.cms_content add column if not exists og_image text not null default '';
alter table public.cms_content add column if not exists og_type text not null default '';
alter table public.cms_content add column if not exists twitter_card text not null default '';
alter table public.cms_content add column if not exists twitter_title text not null default '';
alter table public.cms_content add column if not exists twitter_description text not null default '';
alter table public.cms_content add column if not exists twitter_image text not null default '';
alter table public.cms_content add column if not exists deleted_at timestamptz;
alter table public.cms_content add column if not exists status_before_trash text;
create index if not exists cms_content_deleted_at_idx on public.cms_content(deleted_at);
alter table public.cms_content add column if not exists previous_slug text not null default '';
alter table public.cms_settings enable row level security;
alter table public.cms_categories enable row level security;
drop policy if exists "public reads settings" on public.cms_settings;
create policy "public reads settings" on public.cms_settings for select to anon, authenticated using (true);
drop policy if exists "admins manage settings" on public.cms_settings;
create policy "admins manage settings" on public.cms_settings for all to authenticated using (public.rizch_is_admin()) with check (public.rizch_is_admin());
drop policy if exists "public reads categories" on public.cms_categories;
create policy "public reads categories" on public.cms_categories for select to anon, authenticated using (true);
drop policy if exists "admins manage categories" on public.cms_categories;
create policy "admins manage categories" on public.cms_categories for all to authenticated using (public.rizch_is_admin()) with check (public.rizch_is_admin());

create table if not exists public.cms_slug_redirects (
  id uuid primary key default gen_random_uuid(), old_slug text not null, new_slug text not null,
  content_type text not null check (content_type in ('root','service','article','jual_beli')),
  created_at timestamptz not null default now(), unique(content_type, old_slug)
);
alter table public.cms_slug_redirects enable row level security;
drop policy if exists "public reads slug redirects" on public.cms_slug_redirects;
create policy "public reads slug redirects" on public.cms_slug_redirects for select to anon, authenticated using (true);
drop policy if exists "admins manage slug redirects" on public.cms_slug_redirects;
create policy "admins manage slug redirects" on public.cms_slug_redirects for all to authenticated using (public.rizch_is_admin()) with check (public.rizch_is_admin());


-- Pengaturan homepage CTA dan FAQ disimpan terpisah di cms_settings.setting_key=homepage.
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

-- FAQ dan CTA disimpan terpisah untuk setiap konten.
alter table public.cms_content add column if not exists faq_json jsonb not null default '[]'::jsonb;
alter table public.cms_content add column if not exists cta_json jsonb not null default '{}'::jsonb;
notify pgrst, 'reload schema';
