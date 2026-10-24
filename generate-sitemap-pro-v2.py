#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RIZCH Sitemap Generator Pro v2.4
================================
Fitur:
- Auto-detect SEMUA folder + vercel.json
- Auto Canonical Check (baca <link rel="canonical">)
- Auto OG Image (baca <meta property="og:image">)
- Auto H1 Detection (baca <h1>)
- Auto trailing slash untuk folder
- Auto lastmod, priority, changefreq
- Auto image sitemap (OG Image → fallback img pertama)
- Auto sitemap index (master)
- Duplicate checker (URL + Image)
- Broken image checker
- Audit mode (summary terminal)
- Google Search Console friendly
- Skip Google verification files (google*.html)
- Skip favicon.ico & browserconfig.xml
- Validasi canonical mismatch

Changelog v2.1:
- Skip google587186b0cfbffed5.html (Google verification)
- Skip favicon.ico & browserconfig.xml
- Audit: warning kalau canonical ≠ URL sitemap

Cara penggunaan:
1. Simpan di root project (sejajar index.html & vercel.json)
2. Jalankan: python generate-sitemap-pro-v2.py
3. Generator memperbarui api/sitemap-static-data.json; jangan membuat/mengunggah XML sitemap statis.
4. Deploy api/sitemap.js + vercel.json agar URL sitemap publik dilayani secara dinamis.
5. Submit https://rizchbali.com/sitemap.xml ke GSC
"""

import os
import sys
import json
import re
import hashlib
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict

# ============================================================
# KONFIGURASI
# ============================================================
BASE_URL = "https://rizchbali.com"
OUTPUT_DIR = "."
VERCEL_JSON = "vercel.json"

# Folder yang diabaikan
IGNORE_FOLDERS = {
    ".git", "images", "node_modules", "template", "admin",
    "__pycache__", ".vercel", ".github", "wati"
}

# File yang diabaikan
IGNORE_FILES = {
    "template", "blog-index", "artikel-data", "generate-sitemap",
    "google", "favicon", "browserconfig"
}

# Priority rules
PRIORITY_RULES = [
    (0, "1.0"),   # Root
    (1, "0.9"),   # 1 subfolder
    (2, "0.8"),   # 2 subfolder
    (3, "0.7"),   # 3 subfolder
    (4, "0.6"),   # Lebih dalam
]

# Changefreq rules
CHANGEFREQ_RULES = [
    (7, "daily"),
    (30, "weekly"),
    (90, "monthly"),
    (365, "yearly"),
    (float('inf'), "never"),
]

# ============================================================
# FUNGSI UTILITAS
# ============================================================

def should_ignore_file(filename):
    """Cek apakah file harus diabaikan."""
    base = os.path.splitext(filename)[0].lower()
    ext = os.path.splitext(filename)[1].lower()

    # Skip ekstensi khusus
    if ext in {'.ico'}:
        return True

    # Skip file browserconfig.xml
    if filename.lower() == 'browserconfig.xml':
        return True

    # Skip Google verification (google*.html)
    if filename.lower().startswith('google') and filename.lower().endswith('.html'):
        return True

    for ignore in IGNORE_FILES:
        if ignore in base:
            return True
    return False

def should_ignore_folder(folder_path):
    """Cek apakah folder harus diabaikan (exact match, bukan substring)."""
    parts = folder_path.replace(chr(92), '/').split('/')
    for part in parts:
        if part in IGNORE_FOLDERS:
            return True
    return False

def get_file_age_days(filepath):
    """Hitung umur file dalam hari."""
    try:
        mtime = os.path.getmtime(filepath)
        file_date = datetime.fromtimestamp(mtime, tz=timezone.utc)
        now = datetime.now(timezone.utc)
        return (now - file_date).days
    except:
        return 0

def get_file_lastmod(filepath):
    """Format lastmod dari tanggal file (ISO 8601)."""
    try:
        mtime = os.path.getmtime(filepath)
        return datetime.fromtimestamp(mtime, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    except:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")

def get_priority(depth):
    """Tentukan priority berdasarkan kedalaman folder."""
    for max_depth, priority in PRIORITY_RULES:
        if depth <= max_depth:
            return priority
    return "0.5"

def get_changefreq(age_days):
    """Tentukan changefreq berdasarkan umur file."""
    for max_age, freq in CHANGEFREQ_RULES:
        if age_days < max_age:
            return freq
    return "never"

def escape_xml(text):
    """Escape karakter khusus XML."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

