-- Jalankan satu kali di Supabase SQL Editor untuk menambahkan fitur perubahan CMS tanpa menghapus data.
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

-- Additive fix: record publication time when CMS content is first inserted as published.
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

