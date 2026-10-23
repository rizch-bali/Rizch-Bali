(async function(){
  const cfg=window.RIZCH_SUPABASE_CONFIG||{};
  if(!window.supabase||!cfg.url||cfg.url.includes('PROJECT-ID')||!cfg.anonKey||cfg.anonKey.includes('ISI_DENGAN'))return;
  try{
    const client=window.supabase.createClient(cfg.url,cfg.anonKey);
    const {data,error}=await client.from('cms_settings').select('setting_value').eq('setting_key','global').maybeSingle();
    if(error||!data?.setting_value)return;const s=data.setting_value;
    const setHref=(selector,url)=>{if(url)document.querySelectorAll(selector).forEach(a=>a.href=url)};
    if(s.siteName){document.querySelectorAll('.brand b,.brand strong,.footer-brand strong').forEach(n=>n.textContent=s.siteName);if(document.title.includes('RizchBali'))document.title=document.title.replaceAll('RizchBali',s.siteName).replaceAll('Rizch Bali',s.siteName);}
    if(s.logoUrl)document.querySelectorAll('.logo img,.footer-logo').forEach(img=>img.src=s.logoUrl);
    if(s.whatsapp){const phone=s.whatsapp.replace(/\D/g,'');setHref('.btn-whatsapp',`https://wa.me/${phone}`);setHref('.social-links a[title="WhatsApp"]',`https://wa.me/${phone}`);setHref('.floating-wa',`https://wa.me/${phone}`);}
    setHref('.social-links a[title="Instagram"]',s.instagram);setHref('.social-links a[title="Facebook"]',s.facebook);setHref('.social-links a[title="TikTok"]',s.tiktok);
    const contact=[...document.querySelectorAll('.footer-contact p')];if(s.address&&contact[0])contact[0].lastChild.textContent=' '+s.address;if(s.email&&contact[2])contact[2].lastChild.textContent=' '+s.email;if(s.hours&&contact[3])contact[3].lastChild.textContent=' '+s.hours;
    const meta=(sel,attr,value)=>{if(!value)return;let el=document.querySelector(sel);if(!el){el=document.createElement('meta');const [key,val]=sel.match(/\[(name|property)="([^"]+)"\]/).slice(1);el.setAttribute(key,val);document.head.appendChild(el);}el.setAttribute('content',value);};
    if(s.seoTitle&&/Rizch\s*Bali/i.test(document.title))document.title=s.seoTitle;
    if(s.seoDescription)meta('meta[name="description"]','name',s.seoDescription);
    if(s.ogImage)meta('meta[property="og:image"]','property',s.ogImage);
  }catch(e){console.warn('Global Settings tidak dapat dimuat.',e);}
})();