def build_url(path_parts, is_folder=False):
    """Build URL konsisten dengan trailing slash untuk folder."""
    if not path_parts:
        return BASE_URL

    url = BASE_URL + "/" + "/".join(path_parts)
    if is_folder and not url.endswith("/"):
        url += "/"
    return url

# ============================================================
# HTML PARSER
# ============================================================

def extract_canonical(html_content):
    """Ekstrak canonical URL dari HTML."""
    # Cari <link rel="canonical" href="...">
    match = re.search(
        '<link[^>]*rel=["\']canonical["\'][^>]*href=["\']([^"\']+)["\'][^>]*>',
        html_content, re.IGNORECASE
    )
    if match:
        return match.group(1).strip()

    # Coba pola terbalik (href dulu, rel belakang)
    match = re.search(
        '<link[^>]*href=["\']([^"\']+)["\'][^>]*rel=["\']canonical["\'][^>]*>',
        html_content, re.IGNORECASE
    )
    if match:
        return match.group(1).strip()

    return None

def extract_og_image(html_content):
    """Ekstrak OG Image dari HTML."""
    match = re.search(
        '<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\'][^>]*>',
        html_content, re.IGNORECASE
    )
    if match:
        return match.group(1).strip()

    # Coba pola terbalik
    match = re.search(
        '<meta[^>]*content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\'][^>]*>',
        html_content, re.IGNORECASE
    )
    if match:
        return match.group(1).strip()

    return None

def extract_first_image(html_content):
    """Ekstrak gambar pertama dari <article> atau <main> atau body."""
    # Cari di <article> dulu
    article_match = re.search(
        '<article[^>]*>(.*?)</article>',
        html_content, re.IGNORECASE | re.DOTALL
    )
    if article_match:
        img_match = re.search(
            '<img[^>]*src=["\']([^"\']+)["\']',
            article_match.group(1), re.IGNORECASE
        )
        if img_match:
            return img_match.group(1).strip()

    # Cari di <main>
    main_match = re.search(
        '<main[^>]*>(.*?)</main>',
        html_content, re.IGNORECASE | re.DOTALL
    )
    if main_match:
        img_match = re.search(
            '<img[^>]*src=["\']([^"\']+)["\']',
            main_match.group(1), re.IGNORECASE
        )
        if img_match:
            return img_match.group(1).strip()

    # Fallback: cari img pertama di seluruh body
    body_match = re.search(
        '<body[^>]*>(.*?)</body>',
        html_content, re.IGNORECASE | re.DOTALL
    )
    if body_match:
        img_match = re.search(
            '<img[^>]*src=["\']([^"\']+)["\']',
            body_match.group(1), re.IGNORECASE
        )
        if img_match:
            return img_match.group(1).strip()

    return None

def extract_h1(html_content):
    """Ekstrak teks H1 dari HTML."""
    match = re.search(
        '<h1[^>]*>(.*?)</h1>',
        html_content, re.IGNORECASE | re.DOTALL
    )
    if match:
        # Bersihkan tag HTML di dalam H1
        h1_text = re.sub(r'<[^>]+>', '', match.group(1))
        return h1_text.strip()
    return None

def extract_main_image(html_content, file_path, url_path):
    """Ekstrak gambar utama: OG Image → fallback img pertama."""
    # Prioritas 1: OG Image
    og_image = extract_og_image(html_content)
    if og_image:
        return og_image

    # Prioritas 2: Gambar pertama di article/main/body
    first_img = extract_first_image(html_content)
    if first_img:
        # Resolve relative path ke absolute URL
        if first_img.startswith('http'):
            return first_img
        elif first_img.startswith('/'):
            return BASE_URL + first_img
        else:
            # Relative path, resolve berdasarkan URL artikel
            url_dir = "/".join(url_path.split('/')[:-1]) if '.' in url_path.split('/')[-1] else url_path
            return BASE_URL + "/" + url_dir.rstrip("/") + "/" + first_img

    return None

