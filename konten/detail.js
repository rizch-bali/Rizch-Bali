(async()=>{const root=document.getElementById('content');const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const cfg=window.RIZCH_SUPABASE_CONFIG||{};if(!window.supabase||!cfg.url||cfg.url.includes('PROJECT-ID')||!cfg.anonKey||cfg.anonKey.includes('ISI_DENGAN')){root.innerHTML='<p class="state">Konten CMS belum dikonfigurasi. Silakan lengkapi pengaturan Supabase terlebih dahulu.</p>';return}const slug=new URLSearchParams(location.search).get('slug')||location.pathname.split('/').filter(Boolean).pop();const requestedType=new URLSearchParams(location.search).get('type');const pathType=location.pathname.startsWith('/jual-beli/')?'jual_beli':location.pathname.startsWith('/artikel/konten/')?'article':location.pathname.startsWith('/layanan-konten/')?'service':null;const routeType=['root','article','service','jual_beli'].includes(requestedType)?requestedType:pathType;const client=window.supabase.createClient(cfg.url,cfg.anonKey);let contentQuery=client.from('cms_content').select('*').eq('slug',slug).eq('status','published');if(routeType)contentQuery=contentQuery.eq('content_type',routeType);let {data,error}=await contentQuery.maybeSingle();if(!data){let redirectQuery=client.from('cms_slug_redirects').select('new_slug,content_type').eq('old_slug',slug);if(routeType)redirectQuery=redirectQuery.eq('content_type',routeType);const redirect=await redirectQuery.maybeSingle();if(redirect.data?.new_slug){const target={root:'/halaman/',service:'/layanan-konten/',article:'/artikel/konten/',jual_beli:'/jual-beli/'}[redirect.data.content_type]||'/konten/';location.replace(target+encodeURIComponent(redirect.data.new_slug));return;}}if(error||!data){root.innerHTML='<p class="state">Konten tidak ditemukan atau belum dipublikasikan.</p>';return}const {data:globalRow}=await client.from('cms_settings').select('setting_value').eq('setting_key','global').maybeSingle();const global=globalRow?.setting_value||{};const setMeta=(selector,key,value)=>{if(!value)return;let el=document.head.querySelector(selector);if(!el){el=document.createElement('meta');const m=selector.match(/\[(name|property)=\"([^\"]+)\"\]/);if(m)el.setAttribute(m[1],m[2]);document.head.appendChild(el);}el.content=value;};const siteUrl=(global.siteUrl||location.origin||'').replace(/\/$/,'');const publicPath=data.content_type==='jual_beli'?`/jual-beli/${encodeURIComponent(data.slug)}/`:(data.public_url||location.pathname);const canonical=data.canonical_url||siteUrl+publicPath;document.title=(data.seo_title||data.title||global.seoTitle||'Konten')+' | '+(global.siteName||'Rizch Bali');setMeta('meta[name=\"description\"]','name',data.seo_description||data.excerpt||global.seoDescription);setMeta('meta[name=\"keywords\"]','name',data.seo_keywords);setMeta('meta[name=\"robots\"]','name',data.meta_robots||global.robots||'index, follow');let canonicalEl=document.head.querySelector('link[rel=\"canonical\"]');if(!canonicalEl){canonicalEl=document.createElement('link');canonicalEl.rel='canonical';document.head.appendChild(canonicalEl);}canonicalEl.href=canonical;if(data.status!=='published')canonicalEl.remove();const ogTitle=data.og_title||data.seo_title||data.title||global.seoTitle,ogDesc=data.og_description||data.seo_description||data.excerpt||global.seoDescription,ogImage=data.og_image||data.image_url||global.ogImage;setMeta('meta[property=\"og:title\"]','property',ogTitle);setMeta('meta[property=\"og:description\"]','property',ogDesc);setMeta('meta[property=\"og:image\"]','property',ogImage);setMeta('meta[property=\"og:type\"]','property',data.og_type||(data.content_type==='article'?'article':data.content_type==='jual_beli'?'product':'website'));setMeta('meta[property=\"og:url\"]','property',canonical);setMeta('meta[name=\"twitter:card\"]','name',data.twitter_card||(ogImage?'summary_large_image':'summary'));setMeta('meta[name=\"twitter:title\"]','name',data.twitter_title||ogTitle);setMeta('meta[name=\"twitter:description\"]','name',data.twitter_description||ogDesc);setMeta('meta[name=\"twitter:image\"]','name',data.twitter_image||ogImage);const schemaPrice=Number(data.price);const hasValidProductPrice=data.content_type==='jual_beli'&&data.price!==null&&data.price!==undefined&&data.price!==''&&Number.isFinite(schemaPrice)&&schemaPrice>0;const schema={ '@context':'https://schema.org','@type':data.content_type==='article'?'Article':data.content_type==='jual_beli'?(hasValidProductPrice?'Product':'WebPage'):data.content_type==='service'?'Service':'WebPage','name':data.title,'description':data.seo_description||data.excerpt||global.seoDescription,'url':canonical,'publisher':{'@type':'Organization','name':global.siteName||'Rizch Bali','logo':global.logoUrl?{'@type':'ImageObject','url':global.logoUrl}:undefined},'image':ogImage||undefined,'datePublished':data.published_at||undefined,...(hasValidProductPrice?{'offers':{'@type':'Offer','price':String(schemaPrice),'priceCurrency':'IDR','url':canonical}}:{})};const ld=document.createElement('script');ld.type='application/ld+json';ld.textContent=JSON.stringify(schema);document.head.appendChild(ld);const parser=new DOMParser();const doc=parser.parseFromString(`<div>${data.body_html||''}</div>`,'text/html');doc.querySelectorAll('script,style,iframe,object,embed,form,svg,math').forEach(n=>n.remove());doc.querySelectorAll('*').forEach(el=>[...el.attributes].forEach(a=>{if(a.name.toLowerCase().startsWith('on')||['srcdoc','formaction'].includes(a.name.toLowerCase()))el.removeAttribute(a.name);if(['href','src'].includes(a.name.toLowerCase())&&/^\s*javascript:/i.test(a.value))el.removeAttribute(a.name)}));const bodyRoot=doc.body.firstElementChild;
bodyRoot?.querySelectorAll('img').forEach((img,index)=>{
  if(img.hasAttribute('alt')&&img.getAttribute('alt').trim())return;
  const figure=img.closest('figure');
  const caption=figure?.querySelector('figcaption')?.textContent?.replace(/\s+/g,' ').trim();
  let heading='';let prev=img.previousElementSibling;
  while(prev&&!heading){if(/^H[1-6]$/.test(prev.tagName))heading=prev.textContent.replace(/\s+/g,' ').trim();prev=prev.previousElementSibling;}
  const context=caption||img.getAttribute('title')?.trim()||heading;
  const alt=context?`${context} — ${data.title}`:`Ilustrasi ${data.title}`;
  img.setAttribute('alt',alt.slice(0,180));
});

const content = bodyRoot?.innerHTML || '';

/* Breadcrumb */
const breadcrumbParent = document.getElementById('breadcrumbParent');
const breadcrumbTitle = document.getElementById('breadcrumbTitle');

if (breadcrumbParent && breadcrumbTitle) {
    if (data.content_type === 'jual_beli') {
        breadcrumbParent.href = '/jual-beli/';
        breadcrumbParent.textContent = 'Jual Beli';
    } else if (data.content_type === 'service') {
        breadcrumbParent.href = '/#layanan';
        breadcrumbParent.textContent = 'Layanan';
    } else {
        breadcrumbParent.href = '/artikel/';
        breadcrumbParent.textContent = 'Artikel';
    }

    breadcrumbTitle.textContent = data.title || '';
}

/* Harga hanya untuk jual_beli */
const isJualBeli = data.content_type === 'jual_beli';

const price = Number(data.price);
const priceHtml =
    isJualBeli && data.price !== null && data.price !== undefined &&
    data.price !== '' && Number.isFinite(price) && price >= 0
        ? `<p class="jb-price">Rp ${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>`
        : '';

/* Informasi jual beli hanya untuk jual_beli */
const jbInfoHtml = isJualBeli ? (data.jb_info_html || '') : '';

const jbInfoDoc = parser.parseFromString(
    `<div>${jbInfoHtml}</div>`,
    'text/html'
);

/* Sanitasi jb_info_html, sama seperti body artikel */
jbInfoDoc.querySelectorAll(
    'script,style,iframe,object,embed,form,svg,math'
).forEach(n => n.remove());

jbInfoDoc.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(a => {
        const name = a.name.toLowerCase();

        if (
            name.startsWith('on') ||
            ['srcdoc', 'formaction'].includes(name)
        ) {
            el.removeAttribute(a.name);
        }

        if (
            ['href', 'src'].includes(name) &&
            /^\s*javascript:/i.test(a.value)
        ) {
            el.removeAttribute(a.name);
        }
    });
});

const jbInfoContent =
    jbInfoDoc.body.firstElementChild?.innerHTML || '';

/* Section jual beli tidak muncul pada artikel atau layanan */
const jualBeliSection = isJualBeli
    ? `
        <section class="jb-section" aria-labelledby="jb-heading">
            <h2 id="jb-heading">Informasi Jual Beli</h2>
            ${priceHtml}
            ${jbInfoContent
                ? `<div class="jb-info">${jbInfoContent}</div>`
                : ''}
        </section>
      `
    : '';

/* CTA dan FAQ hanya diambil dari data konten ini, tidak lagi dari pengaturan bersama. */
const cta = data.cta_json && typeof data.cta_json === 'object' ? data.cta_json : {};
const ctaLink = String(cta.buttonLink || '').trim();
const ctaLinkSafe = /^(https?:\/\/|mailto:|tel:)/i.test(ctaLink);
const ctaHtml = cta.enabled === true && cta.title && cta.text && cta.buttonText && ctaLinkSafe
    ? `
      <section class="detail-cta" aria-labelledby="detail-cta-title">
        <div class="detail-cta-copy">
          <h2 id="detail-cta-title">${esc(cta.title)}</h2>
          <p>${esc(cta.text)}</p>
        </div>
        <a class="detail-cta-button" href="${esc(ctaLink)}" target="_blank" rel="noopener noreferrer">${esc(cta.buttonText)}</a>
      </section>`
    : '';
const activeFaq = Array.isArray(data.faq_json)
    ? data.faq_json.filter(f => f && f.enabled !== false && String(f.question || '').trim() && String(f.answer || '').trim())
    : [];
const faqHtml = activeFaq.length
    ? `
      <section class="detail-faq" aria-labelledby="detail-faq-title">
        <h2 id="detail-faq-title">Pertanyaan yang Sering Diajukan</h2>
        <div class="detail-faq-list">
          ${activeFaq.map((f, i) => `<details class="detail-faq-item"${i === 0 ? ' open' : ''}><summary>${esc(f.question)}</summary><div class="detail-faq-answer"><p>${esc(f.answer)}</p></div></details>`).join('')}
        </div>
      </section>`
    : '';

/* Render halaman detail */
root.innerHTML = `
    <div class="meta">
        ${esc(data.category || '')}
        ${data.region ? ` · ${esc(data.region)}` : ''}
        ${data.published_at
            ? ` · ${new Date(data.published_at).toLocaleDateString('id-ID')}`
            : ''}
    </div>

    <h1>${esc(data.title || '')}</h1>

    ${data.image_url
        ? `
            <img
                class="hero"
                src="${esc(data.image_url)}"
                alt="${esc(data.title || '')}"
                loading="eager"
            >
          `
        : ''}

    ${data.excerpt
        ? `<p class="excerpt">${esc(data.excerpt)}</p>`
        : ''}

    ${isJualBeli ? `${jualBeliSection}<div class="body-copy">${content}</div>${ctaHtml}${faqHtml}` : `<div class="body-copy">${content}</div>${faqHtml}${ctaHtml}`}
`;

/* Navbar mobile */
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');

if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
        const isOpen = navMenu.classList.toggle('active');

        hamburger.setAttribute('aria-expanded', String(isOpen));
        hamburger.setAttribute(
            'aria-label',
            isOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'
        );
    });
}
})();