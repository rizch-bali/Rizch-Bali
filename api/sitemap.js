// Dynamic XML sitemaps for RizchBali CMS.
// Stable public sitemap URLs are routed here by vercel.json.
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://rizchbali.com';
const SUPABASE_URL = 'https://iqfpetbkpshntuffknza.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_fquwhowU8u6UgQeLpGZlsQ_GOxv3kx7';
const NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const IMAGE_NS = 'http://www.google.com/schemas/sitemap-image/1.1';
const TYPES = [
  'sitemap-root', 'sitemap-edukasi', 'sitemap-jual-beli', 'sitemap-layanan-sim',
  'sitemap-layanan-dukcapil', 'sitemap-layanan-imigrasi', 'sitemap-layanan-kendaraan',
  'sitemap-layanan-paspor', 'sitemap-layanan-skck', 'sitemap-tips', 'sitemap-layanan'
];
const STATIC_DATA_PATH = path.join(process.cwd(), 'api', 'sitemap-static-data.json');

function xmlEscape(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function safeLastmod(value) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}
function readStaticData() {
  try { return JSON.parse(fs.readFileSync(STATIC_DATA_PATH, 'utf8')); }
  catch (_) { return {}; }
}

// CMS-managed routes must come only from live, published CMS records.
// This prevents an old URL accidentally left in static-data.json from
// reappearing after its CMS record is drafted or moved to Trash.
function isCmsManagedUrl(value) {
  try {
    const url = new URL(String(value || ''));

    if (
      url.protocol !== 'https:' ||
      !['rizchbali.com', 'www.rizchbali.com'].includes(url.hostname.toLowerCase())
    ) {
      return false;
    }

    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    // This is a valid static educational article that must remain in the sitemap.
    const staticAllowlist = new Set([
      '/artikel/edukasi/sim/cara-perpanjang-sim-di-bali'
    ]);

    if (staticAllowlist.has(pathname)) return false;

    // CMS-managed URLs should only be added from active, published CMS records.
    // Remove stale CMS URLs accidentally left in the static sitemap data.
    return /^\/halaman\/[^/]+$/.test(pathname)
      || /^\/layanan-konten\/[^/]+$/.test(pathname)
      || /^\/artikel\/konten\/[^/]+$/.test(pathname)
      || /^\/jual-beli\/[^/]+$/.test(pathname)
      || /^\/artikel\/edukasi\/(kendaraan|dukcapil|imigrasi|sim|skck|paspor)\/[^/]+$/.test(pathname)
      || /^\/artikel\/tips\/[^/]+$/.test(pathname);
  } catch (_) {
    return false;
  }
}