def parse_html_file(filepath):
    """Parse file HTML dan kembalikan data SEO."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return {
            'canonical': None,
            'og_image': None,
            'first_image': None,
            'main_image': None,
            'h1': None,
            'error': str(e)
        }

    canonical = extract_canonical(content)
    og_image = extract_og_image(content)
    first_image = extract_first_image(content)
    h1 = extract_h1(content)

    return {
        'canonical': canonical,
        'og_image': og_image,
        'first_image': first_image,
        'h1': h1,
        'error': None
    }

# ============================================================
# BACA VERCEL.JSON
# ============================================================

def get_vercel_urls():
    """Ambil URL clean dari vercel.json (artikel lama di root)."""
    urls = []

    if not os.path.exists(VERCEL_JSON):
        print(f"       !  {VERCEL_JSON} tidak ditemukan, skip...")
        return urls

    try:
        with open(VERCEL_JSON, "r", encoding="utf-8") as f:
            config = json.load(f)

        for rewrite in config.get("rewrites", []):
            source = rewrite.get("source", "")
            dest = rewrite.get("destination", "")

            # Hanya ambil URL yang ke file .html (bukan folder dinamis)
            if source.startswith("/") and not source.endswith("/") and ".html" in dest:
                # Skip yang sudah ada handler khusus
                if ":" in source or source in {"/artikel", "/artikel/"}:
                    continue

                dest_file = dest.lstrip("/")
                # Jangan masukkan URL rewrite jika file tujuan sudah tidak ada.
                # Ini mencegah URL lama/halaman yang dihapus tertinggal di sitemap.
                if not os.path.isfile(dest_file):
                    print(f"       - Skip rewrite {source}: file tujuan {dest_file} tidak ditemukan")
                    continue
                html_data = parse_html_file(dest_file)

                # Gunakan canonical kalau ada, kalau tidak pakai source
                final_url = html_data['canonical'] or (BASE_URL + source)

                # Gambar: OG Image → fallback
                main_image = html_data['og_image'] or html_data['first_image']

                age_days = get_file_age_days(dest_file) if os.path.exists(dest_file) else 365
                lastmod = get_file_lastmod(dest_file) if os.path.exists(dest_file) else datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")

                urls.append({
                    'url': final_url,
                    'lastmod': lastmod,
                    'changefreq': get_changefreq(age_days),
                    'priority': "0.9",
                    'images': [main_image] if main_image else [],
                    'is_index': False,
                    'source': 'vercel',
                    'h1': html_data['h1'],
                    'og_image': html_data['og_image'],
                    'canonical': html_data['canonical'],
                    'has_error': html_data['error'] is not None,
                    'error_msg': html_data['error']
                })

    except Exception as e:
        print(f"       !  Error baca vercel.json: {e}")

    return urls

# ============================================================
# SCANNER FOLDER
# ============================================================

def scan_folders():
    """Scan semua folder dan kelompokkan per kategori."""
    sitemap_data = defaultdict(list)

    for root, dirs, files in os.walk("."):
        # Lewati folder yang diabaikan (exact match)
        rel_root = os.path.relpath(root, ".")
        if should_ignore_folder(rel_root):
            continue

        # Hanya proses file HTML publik. Template detail CMS bukan URL konten tersendiri.
        html_files = [f for f in files if f.endswith('.html')]
        if rel_root.replace(chr(92), '/').strip('./') == 'konten':
            html_files = [f for f in html_files if f != 'detail.html']

        if not html_files:
            continue

        # Tentukan nama sitemap berdasarkan path
        parts = rel_root.replace(chr(92), '/').split('/')
        parts = [p for p in parts if p and p != '.']

        # Logika penamaan sitemap
        sitemap_name = None

        if not parts:
            sitemap_name = 'sitemap-root'
        elif parts[0] == 'artikel':
            if len(parts) >= 2 and parts[1] == 'edukasi':
                sitemap_name = 'sitemap-edukasi'
            elif len(parts) >= 2 and parts[1] == 'tips':
                sitemap_name = 'sitemap-tips'
            elif len(parts) >= 2:
                sitemap_name = f"sitemap-{parts[1]}"
            else:
                continue
        elif parts[0].startswith('layanan-'):
            sitemap_name = f"sitemap-{parts[0]}"
        else:
            sitemap_name = f"sitemap-{parts[0]}"

        # Loop untuk setiap file HTML
        for html_file in html_files:
            if should_ignore_file(html_file):
                continue

            full_path = os.path.join(root, html_file)

            # Parse HTML
            html_data = parse_html_file(full_path)

            # Build URL path
            if html_file == 'index.html':
                url_path = '/'.join(parts) if parts else ''
                is_folder = True
            else:
                url_path = '/'.join(parts + [html_file])
                is_folder = False

            # Gunakan canonical kalau ada
            if html_data['canonical']:
                url = html_data['canonical']
            else:
                url = build_url(parts if html_file == 'index.html' else parts + [html_file], is_folder)

            # Hitung kedalaman
            depth = len(parts)
            if html_file != 'index.html':
                depth += 1

            # Info file
            age_days = get_file_age_days(full_path)
            lastmod = get_file_lastmod(full_path)
            priority = get_priority(depth)
            changefreq = get_changefreq(age_days)

            # Gambar utama
            main_image = extract_main_image(
                open(full_path, 'r', encoding='utf-8').read() if os.path.exists(full_path) else '',
                full_path, url_path
            )

            # Kalau extract_main_image gagal, coba dari html_data
            if not main_image:
                main_image = html_data['og_image'] or html_data['first_image']

            images = [main_image] if main_image else []

            # Halaman kategori Jual Beli memakai og:image generik yang sama
            # dengan halaman utama. Jangan masukkan gambar generik itu ke
            # image sitemap kategori; item detail CMS tetap memakai image_url
            # masing-masing dari Supabase Storage, seperti artikel di sitemap-edukasi.
            if html_file == 'index.html' and parts == ['jual-beli']:
                images = []

            sitemap_data[sitemap_name].append({
                'url': url,
                'lastmod': lastmod,
                'changefreq': changefreq,
                'priority': priority,
                'images': images,
                'is_index': html_file == 'index.html',
                'source': 'folder',
                'h1': html_data['h1'],
                'og_image': html_data['og_image'],
                'canonical': html_data['canonical'],
                'has_error': html_data['error'] is not None,
                'error_msg': html_data['error']
            })

    return sitemap_data

# ============================================================
# GENERATOR SITEMAP XML
# ============================================================

def generate_sitemap_xml(name, urls):
    """Generate file sitemap XML."""

    # Sort: index dulu, kemudian alfabetis
    urls.sort(key=lambda x: (not x['is_index'], x['url']))

    xml_parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
    ]

    for item in urls:
        xml_parts.append('  <url>')
        xml_parts.append(f"    <loc>{escape_xml(item['url'])}</loc>")
        xml_parts.append(f"    <lastmod>{item['lastmod']}</lastmod>")
        xml_parts.append(f"    <changefreq>{item['changefreq']}</changefreq>")
        xml_parts.append(f"    <priority>{item['priority']}</priority>")

        # Tambah image sitemap (hanya gambar valid)
        for img_url in item['images']:
            if img_url and img_url.startswith('http'):
                xml_parts.append('    <image:image>')
                xml_parts.append(f"      <image:loc>{escape_xml(img_url)}</image:loc>")
                xml_parts.append('    </image:image>')

        xml_parts.append('  </url>')

    xml_parts.append('</urlset>')

    return '\n'.join(xml_parts)

def generate_master_sitemap(sitemap_files):
    """Generate sitemap.xml (master index)."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")

    xml_parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]

    for sitemap_file in sorted(sitemap_files):
        xml_parts.append('  <sitemap>')
        xml_parts.append(f"    <loc>{BASE_URL}/{sitemap_file}</loc>")
        xml_parts.append(f"    <lastmod>{now}</lastmod>")
        xml_parts.append('  </sitemap>')

    xml_parts.append('</sitemapindex>')

    return '\n'.join(xml_parts)

