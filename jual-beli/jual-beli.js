(async()=>{
  const grid=document.getElementById('listingsGrid');
  const noResults=document.getElementById('noResults');
  const searchInput=document.getElementById('searchInput');
  const searchButton=document.getElementById('searchButton');
  const statusFilter=document.getElementById('listingStatusFilter');
  const clearButton=document.getElementById('clearListingFilters');
  if(!grid||!noResults||!searchInput)return;

  let items=[];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=s=>String(s??'').toLocaleLowerCase('id').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const formatPrice=value=>{
    const raw=String(value??'').trim(); if(!raw)return '';
    const withoutRp=raw.replace(/^rp\.?\s*/i,'').trim();
    if(/^\d[\d,\.\s]*$/.test(withoutRp)){const digits=withoutRp.replace(/\D/g,'');if(digits)return `Rp ${Number(digits).toLocaleString('en-US')}`;}
    return raw;
  };
  const setMessage=message=>{noResults.innerHTML=`<i class="fas fa-info-circle" style="font-size:2rem;margin-bottom:12px;color:var(--gray)"></i><h3>${esc(message)}</h3>`;noResults.classList.add('show');};
  const waLink=item=>{
    const cta=item.cta_json&&typeof item.cta_json==='object'?item.cta_json:{};
    const ctaRaw=String(cta.buttonLink||'').trim();
    const ctaMatch=ctaRaw.match(/^(?:https?:\/\/(?:www\.)?)?(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)?([+\d\s().-]+)(?:[?&#].*)?$/i);
    let phone=''; if(ctaMatch)phone=ctaMatch[1].replace(/\D/g,'');
    if(!phone&&/^(?:https?:\/\/)?(?:www\.)?wa\.me\//i.test(ctaRaw))phone=ctaRaw.replace(/^https?:\/\/(?:www\.)?wa\.me\//i,'').split(/[?&#]/)[0].replace(/\D/g,'');
    if(!phone)phone='62895429358977';
    const message=`Halo RizchBali, saya tertarik dengan listing ${item.title||'Jual Beli'}${item.price?` dengan harga ${formatPrice(item.price).replace(/^Rp\s*/i,'')}`:''}. Mohon informasi lebih lanjut.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };
  function render(){
    const q=normalize(searchInput.value);
    const terms=q.split(/\s+/).filter(Boolean);
    const status=statusFilter?.value||'all';
    const rows=items.filter(item=>{
      const searchable=normalize([item.title,item.excerpt,item.category,item.region,item.price,item.jb_info_html,item.slug].join(' '));
      const keywordMatch=terms.every(term=>searchable.includes(term));
      const itemStatus=item.listing_status==='terjual'?'terjual':'tersedia';
      return keywordMatch&&(status==='all'||itemStatus===status);
    });
    grid.innerHTML='';
    if(!rows.length){setMessage(items.length?'Tidak ada listing yang cocok. Coba kata kunci atau status lain.':'Belum ada penawaran Jual Beli yang diterbitkan.');return;}
    noResults.classList.remove('show');
    grid.innerHTML=rows.map(item=>{
      const slug=String(item.slug||'').replace(/^\/+|\/+$/g,'');
      const href=slug?`/jual-beli/${encodeURIComponent(slug)}/`:'/jual-beli/';
      const title=esc(item.title||'Penawaran Jual Beli');
      const image=item.image_url?`<img src="${esc(item.image_url)}" alt="${title}" class="listing-image" loading="lazy" onerror="this.style.display='none'">`:`<div class="listing-img-placeholder"><i class="fas fa-tag"></i></div>`;
      const category=esc(item.category||'Jual Beli');
      const region=item.region?`<span><i class="fas fa-map-marker-alt"></i> ${esc(item.region)}</span>`:'';
      const price=item.price?`<div class="listing-price">${esc(formatPrice(item.price))}</div>`:'';
      const excerpt=esc(item.excerpt||'Lihat informasi lengkap penawaran ini.');
      const sold=item.listing_status==='terjual';
      const statusBadge=`<span class="listing-status ${sold?'sold':'available'}">${sold?'Terjual':'Tersedia'}</span>`;
      return `<article class="listing-card" data-title="${esc(normalize(`${item.title||''} ${item.category||''} ${item.region||''}`))}">
        <a class="listing-image-link" href="${esc(href)}" aria-label="Lihat ${title}">${image}</a>
        <div class="listing-content">${statusBadge}
          <span class="listing-label">${category}${item.region?` · ${esc(item.region)}`:''}</span>
          ${price}<h2><a href="${esc(href)}" style="color:inherit;text-decoration:none">${title}</a></h2>
          <div class="listing-meta">${region}</div><p>${excerpt}</p>
          <a href="${esc(href)}" class="btn-read-more">Baca Selengkapnya <i class="fas fa-arrow-right"></i></a>
          <a href="${esc(waLink(item))}" class="btn-contact" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> Tanya via WhatsApp</a>
        </div></article>`;
    }).join('');
  }
  searchInput.addEventListener('input',render);
  searchButton?.addEventListener('click',render);
  statusFilter?.addEventListener('change',render);
  clearButton?.addEventListener('click',()=>{searchInput.value='';if(statusFilter)statusFilter.value='all';render();searchInput.focus();});
  searchInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();render();}});

  const cfg=window.RIZCH_SUPABASE_CONFIG||{};
  if(!window.supabase||!cfg.url||cfg.url.includes('PROJECT-ID')||!cfg.anonKey||cfg.anonKey.includes('ISI_DENGAN')){setMessage('Daftar Jual Beli belum dapat dimuat karena konfigurasi Supabase belum tersedia.');return;}
  try{
    const client=window.supabase.createClient(cfg.url,cfg.anonKey);
    const {data,error}=await client.from('cms_content')
      .select('title,slug,category,region,excerpt,image_url,price,listing_status,jb_info_html,cta_json,public_url,published_at,created_at')
      .eq('content_type','jual_beli').eq('status','published').is('deleted_at',null)
      .order('published_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false});
    if(error){console.error('Gagal memuat Jual Beli:',error.message);setMessage('Daftar Jual Beli belum dapat dimuat. Pastikan pembaruan kolom status iklan sudah diterapkan di Supabase.');return;}
    items=(data||[]).map(item=>({...item,listing_status:item.listing_status==='terjual'?'terjual':'tersedia'}));
    render();
  }catch(error){console.error('Gagal memuat Jual Beli:',error);setMessage('Terjadi kendala saat memuat daftar Jual Beli. Periksa koneksi dan konfigurasi Supabase.');}
})();
