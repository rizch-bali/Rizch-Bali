// Server-render Open Graph metadata for CMS detail pages.
// This keeps the normal detail.html + detail.js browser experience, while sending
// WhatsApp and other crawlers metadata in the initial HTML response.
const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://rizchbali.com';
const SUPABASE_URL = 'https://iqfpetbkpshntuffknza.supabase.co';
// This is the public/publishable Supabase key already used by the site's public sitemap.
const SUPABASE_ANON_KEY = 'sb_publishable_fquwhowU8u6UgQeLpGZlsQ_GOxv3kx7';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function absoluteUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw, SITE_URL + '/').toString();
  } catch (_) {
    return '';
  }
}

function routeFor(type, slug) {
  const safeSlug = encodeURIComponent(slug);
  if (type === 'jual_beli') return `${SITE_URL}/jual-beli/${safeSlug}/`;
  if (type === 'service') return `${SITE_URL}/layanan-konten/${safeSlug}`;
  if (type === 'article') return `${SITE_URL}/artikel/konten/${safeSlug}`;
  return `${SITE_URL}/halaman/${safeSlug}`;
}

function metaTag(attribute, key, value) {
  return `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(value)}">`;
}

function replaceOrInsertMeta(html, attribute, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}\\s*=\\s*["']${escapedKey}["'])[^>]*>`, 'i');
  const tag = metaTag(attribute, key, value);
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n</head>`);
}

function replaceCanonical(html, canonical) {
  html = html.replace(/<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*>\s*/i, '');
  return html.replace(/<\/head>/i,
    `    <link rel="canonical" href="${escapeHtml(canonical)}">\n</head>`);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json'
    }
  });
  if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
  return response.json();
}

async function getGlobalSettings() {
  const query = new URLSearchParams({
    select: 'setting_value',
    setting_key: 'eq.global',
    limit: '1'
  });
  const rows = await fetchJson(`${SUPABASE_URL}/rest/v1/cms_settings?${query}`);
  return rows && rows[0] && rows[0].setting_value && typeof rows[0].setting_value === 'object'
    ? rows[0].setting_value : {};
}

async function getContent(slug, type) {
  const query = new URLSearchParams({
    select: '*',
    slug: `eq.${slug}`,
    content_type: `eq.${type}`,
    status: 'eq.published',
    deleted_at: 'is.null',
    limit: '1'
  });
  const rows = await fetchJson(`${SUPABASE_URL}/rest/v1/cms_content?${query}`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

function setInitialMetadata(template, content, global, slug, type) {
  const title = String(content && (content.og_title || content.seo_title || content.title)
    || global.seoTitle || 'Rizch Bali').trim();
  const description = String(content && (content.og_description || content.seo_description || content.excerpt)
    || global.seoDescription || '').trim();
  const image = absoluteUrl(content && (content.og_image || content.image_url)
    || global.ogImage || global.logoUrl || `${SITE_URL}/rizch-service-bali.jpg`);
  const canonical = absoluteUrl(content && content.canonical_url)
    || absoluteUrl(content && content.public_url)
    || routeFor(type, slug);
  const siteName = String(global.siteName || 'Rizch Bali');
  const ogType = content && content.og_type
    || (type === 'article' ? 'article' : type === 'jual_beli' ? 'product' : 'website');

  template = template.replace(/<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(title)} | ${escapeHtml(siteName)}</title>`);

  template = replaceOrInsertMeta(template, 'name', 'description', description);
  template = replaceOrInsertMeta(template, 'property', 'og:title', title);
  template = replaceOrInsertMeta(template, 'property', 'og:description', description);
  template = replaceOrInsertMeta(template, 'property', 'og:type', ogType);
  template = replaceOrInsertMeta(template, 'property', 'og:url', canonical);
  template = replaceOrInsertMeta(template, 'property', 'og:site_name', siteName);
  template = replaceOrInsertMeta(template, 'property', 'og:image', image);
  template = replaceOrInsertMeta(template, 'name', 'twitter:card', image ? 'summary_large_image' : 'summary');
  template = replaceOrInsertMeta(template, 'name', 'twitter:title', title);
  template = replaceOrInsertMeta(template, 'name', 'twitter:description', description);
  template = replaceOrInsertMeta(template, 'name', 'twitter:image', image);
  template = replaceCanonical(template, canonical);
  return template;
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const slug = String((req.query && req.query.slug) || '').trim();
  const type = String((req.query && req.query.type) || '').trim();
  const allowedTypes = new Set(['root', 'service', 'article', 'jual_beli']);

  if (!slug || !allowedTypes.has(type) || slug.includes('/') || slug.includes('\\')) {
    res.status(400).send('Invalid content route.');
    return;
  }

  let template;
  try {
    template = fs.readFileSync(path.join(process.cwd(), 'konten', 'detail.html'), 'utf8');
  } catch (error) {
    console.error('Cannot read konten/detail.html:', error);
    res.status(500).send('Page template unavailable.');
    return;
  }

  try {
    const [content, global] = await Promise.all([getContent(slug, type), getGlobalSettings()]);
    if (!content) {
      res.status(404).send(setInitialMetadata(template, null, global, slug, type));
      return;
    }
    res.status(200).send(setInitialMetadata(template, content, global, slug, type));
  } catch (error) {
    // Keep the page usable if Supabase is temporarily unavailable. The client-side
    // detail.js can still attempt to load content in the browser.
    console.error('Failed to prepare CMS metadata:', error);
    res.status(200).send(setInitialMetadata(template, null, {}, slug, type));
  }
};