# ============================================================
# AUDIT MODE
# ============================================================

def run_audit(all_urls):
    """Jalankan audit SEO dan tampilkan summary."""

    total_pages = len(all_urls)
    total_canonical = sum(1 for u in all_urls if u.get('canonical'))
    total_h1 = sum(1 for u in all_urls if u.get('h1'))
    total_og = sum(1 for u in all_urls if u.get('og_image'))
    total_images = sum(len(u.get('images', [])) for u in all_urls)
    total_errors = sum(1 for u in all_urls if u.get('has_error'))

    # Cek duplicate URL
    url_counts = defaultdict(int)
    for u in all_urls:
        url_counts[u['url']] += 1
    duplicate_urls = {url: count for url, count in url_counts.items() if count > 1}

    # Cek duplicate image
    img_counts = defaultdict(int)
    for u in all_urls:
        for img in u.get('images', []):
            if img:
                img_counts[img] += 1
    duplicate_images = {img: count for img, count in img_counts.items() if count > 1}

    # Cek broken image (URL yang tidak valid)
    broken_images = []
    for u in all_urls:
        for img in u.get('images', []):
            if img and not img.startswith('http'):
                broken_images.append((u['url'], img))

    # Warnings
    warnings = []
    canonical_mismatches = []
    for u in all_urls:
        if not u.get('canonical'):
            warnings.append(f"  ⚠  {u['url']} — tidak ada canonical")
        else:
            # Validasi: canonical harus sama dengan URL sitemap
            if u['canonical'] != u['url']:
                canonical_mismatches.append(
                    f"  ⚠  {u['url']} — canonical berbeda: {u['canonical']}"
                )
        if not u.get('h1'):
            warnings.append(f"  ⚠  {u['url']} — tidak ada H1")
        if not u.get('og_image'):
            warnings.append(f"  ⚠  {u['url']} — tidak ada og:image")

    # Print audit
    print("\n" + "="*60)
    print("  📊 AUDIT SEO REPORT")
    print("="*60)

    print(f"\n  ✓  {total_pages} halaman ditemukan")
    print(f"  ✓  {total_canonical} canonical")
    print(f"  ✓  {total_h1} H1")
    print(f"  ✓  {total_og} og:image")
    print(f"  ✓  {total_images} image sitemap")

    if not duplicate_urls:
        print(f"  ✓  Tidak ada duplicate URL")
    else:
        print(f"  ✗  {len(duplicate_urls)} duplicate URL ditemukan:")
        for url, count in duplicate_urls.items():
            print(f"      - {url} ({count}x)")

    if not duplicate_images:
        print(f"  ✓  Tidak ada duplicate image")
    else:
        print(f"  ✗  {len(duplicate_images)} duplicate image ditemukan:")
        for img, count in duplicate_images.items():
            print(f"      - {img} ({count}x)")

    if not broken_images:
        print(f"  ✓  Tidak ada broken image")
    else:
        print(f"  ✗  {len(broken_images)} broken image ditemukan:")
        for page, img in broken_images:
            print(f"      - {page} → {img}")

    if total_errors == 0:
        print(f"  ✓  Tidak ada error parsing")
    else:
        print(f"  ✗  {total_errors} error parsing ditemukan")

    if not warnings:
        print(f"\n  🎉 Semua artikel lolos audit!")
    else:
        print(f"\n  ⚠  {len(warnings)} peringatan ditemukan:")
        for w in warnings:
            print(w)

    print("\n" + "="*60)