function sanitizeStaticData(data) {
  const clean = {};
  for (const [name, items] of Object.entries(data || {})) {
    if (!Array.isArray(items)) continue;
    clean[name] = items.filter(item => item && item.url && !isCmsManagedUrl(item.url));
  }
  return clean;
}
function serviceGroup(record) {
  const haystack = [record.category, record.title, record.public_url, record.slug].join(' ').toLowerCase();
  if (/\bsim\b|surat izin mengemudi/.test(haystack)) return 'sitemap-layanan-sim';
  if (/\bskck\b|catatan kepolisian/.test(haystack)) return 'sitemap-layanan-skck';
  if (/dukcapil|kependudukan|akta kelahiran|kartu keluarga|ktp/.test(haystack)) return 'sitemap-layanan-dukcapil';
  if (/imigrasi|kitas|kitap|izin tinggal/.test(haystack)) return 'sitemap-layanan-imigrasi';
  if (/paspor|passport/.test(haystack)) return 'sitemap-layanan-paspor';
  if (/kendaraan|stnk|bpkb|mutasi|balik nama/.test(haystack)) return 'sitemap-layanan-kendaraan';
  return 'sitemap-layanan';
}
function cmsGroup(record) {
  if (record.content_type === 'root') return 'sitemap-root';
  if (record.content_type === 'article') return 'sitemap-edukasi';
  if (record.content_type === 'jual_beli') return 'sitemap-jual-beli';
  if (record.content_type === 'service') return serviceGroup(record);
  return null;
}
function canonicalUrl(record) {
  const raw = String(record.canonical_url || '').trim();
  const publicUrl = String(record.public_url || '').trim();
  const candidate = raw || (publicUrl.startsWith('http') ? publicUrl : BASE_URL + '/' + publicUrl.replace(/^\/+/, ''));
  let u;
  try { u = new URL(candidate); } catch (_) { return null; }
  if (u.protocol !== 'https:' || u.hostname.toLowerCase() !== 'rizchbali.com' || u.username || u.password) return null;
  if (u.search || u.hash) return null;
  return u.toString();
}
async function fetchCms() {
  const query = new URLSearchParams({
    select: 'content_type,title,slug,category,public_url,updated_at,published_at,image_url,canonical_url,meta_robots,status,deleted_at',
    status: 'eq.published',
    deleted_at: 'is.null',
    order: 'updated_at.desc',
    limit: '5000'
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/cms_content?${query.toString()}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
function toUrlItem(record) {
  if (record.status !== 'published' || record.deleted_at) return null;
  if (/noindex/i.test(String(record.meta_robots || ''))) return null;
  const url = canonicalUrl(record);
  const group = cmsGroup(record);
  if (!url || !group) return null;
  const image = String(record.image_url || '').trim();
  return { url, lastmod: safeLastmod(record.updated_at || record.published_at),
    changefreq: 'weekly', priority: record.content_type === 'root' ? '0.8' : '0.7',
    images: /^https:\/\//i.test(image) ? [image] : [], source: 'cms' };
}
function dedupe(items) {
  const map = new Map();
  for (const item of items) {
    if (!item || !item.url) continue;
    const previous = map.get(item.url);
    if (!previous || item.source === 'cms') map.set(item.url, item);
  }
  return Array.from(map.values()).sort((a, b) => a.url.localeCompare(b.url));
}
function renderUrlset(items) {
  const out = [`<?xml version="1.0" encoding="UTF-8"?>`, `<urlset xmlns="${NS}" xmlns:image="${IMAGE_NS}">`];
  for (const item of dedupe(items)) {
    out.push('  <url>', `    <loc>${xmlEscape(item.url)}</loc>`, `    <lastmod>${xmlEscape(safeLastmod(item.lastmod))}</lastmod>`,
      `    <changefreq>${xmlEscape(item.changefreq || 'weekly')}</changefreq>`, `    <priority>${xmlEscape(item.priority || '0.7')}</priority>`);
    for (const image of (item.images || [])) if (/^https:\/\//i.test(image)) out.push('    <image:image>', `      <image:loc>${xmlEscape(image)}</image:loc>`, '    </image:image>');
    out.push('  </url>');
  }
  out.push('</urlset>');
  return out.join('\n');
}
function renderIndex(staticData, activeTypes) {
  const now = new Date().toISOString();
  const out = [`<?xml version="1.0" encoding="UTF-8"?>`, `<sitemapindex xmlns="${NS}">`];
  const always = ['sitemap-root', 'sitemap-edukasi', 'sitemap-jual-beli', 'sitemap-layanan-sim'];
  // Include existing sitemap categories with static URLs, plus categories with published CMS content.
  const populatedStatic = Object.keys(staticData || {}).filter(name => TYPES.includes(name) && Array.isArray(staticData[name]) && staticData[name].length);
  const names = [...new Set([...always, ...populatedStatic, ...(activeTypes || [])])]
    .filter(name => TYPES.includes(name))
    .sort((a, b) => {
      const ai = always.indexOf(a), bi = always.indexOf(b);
      if (ai !== -1 || bi !== -1) {
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
      return a.localeCompare(b);
    });
  for (const name of names) {
    out.push('  <sitemap>', `    <loc>${BASE_URL}/${name}.xml</loc>`, `    <lastmod>${now}</lastmod>`, '  </sitemap>');
  }
  out.push('</sitemapindex>');
  return out.join('\n');
}
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const type = String((req.query && req.query.type) || 'index').replace(/\.xml$/i, '');
  const staticData = sanitizeStaticData(readStaticData());
  if (type === 'index' || type === 'sitemap') {
    let activeTypes = [];
    try {
      const records = await fetchCms();
      activeTypes = records.filter(record => record.status === 'published' && !record.deleted_at && !/noindex/i.test(String(record.meta_robots || '')))
        .map(cmsGroup).filter(Boolean);
    } catch (_) { /* Existing static sitemap categories remain available during a CMS outage. */ }
    res.status(200).send(renderIndex(staticData, activeTypes));
    return;
  }
  if (!TYPES.includes(type)) {
    res.status(404).send('<?xml version="1.0" encoding="UTF-8"?><error>Not found</error>');
    return;
  }
  const items = Array.isArray(staticData[type]) ? [...staticData[type]] : [];
  try {
    const records = await fetchCms();
    for (const record of records) {
      const item = toUrlItem(record);
      if (item && cmsGroup(record) === type) items.push(item);
    }
  } catch (_) {
    res.setHeader('X-Rizch-Sitemap-Status', 'static-fallback');
  }
  res.status(200).send(renderUrlset(items));
};
