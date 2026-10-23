(() => {
  const cfg = window.RIZCH_SUPABASE_CONFIG || {};
  const configured = cfg.url && cfg.anonKey && !cfg.url.includes('PROJECT-ID') && !cfg.anonKey.includes('ISI_DENGAN');
  const $ = id => document.getElementById(id);
  let supabase = null, session = null, records = [], currentImage = '', editing = null, categories = [], globalSettings = {};
  const labels = {root:'Halaman Root',service:'Layanan',article:'Edukasi/Artikel',jual_beli:'Jual Beli'};
  let contentFaqDraft = [];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slugify = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90);
  const plannedUrl = (type, slug) => ({root:`/halaman/${slug}`,service:`/layanan-konten/${slug}`,article:`/artikel/konten/${slug}`,jual_beli:`/jual-beli/${slug}/`}[type] || `/konten/${slug}`);
  const setMsg = (id,msg,ok=false) => { $(id).textContent=msg; $(id).style.color=ok?'#13744e':'#b42318'; };
  const show = (id, yes=true) => $(id).classList.toggle('hidden',!yes);
  function configuredState(){
    $('setupNotice').classList.toggle('hidden',configured);
    $('connectionLabel').textContent=configured?'Supabase siap':'Belum dikonfigurasi';
    $('connectionLabel').previousElementSibling.style.background=configured?'#37c991':'#f0a04b';
    if(configured && window.supabase) supabase=window.supabase.createClient(cfg.url,cfg.anonKey);
    else { show('loginPanel',false); show('workspace',false); }
  }
  function formatPriceInput(value){
    const raw=String(value??'').trim();
    if(!raw)return '';
    if(!/^\d[\d,\s]*$/.test(raw))return raw;
    const digits=raw.replace(/[^\d]/g,'');
    return digits ? Number(digits).toLocaleString('en-US',{maximumFractionDigits:0}) : '';
  }
  function normalizePriceForSave(value){
    const raw=String(value??'').trim();
    if(/^\d[\d,\s]*$/.test(raw))return raw.replace(/[^\d]/g,'');
    return raw;
  }
  function routeEditor(type='root', item=null){
    editing=item; $('contentForm').reset(); delete $('slug').dataset.edited; $('contentId').value=item?.id||''; currentImage=item?.image_url||'';
    $('contentType').value=item?.content_type||type; $('title').value=item?.title||''; $('slug').value=item?.slug||'';
    $('category').value=item?.category||''; $('region').value=item?.region||''; $('excerpt').value=item?.excerpt||''; $('bodyHtml').value=item?.body_html||'';
    if($('jbPrice'))$('jbPrice').value=formatPriceInput(item?.price||'');
    if($('listingStatus'))$('listingStatus').value=item?.listing_status||'tersedia';
    if($('jbInfoHtml'))$('jbInfoHtml').value=item?.jb_info_html||'';
    updateJbFields();
    loadContentCtaData(item?.cta_json||{});
    loadContentFaqData(item?.faq_json||[]);
    $('imageUrl').value=currentImage; $('seoTitle').value=item?.seo_title||''; $('seoDescription').value=item?.seo_description||''; $('seoKeywords').value=item?.seo_keywords||''; $('seoRobots').value=item?.meta_robots||''; $('canonicalUrl').value=item?.canonical_url||''; $('ogTitle').value=item?.og_title||''; $('ogDescription').value=item?.og_description||''; $('ogImage').value=item?.og_image||''; $('ogType').value=item?.og_type||''; $('twitterCard').value=item?.twitter_card||''; $('twitterTitle').value=item?.twitter_title||''; $('twitterDescription').value=item?.twitter_description||''; $('twitterImage').value=item?.twitter_image||''; $('status').value=item?.status||'draft'; $('imageFile').value=''; populateCategoryOptions($('contentType').value,item?.category||''); initSeoFieldState(item); refreshSeoAutofill();
    $('imagePreview').src=currentImage; show('imagePreviewWrap',!!currentImage); updateUrl();
    show('contentView',false); show('settingsView',false); show('categoriesView',false); show('editorView',true); $('pageTitle').textContent=item?'Edit Konten':'Buat Konten'; document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view==='new'));
    $('editorMessage').textContent=''; window.scrollTo(0,0);
  }
  function formatContentSelection(tag){
    const field=$('bodyHtml'); if(!field)return;
    const start=field.selectionStart??field.value.length, end=field.selectionEnd??field.value.length;
    const selected=field.value.slice(start,end);
    let before='',after='',insert='';
    if(tag==='h2'||tag==='h3'||tag==='p'){
      if(selected.trim()) { before=`<${tag}>`; after=`</${tag}>`; insert=selected; }
      else { const label=tag==='h2'?'Judul Bagian':tag==='h3'?'Subbagian':'Tulis paragraf di sini.'; insert=`<${tag}>${label}</${tag}>`; }
    } else if(tag==='ul') {
      if(selected.trim()) { const items=selected.split(/\n+/).map(x=>x.trim()).filter(Boolean); insert='<ul>\n'+items.map(x=>`  <li>${x}</li>`).join('\n')+'\n</ul>'; }
      else insert='<ul>\n  <li>Item daftar</li>\n  <li>Item daftar lainnya</li>\n</ul>';
    }
    const replacement=before+insert+after;
    field.setRangeText(replacement,start,end,'select'); field.focus();
    field.dispatchEvent(new Event('input',{bubbles:true}));
  }
  document.querySelectorAll('[data-content-format]').forEach(button=>button.addEventListener('click',()=>formatContentSelection(button.dataset.contentFormat)));
  function updateUrl(){ $('plannedUrl').textContent=plannedUrl($('contentType').value,slugify($('slug').value||$('title').value)||'judul-konten'); }

  function updateJbFields(){
  const isJb=$('contentType').value==='jual_beli';
  show('jbFields',isJb);
  }

  const seoFieldIds = ['seoTitle','seoDescription','seoRobots','canonicalUrl','ogType','ogTitle','ogDescription','ogImage','twitterCard','twitterTitle','twitterDescription','twitterImage'];
  function initSeoFieldState(item){
    seoFieldIds.forEach(id=>{
      const el=$(id); if(!el)return;
      el.dataset.autoValue='';
      el.dataset.manual=(String(el.value||'').trim()?'1':'0');
    });
  }
  function setAutoValue(id,value){
    const el=$(id); if(!el)return;
    const next=String(value||'');
    const previous=el.dataset.autoValue||'';
    if(el.dataset.manual!=='1' || !String(el.value||'').trim() || el.value===previous){
      el.value=next;
      el.dataset.autoValue=next;
    }
  }
  function cleanText(value){
    const node=document.createElement('div');
    node.innerHTML=String(value||'');
    return (node.textContent||node.innerText||'').replace(/\s+/g,' ').trim();
  }
  function seoDescriptionSource(){
    const excerpt=$('excerpt')?.value?.trim();
    const body=cleanText($('bodyHtml')?.value||'');
    return (excerpt||body).replace(/\s+/g,' ').trim().slice(0,160);
  }
  function seoBaseUrl(){
    return String(globalSettings.siteUrl||'').trim().replace(/\/+$/,'');
  }
  function updateGoogleSeoPreview(){
    const titleInput=$('seoTitle');
    const descInput=$('seoDescription');
    const contentTitle=String($('title')?.value||'').trim();
    const seoTitle=String(titleInput?.value||'').trim() || contentTitle || 'Judul halaman akan muncul di sini';
    const description=String(descInput?.value||'').trim() || seoDescriptionSource() || 'Deskripsi halaman akan muncul di sini.';
    const type=$('contentType')?.value||'root';
    const slug=slugify($('slug')?.value||contentTitle);
    const path=slug?plannedUrl(type,slug):'/';
    const base=seoBaseUrl();
    const canonical=String($('canonicalUrl')?.value||'').trim();
    const url=canonical || (base ? `${base}${path.startsWith('/')?'':'/'}${path}` : path);
    const site=base ? base.replace(/^https?:\/\//i,'').replace(/\/$/,'') : String(globalSettings.siteName||'Rizch Bali');
    const siteEl=$('seoPreviewSite'), urlEl=$('seoPreviewUrl'), titleEl=$('seoPreviewTitle'), descEl=$('seoPreviewDescription');
    if(siteEl)siteEl.textContent=site;
    if(urlEl)urlEl.textContent=url;
    if(titleEl)titleEl.textContent=seoTitle;
    if(descEl)descEl.textContent=description;
  }

  function refreshSeoAutofill(){
    if(!$('title'))return;
    const title=$('title').value.trim();
    const type=$('contentType').value;
    const slug=slugify($('slug').value||title);
    const brand=String(globalSettings.siteName||'Rizch Bali').trim();
    const seoTitle=title ? (brand && !title.toLowerCase().includes(brand.toLowerCase()) ? `${title} | ${brand}` : title).slice(0,160) : '';
    const description=seoDescriptionSource();
    const image=String($('imageUrl').value||currentImage||'').trim();
    const base=seoBaseUrl();
    const path=slug?plannedUrl(type,slug):'';
    const canonical=base&&path?`${base}${path.startsWith('/')?'':'/'}${path}`:'';
    const ogType=type==='article'?'article':type==='jual_beli'?'product':'website';
    setAutoValue('seoTitle',seoTitle);
    setAutoValue('seoDescription',description);
    setAutoValue('seoRobots',globalSettings.robots||'index, follow');
    setAutoValue('canonicalUrl',canonical);
    setAutoValue('ogType',ogType);
    setAutoValue('ogTitle',$('seoTitle').value||seoTitle);
    setAutoValue('ogDescription',$('seoDescription').value||description);
    setAutoValue('ogImage',image||String(globalSettings.ogImage||'').trim());
    const socialImage=$('ogImage').value||image||String(globalSettings.ogImage||'').trim();
    setAutoValue('twitterCard',socialImage?'summary_large_image':'summary');
    setAutoValue('twitterTitle',$('seoTitle').value||seoTitle);
    setAutoValue('twitterDescription',$('seoDescription').value||description);
    setAutoValue('twitterImage',socialImage);
    updateGoogleSeoPreview();
  }
  function bindSeoAutofill(id){
    const el=$(id); if(!el)return;
    el.addEventListener('input',()=>{
      const autoValue=el.dataset.autoValue||'';
      if(!el.value.trim()){el.dataset.manual='0';refreshSeoAutofill();return;}
      el.dataset.manual=el.value===autoValue?'0':'1';
      refreshSeoAutofill();
    });
    el.addEventListener('change',()=>{
      const autoValue=el.dataset.autoValue||'';
      el.dataset.manual=(!el.value.trim()||el.value===autoValue)?'0':'1';
      refreshSeoAutofill();
    });
  }

  // ALT otomatis untuk gambar dalam isi konten. ALT manual yang sudah ada tetap dipertahankan.
  function addAutomaticImageAlt(html, title, excerpt){
    const parser=new DOMParser();
    const doc=parser.parseFromString(`<div id="alt-root">${html||''}</div>`,'text/html');
    const root=doc.getElementById('alt-root');
    if(!root)return html||'';
    root.querySelectorAll('img').forEach((img,index)=>{
      if(img.hasAttribute('alt') && img.getAttribute('alt').trim())return;
      const figure=img.closest('figure');
      const caption=figure?.querySelector('figcaption')?.textContent?.replace(/\s+/g,' ').trim();
      let heading='';
      let prev=img.previousElementSibling;
      while(prev && !heading){
        if(/^H[1-6]$/.test(prev.tagName)) heading=prev.textContent.replace(/\s+/g,' ').trim();
        prev=prev.previousElementSibling;
      }
      const nearby=caption || img.getAttribute('title')?.trim() || heading;
      const base=nearby || excerpt || title || 'Gambar';
      const alt=nearby ? `${base} — ${title||'Rizch Bali'}` : (title ? `Ilustrasi ${title}` : base);
      img.setAttribute('alt',alt.slice(0,180));
    });
    return root.innerHTML;
  }

  function addContentFaqField(question='', answer='', enabled=true){
    contentFaqDraft=collectContentFaqFields();
    contentFaqDraft.push({question:String(question||''),answer:String(answer||''),enabled:enabled!==false});
    renderContentFaqFields();
    const fields=$('contentFaqContainer').querySelectorAll('[data-faq-question]');
    fields[fields.length-1]?.focus();
  }
  function loadContentFaqData(faqArray){
    contentFaqDraft=Array.isArray(faqArray)?faqArray.map(f=>({question:String(f?.question||''),answer:String(f?.answer||''),enabled:f?.enabled!==false})):[];
    renderContentFaqFields();
  }
  function collectContentFaqFields(){
    const host=$('contentFaqContainer');
    if(!host)return [];
    return [...host.querySelectorAll('.faq-row')].map(row=>({
      question:row.querySelector('[data-faq-question]').value.trim(),
      answer:row.querySelector('[data-faq-answer]').value.trim(),
      enabled:row.querySelector('[data-faq-enabled]').checked
    }));
  }
  function loadContentCtaData(cta){
    const value=cta&&typeof cta==='object'?cta:{};
    $('contentCtaTitle').value=value.title||'';
    $('contentCtaText').value=value.text||'';
    $('contentCtaButtonText').value=value.buttonText||'';
    $('contentCtaButtonLink').value=value.buttonLink||'';
    $('contentCtaEnabled').checked=value.enabled===true;
  }
  function normalizeCtaButtonLink(value){
    const raw=String(value||'').trim();
    if(!raw)return '';
    // Nomor saja atau URL wa.me: buat tautan WhatsApp dengan nomor internasional.
    const waMatch=raw.match(/^(?:https?:\/\/)?(?:www\.)?(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?(.*)$/i);
    if(waMatch){
      const phone=waMatch[1].replace(/^phone=/i,'').split(/[?&#]/)[0].replace(/\D/g,'');
      return phone?`https://wa.me/${phone}`:'';
    }
    if(/^\+?[\d\s().-]+$/.test(raw)){
      const phone=raw.replace(/\D/g,'');
      return phone?`https://wa.me/${phone}`:'';
    }
    // Terima input nomor dengan awalan 62 meski pengguna menyalin karakter pemisah sederhana.
    const digits=raw.replace(/\D/g,'');
    if(/^62\d{7,15}$/.test(digits))return `https://wa.me/${digits}`;
    return raw;
  }
  function getContentCtaData(){
    return {title:$('contentCtaTitle').value.trim(),text:$('contentCtaText').value.trim(),buttonText:$('contentCtaButtonText').value.trim(),buttonLink:normalizeCtaButtonLink($('contentCtaButtonLink').value),enabled:$('contentCtaEnabled').checked};
  }
  function renderContentFaqFields(){
    const host=$('contentFaqContainer');
    if(!host)return;
    if(!contentFaqDraft.length){host.innerHTML='<div class="empty">Belum ada FAQ. Klik Tambah FAQ untuk menambahkan pertanyaan.</div>';return;}
    host.innerHTML=contentFaqDraft.map((f,i)=>`<div class="faq-row" data-faq-row="${i}"><div class="faq-row-top"><strong>FAQ ${i+1}</strong><div class="faq-row-actions"><button type="button" class="ghost" data-faq-up="${i}" ${i===0?'disabled':''} aria-label="Naikkan FAQ">↑</button><button type="button" class="ghost" data-faq-down="${i}" ${i===contentFaqDraft.length-1?'disabled':''} aria-label="Turunkan FAQ">↓</button><button type="button" class="ghost" data-faq-delete="${i}">Hapus</button></div></div><label>Pertanyaan<input type="text" data-faq-question="${i}" maxlength="240" value="${esc(f.question||'')}" placeholder="Tulis pertanyaan"></label><label>Jawaban<textarea data-faq-answer="${i}" rows="3" maxlength="1200" placeholder="Tulis jawaban">${esc(f.answer||'')}</textarea></label><label class="faq-enabled"><input type="checkbox" data-faq-enabled="${i}" ${f.enabled!==false?'checked':''}> Tampilkan FAQ ini</label></div>`).join('');
  }
  function routeSettings(){show('contentView',false);show('editorView',false);show('categoriesView',false);show('settingsView',true);$('pageTitle').textContent='Global Settings';document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view==='settings'));loadSettings();}
  function routeCategories(){show('contentView',false);show('editorView',false);show('settingsView',false);show('categoriesView',true);$('pageTitle').textContent='Kelola Kategori';document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view==='categories'));loadCategories();}
  async function loadSettings(){if(!supabase||!session)return;const {data,error}=await supabase.from('cms_settings').select('setting_value').eq('setting_key','global').maybeSingle();if(error){setMsg('settingsMessage','Gagal memuat pengaturan: '+error.message);return;}globalSettings=data?.setting_value||{};const map={siteName:'settingSiteName',siteUrl:'settingSiteUrl',logoUrl:'settingLogo',whatsapp:'settingWhatsapp',email:'settingEmail',address:'settingAddress',hours:'settingHours',ogImage:'settingOgImage',instagram:'settingInstagram',facebook:'settingFacebook',tiktok:'settingTiktok',robots:'settingRobots',seoTitle:'settingSeoTitle',seoDescription:'settingSeoDescription'};Object.entries(map).forEach(([k,id])=>$(id).value=globalSettings[k]||'');}
  async function loadCategories(){if(!supabase||!session)return;const {data,error}=await supabase.from('cms_categories').select('*').order('content_type').order('name');if(error){$('categoryRows').innerHTML=`<tr><td colspan="3" class="empty">${esc(error.message)}. Jalankan pembaruan schema.sql.</td></tr>`;return;}categories=data||[];renderCategories();populateCategoryOptions($('contentType').value,$('category').value||'');}
  function renderCategories(){const names={root:'Halaman Root',service:'Layanan',article:'Edukasi/Artikel',jual_beli:'Jual Beli'};$('categoryRows').innerHTML=categories.length?categories.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(names[c.content_type]||c.content_type)}</td><td><div class="row-actions"><button class="ghost" data-cat-edit="${c.id}">Edit</button><button class="ghost" data-cat-delete="${c.id}">Hapus</button></div></td></tr>`).join(''):'<tr><td colspan="3" class="empty">Belum ada kategori.</td></tr>';}
  function populateCategoryOptions(type,selected=''){const el=$('category');if(!el)return;const list=categories.filter(c=>c.content_type===type);const old=selected&&!list.some(c=>c.name===selected)?`<option value="${esc(selected)}">${esc(selected)} (kategori lama)</option>`:'';el.innerHTML='<option value="">Pilih kategori (opsional)</option>'+old+list.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');el.value=selected||'';}
  function routeList(){ show('contentView',true); show('editorView',false); show('settingsView',false); show('categoriesView',false); $('pageTitle').textContent='Semua Konten'; document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view==='content')); }
  async function loadRecords(){
    if(!supabase||!session)return;
    $('contentRows').innerHTML='<tr><td colspan="6" class="empty">Memuat konten…</td></tr>';
    const {data,error}=await supabase.from('cms_content').select('*').order('updated_at',{ascending:false});
    if(error){$('contentRows').innerHTML=`<tr><td colspan="6" class="empty">${esc(error.message)}. Periksa schema dan hak akses admin.</td></tr>`;return;}
    records=data||[]; renderRecords();
  }
  function renderRecords(){
    const q=$('searchInput').value.trim().toLowerCase(), type=$('typeFilter').value, status=$('statusFilter').value||'active';
    const list=records.filter(r=>{
      const inTrash=!!r.deleted_at;
      const statusMatch=status==='trash'?inTrash:status==='active'?!inTrash:!inTrash&&r.status===status;
      return statusMatch&&(!q||`${r.title} ${r.slug} ${r.category} ${r.region}`.toLowerCase().includes(q))&&(!type||r.content_type===type);
    });
    const activeRecords=records.filter(r=>!r.deleted_at);
    $('totalCount').textContent=activeRecords.length; $('publishedCount').textContent=activeRecords.filter(r=>r.status==='published').length; $('draftCount').textContent=activeRecords.filter(r=>r.status==='draft').length;
    if(!list.length){$('contentRows').innerHTML=`<tr><td colspan="6" class="empty">${status==='trash'?'Sampah kosong.':'Belum ada konten yang cocok.'}</td></tr>`;return;}
    $('contentRows').innerHTML=list.map(r=>{
      const inTrash=!!r.deleted_at;
      const statusLabel=inTrash?'Sampah':r.status==='published'?'Terbit':'Draft';
      const actions=inTrash
        ? `<button class="publish" data-action="restore" data-id="${r.id}">Pulihkan</button>`
        : `<button class="ghost" data-action="edit" data-id="${r.id}">Edit</button><button class="ghost" data-action="preview" data-id="${r.id}">Lihat</button><button class="ghost" data-action="trash" data-id="${r.id}" title="Hapus konten" aria-label="Hapus konten">Hapus</button>`;
      return `<tr><td><strong>${esc(r.title)}</strong><small>${esc(r.public_url)}</small></td><td>${esc(labels[r.content_type]||r.content_type)}</td><td>${esc(r.category||'—')}</td><td><span class="badge ${inTrash?'trash':r.status}">${statusLabel}</span></td><td>${new Date(r.updated_at).toLocaleDateString('id-ID')}</td><td><div class="row-actions">${actions}</div></td></tr>`;
    }).join('');
  }
  async function saveContent(forceStatus){
    if(!supabase||!session)return;
    const title=$('title').value.trim(), slug=slugify($('slug').value||title), type=$('contentType').value, status=forceStatus||$('status').value;
    if(!title||!slug||!$('excerpt').value.trim()||!$('bodyHtml').value.trim()){setMsg('editorMessage','Judul, slug, deskripsi, dan isi konten wajib diisi.');return;}
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)){setMsg('editorMessage','Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung.');return;}
    const faqDraft=collectContentFaqFields();
    if(faqDraft.some(f=>(f.question&&!f.answer)||(!f.question&&f.answer))){setMsg('editorMessage','Setiap FAQ yang diisi harus memiliki pertanyaan dan jawaban.');return;}
    const ctaDraft=getContentCtaData();
    // Normalisasi ulang tepat sebelum validasi agar nomor WhatsApp 62... selalu menjadi URL wa.me.
    ctaDraft.buttonLink=normalizeCtaButtonLink(ctaDraft.buttonLink||$('contentCtaButtonLink').value);
    if(ctaDraft.enabled&&(!ctaDraft.title||!ctaDraft.text||!ctaDraft.buttonText||!ctaDraft.buttonLink)){setMsg('editorMessage','Lengkapi judul, deskripsi, teks tombol, dan link CTA atau nonaktifkan CTA khusus konten.');return;}
    if(ctaDraft.buttonLink&&!/^(https?:\/\/|mailto:|tel:)/i.test(ctaDraft.buttonLink)){setMsg('editorMessage','Link CTA harus berupa nomor WhatsApp diawali 62, URL http:// atau https://, mailto:, atau tel:.');return;}
    let imageUrl=$('imageUrl').value.trim()||currentImage;
    const file=$('imageFile').files[0];
    if(file){
      if(file.size>5*1024*1024){setMsg('editorMessage','Ukuran gambar melebihi 5 MB.');return;}
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setMsg('editorMessage','Format gambar harus JPG, PNG, atau WebP.');return;}
      // Nama objek berdasarkan hash isi file: gambar identik memakai path yang sama.
      let digest;
      try {
        const bytes=await file.arrayBuffer();
        const hashBuffer=await crypto.subtle.digest('SHA-256',bytes);
        digest=Array.from(new Uint8Array(hashBuffer)).map(b=>b.toString(16).padStart(2,'0')).join('');
      } catch (hashError) {
        setMsg('editorMessage','Tidak dapat memeriksa duplikasi gambar: '+(hashError.message||hashError));
        return;
      }
      const ext=file.name.split('.').pop().toLowerCase(), path=`${session.user.id}/${digest}.${ext}`;
      // Bila file identik sudah ada, unggahan memakai objek/path yang sama.
      const {error:uploadError}=await supabase.storage.from('rizch-content-images').upload(path,file,{upsert:true,contentType:file.type});
      if(uploadError){setMsg('editorMessage','Gagal mengunggah gambar: '+uploadError.message);return;}
      imageUrl=supabase.storage.from('rizch-content-images').getPublicUrl(path).data.publicUrl;
      // Cegah file input yang sama terunggah ulang saat draft disimpan lagi.
      $('imageFile').value='';
    }
    $('imageUrl').value=imageUrl; refreshSeoAutofill();
    const payload={content_type:type,title,slug,category:$('category').value.trim(),region:$('region').value.trim(),excerpt:$('excerpt').value.trim(),body_html:addAutomaticImageAlt($('bodyHtml').value.trim(),title,$('excerpt').value.trim()),image_url:imageUrl,deleted_at:null,status_before_trash:null,price:$('jbPrice')?normalizePriceForSave($('jbPrice').value):'',listing_status:type==='jual_beli'&&$('listingStatus')?$('listingStatus').value:'tersedia',
    jb_info_html:type==='jual_beli'&&$('jbInfoHtml')?$('jbInfoHtml').value.trim():'',faq_json:collectContentFaqFields().filter(f=>f.question||f.answer),cta_json:ctaDraft,status,public_url:plannedUrl(type,slug),seo_title:$('seoTitle').value.trim(),seo_description:$('seoDescription').value.trim(),seo_keywords:$('seoKeywords').value.trim(),canonical_url:$('canonicalUrl').value.trim(),meta_robots:$('seoRobots').value,og_title:$('ogTitle').value.trim(),og_description:$('ogDescription').value.trim(),og_image:$('ogImage').value.trim(),og_type:$('ogType').value,twitter_card:$('twitterCard').value,twitter_title:$('twitterTitle').value.trim(),twitter_description:$('twitterDescription').value.trim(),twitter_image:$('twitterImage').value.trim(),created_by:session.user.id};
    $('saveDraftBtn').disabled=true;$('publishBtn').disabled=true;setMsg('editorMessage','Menyimpan…',true);
    let result;
    if($('contentId').value) result=await supabase.from('cms_content').update(payload).eq('id',$('contentId').value).select().single();
    else result=await supabase.from('cms_content').insert(payload).select().single();
    $('saveDraftBtn').disabled=false;$('publishBtn').disabled=false;
    if(result.error){setMsg('editorMessage','Gagal menyimpan: '+result.error.message);return;}
    if(editing && editing.status==='published' && status==='published' && editing.slug!==slug){const redirectResult=await supabase.from('cms_slug_redirects').upsert({old_slug:editing.slug,new_slug:slug,content_type:type},{onConflict:'content_type,old_slug'});if(redirectResult.error){setMsg('editorMessage','Konten tersimpan, tetapi pengalihan URL lama gagal dibuat: '+redirectResult.error.message);return;}}
    setMsg('editorMessage',status==='published'?'Konten tersimpan dengan status Terbit.':'Draft berhasil disimpan.',true);
    await loadRecords();
    if(!editing){$('contentId').value=result.data.id;editing=result.data;}
  }
  async function toggleStatus(id){const item=records.find(r=>r.id===id);if(!item||item.deleted_at)return;const status=item.status==='published'?'draft':'published';const {error}=await supabase.from('cms_content').update({status}).eq('id',id);if(error){alert('Tidak dapat mengubah status: '+error.message);return;}await loadRecords();}
  async function moveToTrash(id){
    const item=records.find(r=>r.id===id);if(!item||item.deleted_at)return;
    if(!confirm(`Pindahkan “${item.title}” ke Sampah? Konten tidak tampil di website dan dapat dipulihkan selama 30 hari. Setelah 30 hari, konten dihapus permanen otomatis.`))return;
    const {error}=await supabase.from('cms_content').update({deleted_at:new Date().toISOString(),status_before_trash:item.status,status:'draft'}).eq('id',id);
    if(error){alert('Gagal menghapus konten: '+error.message+'\nPastikan SQL pembaruan Sampah sudah dijalankan di Supabase.');return;}
    $('statusFilter').value='active';await loadRecords();
  }
  async function restoreFromTrash(id){
    const item=records.find(r=>r.id===id);if(!item||!item.deleted_at)return;
    const restoredStatus=item.status_before_trash==='published'?'published':'draft';
    const message=restoredStatus==='published'?'Konten akan kembali tampil di website.':'Konten akan dipulihkan sebagai Draft.';
    if(!confirm(`Pulihkan “${item.title}”? ${message}`))return;
    const {error}=await supabase.from('cms_content').update({deleted_at:null,status_before_trash:null,status:restoredStatus}).eq('id',id);
    if(error){alert('Gagal memulihkan konten: '+error.message+'\nPastikan SQL pembaruan Sampah sudah dijalankan di Supabase.');return;}
    $('statusFilter').value='active';await loadRecords();
  }
  function preview(item=null){
    const r=item||{content_type:$('contentType').value,title:$('title').value,slug:$('slug').value,category:$('category').value,region:$('region').value,excerpt:$('excerpt').value,body_html:$('bodyHtml').value,image_url:$('imageUrl').value||currentImage,price:$('jbPrice')?$('jbPrice').value:'',listing_status:$('listingStatus')?$('listingStatus').value:'tersedia',jb_info_html:$('jbInfoHtml')?$('jbInfoHtml').value:'',faq_json:collectContentFaqFields().filter(f=>f.question&&f.answer),cta_json:getContentCtaData(),published_at:null};
    const isJb=r.content_type==='jual_beli';
    const escHtml = value => esc(value);
    const sanitizeHtml = value => {
      const parser=new DOMParser();
      const doc=parser.parseFromString(`<div>${value||''}</div>`,'text/html');
      doc.querySelectorAll('script,style,iframe,object,embed,form,svg,math,link,meta').forEach(n=>n.remove());
      doc.querySelectorAll('*').forEach(el=>[...el.attributes].forEach(a=>{
        const name=a.name.toLowerCase();
        if(name.startsWith('on')||['srcdoc','formaction'].includes(name))el.removeAttribute(a.name);
        if(['href','src','xlink:href'].includes(name)&&/^\s*(javascript:|data:text\/html)/i.test(a.value))el.removeAttribute(a.name);
      }));
      return doc.body.firstElementChild?.innerHTML||'';
    };
    const bodyHtml=sanitizeHtml(r.body_html||'');
    const jbInfoHtml=isJb?sanitizeHtml(r.jb_info_html||''):'';
    const priceRaw=String(r.price??'').trim();
    let priceText='';
    if(isJb&&priceRaw){
      const numeric=Number(priceRaw.replace(/[^\d,.-]/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.'));
      priceText=Number.isFinite(numeric)&&numeric>=0?`Rp ${numeric.toLocaleString('en-US', {maximumFractionDigits: 0})}`:priceRaw;
    }
    const cta=r.cta_json&&typeof r.cta_json==='object'?r.cta_json:{};
    const ctaLink=normalizeCtaButtonLink(cta.buttonLink||'');
    const ctaSafe=/^(https?:\/\/|mailto:|tel:)/i.test(ctaLink);
    const ctaHtml=cta.enabled===true&&cta.title&&cta.text&&cta.buttonText&&ctaSafe?`<section class="detail-cta" aria-labelledby="detail-cta-title"><div class="detail-cta-copy"><h2 id="detail-cta-title">${escHtml(cta.title)}</h2><p>${escHtml(cta.text)}</p></div><a class="detail-cta-button" href="${escHtml(ctaLink)}" target="_blank" rel="noopener noreferrer">${escHtml(cta.buttonText)}</a></section>`:'';
    const faqs=Array.isArray(r.faq_json)?r.faq_json.filter(f=>f&&f.enabled!==false&&String(f.question||'').trim()&&String(f.answer||'').trim()):[];
    const faqHtml=faqs.length?`<section class="detail-faq" aria-labelledby="detail-faq-title"><h2 id="detail-faq-title">Pertanyaan yang Sering Diajukan</h2><div class="detail-faq-list">${faqs.map((f,i)=>`<details class="detail-faq-item"${i===0?' open':''}><summary>${escHtml(f.question)}</summary><div class="detail-faq-answer"><p>${escHtml(f.answer)}</p></div></details>`).join('')}</div></section>`:'';
    const listingStatus=r.listing_status==='terjual'?'Terjual':'Tersedia';
    const jbHtml=isJb&& (priceText||jbInfoHtml)?`<section class="jb-section" aria-labelledby="jb-heading"><h2 id="jb-heading">Informasi Jual Beli</h2><p><strong>Status iklan:</strong> ${listingStatus}</p>${priceText?`<p class="jb-price">${escHtml(priceText)}</p>`:''}${jbInfoHtml?`<div class="jb-info">${jbInfoHtml}</div>`:''}</section>`:'';
    const siteName=String(globalSettings.siteName||'Rizch Bali');
    const logo=String(globalSettings.logoUrl||'/images/logo/logo-rizch.png');
    const whatsappRaw=String(globalSettings.whatsapp||'62895429358977').trim();
    const whatsapp= /^https?:\/\//i.test(whatsappRaw)?whatsappRaw:`https://wa.me/${whatsappRaw.replace(/\D/g,'')}`;
    const address=String(globalSettings.address||'Padangsambian, Denpasar, Bali');
    const email=String(globalSettings.email||'rizch130299@gmail.com');
    const hours=String(globalSettings.hours||'Senin - Sabtu: 08.00 - 17.00 WITA');
    const facebook=String(globalSettings.facebook||'https://www.facebook.com/rizchpendampingandokumenpribadi');
    const instagram=String(globalSettings.instagram||'https://www.instagram.com/rizchbali');
    const tiktok=String(globalSettings.tiktok||'https://www.tiktok.com/@rizchbali');
    const typeLabel=isJb?'Jual Beli':r.content_type==='service'?'Layanan':r.content_type==='root'?'Halaman':'Artikel';
    const parentUrl=isJb?'/jual-beli/':r.content_type==='service'?'/#layanan':r.content_type==='root'?'/':'/artikel/';
    const parentLabel=typeLabel;
    const dateHtml=r.published_at?` · ${new Date(r.published_at).toLocaleDateString('id-ID')}`:'';
    const priceMeta='';
    const articleHtml=`<div class="meta">${escHtml(r.category||'')}${r.region?` · ${escHtml(r.region)}`:''}${dateHtml}</div><h1>${escHtml(r.title||'Pratinjau Konten')}</h1>${r.image_url?`<img class="hero" src="${escHtml(r.image_url)}" alt="${escHtml(r.title||'Gambar konten Rizch Bali')}" loading="eager">`:''}${r.excerpt?`<p class="excerpt">${escHtml(r.excerpt)}</p>`:''}${isJb?`${priceText?`<p class="jb-price">${escHtml(priceText)}</p>`:''}${jbInfoHtml?`<section class="jb-section" aria-labelledby="jb-heading"><h2 id="jb-heading">Informasi Objek</h2><div class="jb-info">${jbInfoHtml}</div></section>`:''}<div class="body-copy">${bodyHtml}</div>${ctaHtml}${faqHtml}`:`<div class="body-copy">${bodyHtml}</div>${faqHtml}${ctaHtml}`}`;
    const page=`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${escHtml(location.origin)}/"><title>${escHtml(r.title||'Pratinjau')} | ${escHtml(siteName)}</title><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><link rel="stylesheet" href="/konten/detail.css"><style>body{overflow:auto}.preview-note{background:#fff7e8;color:#805319;text-align:center;padding:6px 12px;font-size:12px;border-bottom:1px solid #f1dfbd}.site-header{position:sticky;top:0}.article-detail{min-height:260px}.footer-contact p{overflow-wrap:anywhere}.social-links a{display:inline-flex;align-items:center;justify-content:center}</style></head><body><div class="preview-note">PRATINJAU ADMIN — tampilan perkiraan halaman publik</div><header class="site-header"><nav class="navbar" aria-label="Navigasi utama"><div class="nav-container"><a href="/" class="logo" aria-label="${escHtml(siteName)} - Beranda"><img src="${escHtml(logo)}" alt="${escHtml(siteName)}"></a><ul class="nav-menu" id="navMenu"><li><a href="/#beranda">Beranda</a></li><li><a href="/#layanan">Layanan</a></li><li><a href="/jual-beli/">Jual Beli</a></li><li><a href="/artikel/">Artikel</a></li><li><a href="/#testimoni">Testimoni</a></li><li><a href="/#faq">FAQ</a></li><li><a href="/admin/">Admin</a></li><li><a href="${escHtml(whatsapp)}" class="btn-whatsapp"><i class="fab fa-whatsapp"></i> Hubungi Kami</a></li></ul><button class="hamburger" id="hamburger" type="button" aria-label="Buka menu navigasi" aria-expanded="false" aria-controls="navMenu"><span></span><span></span><span></span></button></div></nav></header><main class="page-main"><div class="container"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Beranda</a><span aria-hidden="true">/</span><a href="${escHtml(parentUrl)}">${escHtml(parentLabel)}</a><span aria-hidden="true">/</span><span class="breadcrumb-current">${escHtml(r.title||'Pratinjau Konten')}</span></nav><article id="content" class="article-detail">${articleHtml}</article></div></main><footer class="site-footer"><div class="container"><div class="footer-grid"><div class="footer-brand"><a href="/" aria-label="${escHtml(siteName)}"><img src="${escHtml(logo)}" alt="Logo ${escHtml(siteName)}" class="footer-logo" loading="lazy"></a><p><strong>${escHtml(siteName)}</strong> adalah biro jasa Bali terpercaya sejak 2019 yang melayani pengurusan STNK, SIM, SKCK, paspor, dan berbagai dokumen resmi lainnya di seluruh Bali.</p><div class="social-links"><a href="${escHtml(facebook)}" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a><a href="${escHtml(instagram)}" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><i class="fab fa-instagram"></i></a><a href="${escHtml(tiktok)}" target="_blank" rel="noopener noreferrer" aria-label="TikTok"><i class="fab fa-tiktok"></i></a><a href="${escHtml(whatsapp)}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><i class="fab fa-whatsapp"></i></a></div></div><div class="footer-links"><h4>Layanan Terkait</h4><ul><li><a href="/syarat-perpanjang-stnk-bali">Syarat Perpanjang STNK Bali</a></li><li><a href="/prosedur-balik-nama-kendaraan-bali">Prosedur Balik Nama Kendaraan Bali</a></li><li><a href="/mutasi-kendaraan-bali">Mutasi Kendaraan Bali</a></li><li><a href="/jasa-pengurusan-sim-bali">Jasa Pengurusan SIM Bali</a></li><li><a href="/cara-mengurus-stnk-hilang-bali">Cara Mengurus STNK Hilang Bali</a></li><li><a href="/syarat-mengurus-skck-bali">Syarat Mengurus SKCK Bali</a></li></ul></div><div class="footer-links"><h4>Tautan Cepat</h4><ul><li><a href="/#beranda">Beranda</a></li><li><a href="/#layanan">Layanan</a></li><li><a href="/jual-beli/">Jual Beli</a></li><li><a href="/artikel/">Artikel</a></li><li><a href="/#faq">FAQ</a></li></ul></div><div class="footer-contact"><h4>Hubungi Kami</h4><p><i class="fas fa-map-marker-alt"></i> ${escHtml(address)}</p><p><i class="fab fa-whatsapp"></i> ${escHtml(whatsappRaw)}</p><p><i class="fas fa-envelope"></i> ${escHtml(email)}</p><p><i class="far fa-clock"></i> ${escHtml(hours)}</p></div></div><div class="footer-bottom"><p>&copy; ${new Date().getFullYear()} ${escHtml(siteName)}. All Rights Reserved. | Biro Jasa Dokumen Bali Terpercaya</p><p class="footer-disclaimer">${escHtml(siteName)} membantu proses pengurusan dokumen secara profesional sesuai prosedur yang berlaku dan bukan merupakan bagian dari instansi pemerintah.</p></div></div></footer><a href="${escHtml(whatsapp)}" class="floating-wa" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp ${escHtml(siteName)}"><img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp"></a><script>const h=document.getElementById('hamburger'),n=document.getElementById('navMenu');if(h&&n)h.addEventListener('click',()=>{const open=n.classList.toggle('active');h.setAttribute('aria-expanded',String(open));h.setAttribute('aria-label',open?'Tutup menu navigasi':'Buka menu navigasi')});</script></body></html>`;
    $('previewFrame').srcdoc=page;
    show('previewModal',true);
  }
  async function checkSession(){if(!supabase)return;const {data}=await supabase.auth.getSession();session=data.session; if(session){const {data:admin,error}=await supabase.from('admin_users').select('user_id').eq('user_id',session.user.id).maybeSingle();if(error||!admin){await supabase.auth.signOut();session=null;setMsg('loginMessage','Akun ini belum terdaftar sebagai admin.');show('loginPanel',true);show('workspace',false);return;}show('loginPanel',false);show('workspace',true);$('adminEmail').textContent=session.user.email||'';$('logoutBtn').classList.remove('hidden');$('connectionLabel').textContent='Terhubung';$('connectionLabel').previousElementSibling.style.background='#37c991';await loadSettings();await loadRecords();await loadCategories();}else{show('loginPanel',true);show('workspace',false);$('logoutBtn').classList.add('hidden');}}
  configuredState();
  if(configured&&supabase){checkSession();supabase.auth.onAuthStateChange(()=>setTimeout(checkSession,0));}
  $('loginForm').addEventListener('submit',async e=>{e.preventDefault();if(!supabase){setMsg('loginMessage','Konfigurasikan Supabase terlebih dahulu.');return;}setMsg('loginMessage','Memeriksa akun…',true);const {error}=await supabase.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(error){setMsg('loginMessage','Login gagal: '+error.message);return;}setMsg('loginMessage','Login berhasil.',true);await checkSession();});
  $('logoutBtn').addEventListener('click',async()=>{if(supabase)await supabase.auth.signOut();session=null;show('workspace',false);show('loginPanel',true);});
  document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.view==='new')routeEditor();else if(b.dataset.view==='settings')routeSettings();else if(b.dataset.view==='categories')routeCategories();else routeList();}));
  $('newContentBtn').addEventListener('click',()=>routeEditor());$('cancelEditBtn').addEventListener('click',routeList);$('refreshBtn').addEventListener('click',loadRecords);['searchInput','typeFilter','statusFilter'].forEach(id=>$(id).addEventListener(id==='searchInput'?'input':'change',renderRecords));
  if($('jbPrice'))$('jbPrice').addEventListener('blur',()=>{$('jbPrice').value=formatPriceInput($('jbPrice').value);});
  $('contentType').addEventListener('change',()=>{populateCategoryOptions($('contentType').value);updateUrl();updateJbFields();refreshSeoAutofill();});$('title').addEventListener('input',()=>{if(!$('contentId').value||!$('slug').dataset.edited)$('slug').value=slugify($('title').value);updateUrl();refreshSeoAutofill();});$('slug').addEventListener('input',()=>{$('slug').dataset.edited='1';$('slug').value=slugify($('slug').value);updateUrl();refreshSeoAutofill();});['excerpt','bodyHtml'].forEach(id=>$(id).addEventListener('input',refreshSeoAutofill));$('imageUrl').addEventListener('input',()=>{currentImage=$('imageUrl').value.trim();refreshSeoAutofill()});['seoTitle','seoDescription','seoRobots','canonicalUrl','ogType','ogTitle','ogDescription','ogImage','twitterCard','twitterTitle','twitterDescription','twitterImage'].forEach(bindSeoAutofill);
  $('contentForm').addEventListener('submit',e=>{e.preventDefault();saveContent('draft');});$('publishBtn').addEventListener('click',()=>saveContent('published'));$('previewBtn').addEventListener('click',()=>preview());$('closePreviewBtn').addEventListener('click',()=>show('previewModal',false));$('previewModal').addEventListener('click',e=>{if(e.target===$('previewModal'))show('previewModal',false)});
  $('imageUrl').addEventListener('input',()=>{currentImage=$('imageUrl').value; $('imagePreview').src=currentImage;show('imagePreviewWrap',!!currentImage)});$('imageFile').addEventListener('change',()=>{const f=$('imageFile').files[0];if(f){$('imagePreview').src=URL.createObjectURL(f);show('imagePreviewWrap',true)}});$('removeImageBtn').addEventListener('click',()=>{currentImage='';$('imageUrl').value='';$('imageFile').value='';$('imagePreview').removeAttribute('src');show('imagePreviewWrap',false);refreshSeoAutofill()});
  $('addContentFaqBtn').addEventListener('click',()=>addContentFaqField());
  $('contentFaqContainer').addEventListener('click',e=>{const del=e.target.closest('[data-faq-delete]'),up=e.target.closest('[data-faq-up]'),down=e.target.closest('[data-faq-down]');if(!del&&!up&&!down)return;contentFaqDraft=collectContentFaqFields();if(del){contentFaqDraft.splice(Number(del.dataset.faqDelete),1);}else if(up){const i=Number(up.dataset.faqUp);if(i>0)[contentFaqDraft[i-1],contentFaqDraft[i]]=[contentFaqDraft[i],contentFaqDraft[i-1]];}else if(down){const i=Number(down.dataset.faqDown);if(i<contentFaqDraft.length-1)[contentFaqDraft[i+1],contentFaqDraft[i]]=[contentFaqDraft[i],contentFaqDraft[i+1]];}renderContentFaqFields();});
  $('contentFaqContainer').addEventListener('input',()=>{contentFaqDraft=collectContentFaqFields();});
  $('settingsForm').addEventListener('submit',async e=>{e.preventDefault();if(!supabase||!session)return;const keys={siteName:'settingSiteName',siteUrl:'settingSiteUrl',logoUrl:'settingLogo',whatsapp:'settingWhatsapp',email:'settingEmail',address:'settingAddress',hours:'settingHours',ogImage:'settingOgImage',instagram:'settingInstagram',facebook:'settingFacebook',tiktok:'settingTiktok',robots:'settingRobots',seoTitle:'settingSeoTitle',seoDescription:'settingSeoDescription'};const value={};Object.entries(keys).forEach(([k,id])=>value[k]=$(id).value.trim());const {error}=await supabase.from('cms_settings').upsert({setting_key:'global',setting_value:value,updated_by:session.user.id,updated_at:new Date().toISOString()},{onConflict:'setting_key'});if(error){setMsg('settingsMessage','Gagal menyimpan: '+error.message);return;}globalSettings=value;setMsg('settingsMessage','Global Settings berhasil disimpan.',true);});
  $('categoryForm').addEventListener('submit',async e=>{e.preventDefault();if(!supabase||!session)return;const name=$('categoryName').value.trim(),type=$('categoryScope').value,slug=slugify(name),id=$('categoryId').value;const payload={name,content_type:type,slug,updated_at:new Date().toISOString()};const prior=id?categories.find(c=>c.id===id):null;if(prior&&prior.content_type!==type&&records.some(r=>r.content_type===prior.content_type&&r.category===prior.name)){setMsg('categoryMessage','Jenis kategori tidak dapat diubah karena masih digunakan konten. Pindahkan konten terkait terlebih dahulu.');return;}if(prior&&(prior.name!==name||prior.content_type!==type)){const {error:moveError}=await supabase.from('cms_content').update({category:name}).eq('content_type',prior.content_type).eq('category',prior.name);if(moveError){setMsg('categoryMessage','Kategori tidak diubah karena konten terkait gagal diperbarui: '+moveError.message);return;}}const result=id?await supabase.from('cms_categories').update(payload).eq('id',id):await supabase.from('cms_categories').insert(payload);if(result.error){setMsg('categoryMessage','Gagal menyimpan kategori: '+result.error.message);return;}$('categoryForm').reset();$('categoryId').value='';setMsg('categoryMessage','Kategori tersimpan.',true);await loadCategories();});
  $('cancelCategoryBtn').addEventListener('click',()=>{$('categoryForm').reset();$('categoryId').value='';$('categoryMessage').textContent='';});
  $('categoryRows').addEventListener('click',async e=>{const edit=e.target.closest('[data-cat-edit]'),del=e.target.closest('[data-cat-delete]');if(edit){const c=categories.find(x=>x.id===edit.dataset.catEdit);if(!c)return;$('categoryId').value=c.id;$('categoryName').value=c.name;$('categoryScope').value=c.content_type;return;}if(del){const c=categories.find(x=>x.id===del.dataset.catDelete);if(!c)return;const used=records.some(r=>r.content_type===c.content_type&&r.category===c.name);if(used){setMsg('categoryMessage','Kategori masih digunakan konten. Ubah kategori pada konten terlebih dahulu; penghapusan dibatalkan.');return;}if(!confirm(`Hapus kategori “${c.name}”?`))return;const {error}=await supabase.from('cms_categories').delete().eq('id',c.id);if(error){setMsg('categoryMessage','Gagal menghapus: '+error.message);return;}setMsg('categoryMessage','Kategori dihapus.',true);await loadCategories();}});
  $('contentRows').addEventListener('click',async e=>{const b=e.target.closest('button[data-action]');if(!b)return;const item=records.find(r=>r.id===b.dataset.id);if(!item)return;if(b.dataset.action==='edit'&&!item.deleted_at)routeEditor(item.content_type,item);if(b.dataset.action==='toggle'&&!item.deleted_at)toggleStatus(item.id);if(b.dataset.action==='preview'&&!item.deleted_at)preview(item);if(b.dataset.action==='trash')moveToTrash(item.id);if(b.dataset.action==='restore')restoreFromTrash(item.id);});
})();