# ============================================================
# CMS SUPABASE (konten publik yang diterbitkan)
# ============================================================

def read_supabase_public_config():
    """Baca URL dan publishable/anon key dari admin/supabase-config.js."""
    config_path = Path("admin/supabase-config.js")
    if not config_path.exists():
        raise RuntimeError("admin/supabase-config.js tidak ditemukan; sitemap CMS tidak dapat diaudit.")
    content = config_path.read_text(encoding="utf-8")
    url_match = re.search(r'\burl\s*:\s*["\']([^"\']+)["\']', content)
    key_match = re.search(r'\banonKey\s*:\s*["\']([^"\']+)["\']', content)
    if not url_match or not key_match:
        raise RuntimeError("URL atau publishable/anon key Supabase tidak ditemukan dalam konfigurasi.")
    project_url, anon_key = url_match.group(1).rstrip("/"), key_match.group(1).strip()
    if not project_url.startswith("https://") or not anon_key or "PROJECT-ID" in project_url or "ISI_DENGAN" in anon_key:
        raise RuntimeError("Konfigurasi Supabase belum lengkap atau masih berupa placeholder.")
    return project_url, anon_key


def fetch_published_cms_content():
    """Ambil konten terbit yang dapat dibaca publik; tidak menggunakan kredensial admin."""
    project_url, anon_key = read_supabase_public_config()
    query = urllib.parse.urlencode({
        "select": "content_type,title,public_url,updated_at,published_at,image_url,canonical_url,meta_robots,status,deleted_at",
        "status": "eq.published",
        "deleted_at": "is.null",
        "order": "updated_at.desc",
        "limit": "5000",
    })
    endpoint = project_url + "/rest/v1/cms_content?" + query
    request = urllib.request.Request(endpoint, headers={
        "apikey": anon_key,
        "Authorization": "Bearer " + anon_key,
        "Accept": "application/json",
        "User-Agent": "RizchBali-Sitemap-Generator/2.2",
    })
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        # Fail closed: jangan menulis sitemap parsial bila data CMS tidak berhasil dibaca.
        raise RuntimeError("Gagal membaca konten publik Supabase; generator tidak dapat mengaudit data CMS. " + str(exc))
    if not isinstance(payload, list):
        raise RuntimeError("Respons Supabase tidak berbentuk daftar konten.")
    return payload


def cms_record_to_sitemap_item(record):
    """Validasi satu konten CMS dan ubah menjadi item sitemap; None berarti dikecualikan."""
    if record.get("status") != "published" or record.get("deleted_at"):
        return None
    robots = str(record.get("meta_robots") or "").lower()
    if "noindex" in robots:
        return None
    content_type = record.get("content_type")
    if content_type == "service":
        category_text = " ".join(str(record.get(k) or "") for k in ("category", "title", "public_url")).lower()
        if re.search(r"\bsim\b|surat izin mengemudi", category_text):
            group = "sitemap-layanan-sim"
        elif re.search(r"dukcapil|kependudukan|akta kelahiran|kartu keluarga|\bktp\b", category_text):
            group = "sitemap-layanan-dukcapil"
        elif re.search(r"imigrasi|\bkitas\b|\bkitap\b|izin tinggal", category_text):
            group = "sitemap-layanan-imigrasi"
        elif re.search(r"paspor|passport", category_text):
            group = "sitemap-layanan-paspor"
        elif re.search(r"kendaraan|\bstnk\b|\bbpkb\b|mutasi|balik nama", category_text):
            group = "sitemap-layanan-kendaraan"
        else:
            group = "sitemap-layanan"
    else:
        group = {"root": "sitemap-root", "article": "sitemap-edukasi", "jual_beli": "sitemap-jual-beli"}.get(content_type)
    if not group:
        return None

    public_url = str(record.get("public_url") or "").strip()
    canonical = str(record.get("canonical_url") or "").strip()
    candidate = canonical or (BASE_URL + "/" + public_url.lstrip("/"))
    parsed = urllib.parse.urlparse(candidate)
    base = urllib.parse.urlparse(BASE_URL)
    # Sitemap hanya boleh mencantumkan URL absolut pada host RizchBali.
    if parsed.scheme != "https" or parsed.netloc.lower() != base.netloc.lower() or not parsed.path.startswith("/"):
        return None
    if not public_url and not canonical:
        return None

    lastmod = record.get("updated_at") or record.get("published_at")
    if lastmod:
        lastmod = str(lastmod)
        if not re.match(r"^\d{4}-\d{2}-\d{2}(?:T.*)?$", lastmod):
            lastmod = get_file_lastmod(__file__)
    else:
        lastmod = get_file_lastmod(__file__)
    image_url = str(record.get("image_url") or "").strip()
    images = [image_url] if image_url.startswith("https://") else []
    return group, {
        "url": candidate,
        "lastmod": lastmod,
        "changefreq": "weekly",
        "priority": "0.8" if content_type in ("article", "service") else "0.7",
        "images": images,
        "is_index": False,
        "source": "cms",
        "h1": record.get("title"),
        "og_image": image_url or None,
        "canonical": canonical or None,
        "has_error": False,
        "error_msg": None,
    }


def merge_cms_content(sitemap_data, cms_records):
    """Tambahkan konten CMS terbit ke kelompok sitemap yang sesuai tanpa duplikasi URL."""
    added = 0
    skipped = 0
    for record in cms_records:
        item = cms_record_to_sitemap_item(record)
        if not item:
            skipped += 1
            continue
        sitemap_name, url_item = item
        sitemap_data.setdefault(sitemap_name, [])
        existing = {entry["url"] for entries in sitemap_data.values() for entry in entries}
        if url_item["url"] in existing:
            continue
        sitemap_data[sitemap_name].append(url_item)
        added += 1
    print(f"       CMS published: {added} URLs ditambahkan, {skipped} dikecualikan (draft/sampah/noindex/URL tidak valid).")
    return sitemap_data

# ============================================================
# MAIN
# ============================================================

def main():
    print("\n" + "="*60)
    print("  RIZCH Sitemap Generator Pro v2.4")
    print("  Dynamic CMS sitemap data | Static page scan | SEO Audit")
    print("="*60 + "\n")

    # Scan physical HTML and valid legacy rewrites only. CMS records are served
    # dynamically by api/sitemap.js, so this script must not recreate static XMLs.
    print("[1/4] Reading vercel.json and scanning static pages...")
    vercel_urls = get_vercel_urls()
    sitemap_data = scan_folders()
    if vercel_urls:
        sitemap_data.setdefault('sitemap-root', [])
        existing = {u['url'] for u in sitemap_data['sitemap-root']}
        for item in vercel_urls:
            if item['url'] not in existing:
                sitemap_data['sitemap-root'].append(item)
                existing.add(item['url'])

    # Serialize only static pages. CMS data is queried live by api/sitemap.js.
    static_payload = {}
    for name, urls in sitemap_data.items():
        valid = []
        for item in urls:
            url = str(item.get('url') or '')
            parsed = urllib.parse.urlparse(url)
            if parsed.scheme != 'https' or parsed.netloc.lower() != urllib.parse.urlparse(BASE_URL).netloc.lower():
                continue
            valid.append({
                'url': url,
                'lastmod': item.get('lastmod') or get_file_lastmod(__file__),
                'changefreq': item.get('changefreq') or 'weekly',
                'priority': item.get('priority') or '0.7',
                'images': [x for x in item.get('images', []) if isinstance(x, str) and x.startswith('https://')],
                'is_index': bool(item.get('is_index')),
                'source': 'static'
            })
        if valid:
            static_payload[name] = valid

    api_dir = Path('api')
    api_dir.mkdir(exist_ok=True)
    output = api_dir / 'sitemap-static-data.json'
    output.write_text(json.dumps(static_payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    total = sum(len(v) for v in static_payload.values())
    print(f"       {total} URL halaman statis ditulis ke {output.as_posix()}")

    print("[2/4] Memeriksa data CMS untuk audit (tidak menulis XML statis)...")
    all_urls = [item for urls in sitemap_data.values() for item in urls]
    try:
        cms_records = fetch_published_cms_content()
        cms_count = 0
        for record in cms_records:
            item = cms_record_to_sitemap_item(record)
            if item:
                _, url_item = item
                all_urls.append(url_item)
                cms_count += 1
        print(f"       {cms_count} URL CMS terbit valid; URL CMS tetap disajikan dinamis saat request sitemap.")
    except RuntimeError as exc:
        print("       Peringatan: audit CMS tidak tersedia: " + str(exc))
        print("       Data statis tetap dibuat; API akan mencoba membaca CMS saat Google meminta sitemap.")

    print("[3/4] Menjalankan audit URL...")
    run_audit(all_urls)
    print("[4/4] Selesai.")
    print("       Jangan unggah XML sitemap statis. URL sitemap dipetakan melalui api/sitemap.js dan vercel.json.")
    print("       File yang diperbarui oleh generator: api/sitemap-static-data.json\n")

if __name__ == "__main__":
    main()
