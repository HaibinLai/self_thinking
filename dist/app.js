const DEFAULT={caseTitle:'关于“AI 与人的位置”',cards:[
 {id:'a',kind:'线索',title:'AI 让“会做”变得廉价',note:'模型能很快生成代码、总结、推导。但这不等于问题已经被解决。',x:94,y:116,tilt:'-1deg'},
 {id:'b',kind:'观察',title:'强者会被更强地放大',note:'领域知识、实验条件、判断力与长期记忆，会决定模型的能力落在哪里。',x:398,y:82,tilt:'1deg'},
 {id:'c',kind:'推断',title:'稀缺的是问题判断',note:'把模糊现象变成可检验、值得解决的问题，仍需要具体的人。',x:691,y:236,tilt:'-1.5deg'},
 {id:'d',kind:'问题',title:'我想成为怎样的人？',note:'不是与模型比赛写代码，而是能让模型在重要问题上变成放大器。',x:266,y:413,tilt:'1.5deg'},
 {id:'e',kind:'下一步',title:'找一个真实的反常现象',note:'从一个让我不服气的系统行为开始观察。',x:654,y:506,tilt:'-1deg'}],links:[['a','b'],['b','c'],['c','d'],['d','e']]};
const workspace=CaseboardStore.load(localStorage,DEFAULT);
workspace.settings||={};workspace.settings.font||='instrument';
workspace.settings.lang=CaseboardI18n.normalize(workspace.settings.lang||'zh');
function lang(){return CaseboardI18n.normalize(workspace.settings.lang)}
function t(key,vars){return CaseboardI18n.t(lang(),key,vars)}
function kindLabel(k){return t('kind.'+k)||k}
function scaleLabel(s){return t('scale.'+s)||s}
function boardTitle(name){return name||t('board.untitled')}
function applyStaticI18n(){
  document.documentElement.lang=lang()==='en'?'en':'zh-CN';
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key=el.getAttribute('data-i18n');if(!key)return;
    if(el.tagName==='TITLE'){document.title=t(key);return}
    if(el.tagName==='OPTION'){el.textContent=t(key);return}
    el.textContent=t(key);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el=>{
    const key=el.getAttribute('data-i18n-html');if(key)el.innerHTML=t(key);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el=>{
    const key=el.getAttribute('data-i18n-aria');if(key)el.setAttribute('aria-label',t(key));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el=>{
    const key=el.getAttribute('data-i18n-title');if(key)el.setAttribute('title',t(key));
  });
  document.querySelectorAll('[data-i18n-content]').forEach(el=>{
    const key=el.getAttribute('data-i18n-content');if(key)el.setAttribute('content',t(key));
  });
  const lp=document.querySelector('#langPreset');if(lp)lp.value=lang();
}
let state=workspace.boards.find(b=>b.id===workspace.activeId).data,selected=null,selectedLink=null,linking=null,drag=null,pan=null,scale=1,camera={x:0,y:0};
if(state.boardColor==='#1b2738')state.boardColor='#6a4a32';
state.boardColor ||= '#6a4a32'; state.lineColor ||= '#d95650'; state.lineWidth ||= 2; normalizeLinks(state); ensureCardLayers(state);
state.cards.forEach(c=>c.cardScale ||= (c.kind==='问题'?'世界问题':c.kind==='推断'?'研究判断':(c.kind==='观察'||c.kind==='来源'||c.kind==='下一步')?'观察 / 证据':'机制 / 局部问题'));
if(state.camera){scale=state.camera.scale||1;camera.x=state.camera.x||0;camera.y=state.camera.y||0}
const board=document.querySelector('#board'),stage=document.querySelector('#stage'),boardWrap=document.querySelector('.board-wrap'),svg=document.querySelector('#strings'),toast=document.querySelector('#toast');
const app=document.querySelector('.app'),sidebar=document.querySelector('#sidebar');
const clipDetail=document.querySelector('#clipDetail');
const openClips=new Map();
let clipStackZ=20,clipWinDrag=null,activeClipKey=null;
const narrowScreen=window.matchMedia('(max-width:900px)');
let leftOpen=narrowScreen.matches?false:state.panels?.left!==false;
function syncDetailToggle(){
  const open=isClipOpen();
  const btn=document.querySelector('#toggleInspector');
  if(btn){btn.setAttribute('aria-expanded',String(open));btn.classList.toggle('active',open)}
}
function updatePanels(){
  sidebar.hidden=!leftOpen;
  app.classList.toggle('left-collapsed',!leftOpen);
  app.classList.add('right-collapsed');
  document.querySelector('#toggleSidebar').setAttribute('aria-expanded',String(leftOpen));
  syncDetailToggle();
}
function setPanel(which,open){
  if(which!=='left')return;
  leftOpen=open;
  if(narrowScreen.matches&&open){/* left only */}
  updatePanels();save();
}
document.querySelector('#toggleSidebar').onclick=()=>setPanel('left',!leftOpen);
document.querySelector('#closeSidebar').onclick=()=>{setPanel('left',false);document.querySelector('#toggleSidebar').focus()};
document.querySelector('#toggleInspector').onclick=()=>{
  if(isClipOpen()){saveAllClipDrafts();closeAllClips();return}
  if(selected)openInspector();
  else if(selectedLink!=null)openLinkInspector();
  else toastMsg(t('toast.pickFirst'));
};
narrowScreen.addEventListener('change',()=>{if(narrowScreen.matches)leftOpen=false;else leftOpen=state.panels?.left!==false;updatePanels()});
updatePanels();
const settingsRoot=document.querySelector('#settingsRoot');
const settingsPanel=document.querySelector('#settingsPanel');
const settingsBackdrop=document.querySelector('#settingsBackdrop');
const openSettingsBtns=[...document.querySelectorAll('#openSettings,#openSettingsToolbar')];
const closeSettingsBtn=document.querySelector('#closeSettings');
let settingsOpenedAt=0;
function isSettingsOpen(){return !!(settingsRoot&&!settingsRoot.hidden&&settingsRoot.classList.contains('is-open'))}
function syncSettingsTriggers(open){openSettingsBtns.forEach(btn=>{if(btn)btn.setAttribute('aria-expanded',String(open))})}
function openSettings(ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  if(!settingsRoot)return;
  settingsOpenedAt=Date.now();
  settingsRoot.hidden=false;
  settingsRoot.classList.add('is-open');
  settingsRoot.setAttribute('aria-hidden','false');
  syncSettingsTriggers(true);
  try{applyFont()}catch(_){}
  queueMicrotask(()=>{try{settingsPanel&&settingsPanel.focus({preventScroll:true})}catch(_){}});
}
function closeSettings(ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  if(!isSettingsOpen())return;
  settingsRoot.classList.remove('is-open');
  settingsRoot.hidden=true;
  settingsRoot.setAttribute('aria-hidden','true');
  syncSettingsTriggers(false);
  const focusBtn=openSettingsBtns.find(btn=>btn&&btn.getClientRects().length)||openSettingsBtns[0];
  try{focusBtn&&focusBtn.focus({preventScroll:true})}catch(_){}
}
function toggleSettings(ev){if(isSettingsOpen())closeSettings(ev);else openSettings(ev)}
openSettingsBtns.forEach(btn=>btn&&btn.addEventListener('click',toggleSettings));
if(closeSettingsBtn)closeSettingsBtn.addEventListener('click',closeSettings);
if(settingsBackdrop)settingsBackdrop.addEventListener('click',e=>{
  if(Date.now()-settingsOpenedAt<350){e.preventDefault();e.stopPropagation();return}
  closeSettings(e);
});
if(settingsPanel)settingsPanel.addEventListener('click',e=>e.stopPropagation());
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if(isBoardPickerOpen()){
    if(boardPickerList?.querySelector('.board-picker-edit'))return;
    e.preventDefault();setBoardPickerOpen(false);boardPickerBtn?.focus();return
  }
  if(isSettingsOpen()){e.preventDefault();closeSettings(e);return}
  if(isClipOpen()){e.preventDefault();closeTopClip();return}
  if(selected!=null||selectedLink!=null||linking){e.preventDefault();clearSelection()}
});
const typeColor={线索:'#e5b55c',来源:'#77b7d5',观察:'#77b7d5',推断:'#c68bf1',问题:'#ff7168',下一步:'#ff7168',链接:'#5a9f78'};
const scaleClass={'世界问题':'world','研究判断':'research','机制 / 局部问题':'mechanism','观察 / 证据':'evidence'};
window.addEventListener('resize',()=>drawLinks());
const cardDimensions={world:[300,168],research:[228,123],mechanism:[185,104],evidence:[142,76],link:[220,210],linkImage:[280,320]};
const CARD_FIT_MAX_CHARS=200,CARD_FIT_W=[128,286],CARD_FIT_MIN_H=[58,154];
const CARD_FIT_WORLD_W=[268,320],CARD_FIT_WORLD_MIN_H=[148,180];
function cardTextLen(c){return String(c?.title||'').length+String(c?.note||'').length}
function fitCardStyle(c){
  if(isLinkCard(c)){
    if(isImageUrl(c.url))return {width:280,minHeight:0};
    return {width:220,minHeight:0};
  }
  const t=Math.min(1,cardTextLen(c)/CARD_FIT_MAX_CHARS);
  if(isWorldCard(c)){
    return {
      width:Math.round(CARD_FIT_WORLD_W[0]+(CARD_FIT_WORLD_W[1]-CARD_FIT_WORLD_W[0])*t),
      minHeight:Math.round(CARD_FIT_WORLD_MIN_H[0]+(CARD_FIT_WORLD_MIN_H[1]-CARD_FIT_WORLD_MIN_H[0])*t)
    };
  }
  return {
    width:Math.round(CARD_FIT_W[0]+(CARD_FIT_W[1]-CARD_FIT_W[0])*t),
    minHeight:Math.round(CARD_FIT_MIN_H[0]+(CARD_FIT_MIN_H[1]-CARD_FIT_MIN_H[0])*t)
  };
}
const esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MARKERS=[['none','marker.none'],['arrow','marker.arrow'],['dot','marker.dot'],['diamond','marker.diamond'],['bar','marker.bar']];
const LINK_COLORS=[
  ['#d95650','color.red'],['#e5b55c','color.gold'],['#77b7d5','color.blue'],['#c68bf1','color.purple'],
  ['#5ecf8e','color.green'],['#ff8a5b','color.orange'],['#f0e6d2','color.cream'],['#8e98a9','color.gray']
];
const FONT_PRESETS={
  instrument:{
    labelKey:'font.instrument',
    sans:'"Instrument Sans","PingFang SC","Hiragino Sans GB","Noto Sans SC",ui-sans-serif,system-ui,sans-serif',
    serif:'"Instrument Serif","Songti SC","Noto Serif SC",Georgia,serif'
  },
  classic:{
    labelKey:'font.classic',
    sans:'ui-sans-serif,system-ui,"PingFang SC","Hiragino Sans GB",sans-serif',
    serif:'Georgia,"Songti SC","Noto Serif SC",serif'
  },
  news:{
    labelKey:'font.news',
    sans:'"Instrument Sans","PingFang SC",ui-sans-serif,sans-serif',
    serif:'Georgia,"Iowan Old Style","Songti SC","Noto Serif SC",serif'
  },
  rounded:{
    labelKey:'font.rounded',
    sans:'ui-rounded,"SF Pro Rounded","PingFang SC",system-ui,sans-serif',
    serif:'"Iowan Old Style",Palatino,"Songti SC",Georgia,serif'
  }
};
function applyFont(){
  const key=workspace.settings?.font||'instrument';
  const preset=FONT_PRESETS[key]||FONT_PRESETS.instrument;
  document.documentElement.style.setProperty('--font-sans',preset.sans);
  document.documentElement.style.setProperty('--font-serif',preset.serif);
  const sel=document.querySelector('#fontPreset');
  if(sel&&sel.value!==key)sel.value=FONT_PRESETS[key]?key:'instrument';
}
function normalizeLinks(s){if(!Array.isArray(s.links))s.links=[];s.links=s.links.map(l=>Array.isArray(l)?{from:l[0],to:l[1],marker:'arrow'}:l)}
function cardZ(c){return Number.isFinite(c?.z)?c.z:0}
function ensureCardLayers(data){
  const cards=data?.cards;if(!Array.isArray(cards)||!cards.length)return;
  let z=Math.max(0,...cards.filter(c=>Number.isFinite(c.z)).map(c=>c.z));
  cards.forEach((c,i)=>{if(!Number.isFinite(c.z))c.z=z?++z:i+1});
}
function nextCardZ(data){
  const cards=data?.cards||[];
  return Math.max(0,...cards.map(cardZ))+1;
}
function applyCardLayers(){
  board.querySelectorAll('.card').forEach(e=>{
    const c=state.cards.find(x=>x.id===e.dataset.id);
    if(c)e.style.zIndex=String(cardZ(c));
  });
}
function bringCardToFront(c,{quiet}={}){
  if(!c)return;
  const max=Math.max(0,...state.cards.map(cardZ));
  if(cardZ(c)<max||state.cards.some(x=>x!==c&&cardZ(x)===max))c.z=max+1;
  applyCardLayers();saveNow();
  if(!quiet)toastMsg(t('toast.front'));
}
function sendCardToBack(c){
  if(!c)return;
  const min=Math.min(...state.cards.map(cardZ));
  c.z=min-1;applyCardLayers();saveNow();toastMsg(t('toast.back'));
}
function bringCardForward(c){
  if(!c)return;
  const above=state.cards.filter(x=>x!==c&&cardZ(x)>cardZ(c)).sort((a,b)=>cardZ(a)-cardZ(b))[0];
  if(!above){bringCardToFront(c);return}
  const tz=cardZ(c);c.z=cardZ(above);above.z=tz;applyCardLayers();saveNow();toastMsg(t('toast.up'));
}
function sendCardBackward(c){
  if(!c)return;
  const below=state.cards.filter(x=>x!==c&&cardZ(x)<cardZ(c)).sort((a,b)=>cardZ(b)-cardZ(a))[0];
  if(!below){sendCardToBack(c);return}
  const tz=cardZ(c);c.z=cardZ(below);below.z=tz;applyCardLayers();saveNow();toastMsg(t('toast.down'));
}
function tryParseUrl(text){
  const s=String(text||'').trim();if(!s||/\s/.test(s))return null;
  try{const u=new URL(/^https?:\/\//i.test(s)?s:'https://'+s);if(!/^https?:$/i.test(u.protocol)||!u.hostname.includes('.'))return null;return u.href}catch{return null}
}
function hostOf(url){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return ''}}
function faviconOf(url){const h=hostOf(url);return h?`https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=128`:''}
function shotOf(url){return `https://mini.s-shot.ru/1024x768/JPEG/480/Z100/?${encodeURIComponent(url)}`}
function isImageUrl(url){
  try{
    const path=decodeURIComponent(new URL(url).pathname).toLowerCase();
    return /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(path);
  }catch{return false}
}
function imageFileName(url){
  try{
    const name=decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop()||'');
    return name||t('card.image');
  }catch{return t('card.image')}
}
function isLinkCard(c){return !!(c&&(c.url||c.kind==='链接'))}
const PREVIEW_MAX_DIM=720,PREVIEW_JPEG_Q=.7,PREVIEW_MAX_CHARS=180000;
function previewPick(c){
  if(c.preview)return {src:c.preview,stage:'user'};
  if(c.url&&isImageUrl(c.url))return {src:c.url,stage:'image'};
  if(c.previewCache)return {src:c.previewCache,stage:'cache'};
  if(c.url)return {src:shotOf(c.url),stage:'live'};
  return {src:'',stage:'none'};
}
function cardFromShotImg(img){
  const id=img&&img.closest&&img.closest('.card')?.dataset?.id;
  return id?state.cards.find(x=>x.id===id):null;
}
function looksLikeTimeoutCanvas(ctx,w,h){
  // site-shot 超时图：底边中灰扁条；真实网页截图底边很少是这种灰
  const strip=Math.max(1,Math.floor(h*.1));
  const lumStats=(x,y,sw,sh)=>{
    const data=ctx.getImageData(x,y,sw,sh).data;let sum=0,sum2=0,n=data.length/4;
    for(let i=0;i<data.length;i+=4){const yv=data[i]*.3+data[i+1]*.59+data[i+2]*.11;sum+=yv;sum2+=yv*yv}
    const mean=sum/n;return {mean,v:sum2/n-mean*mean};
  };
  const top=lumStats(0,0,w,strip),bot=lumStats(0,h-strip,w,strip);
  const midGrayFlat=s=>s.mean>175&&s.mean<220&&s.v<40;
  return midGrayFlat(bot)&&top.mean>170&&top.mean<220;
}
function compressDrawnJpeg(draw,srcW,srcH){
  const scale=Math.min(1,PREVIEW_MAX_DIM/Math.max(srcW,srcH));
  const cw=Math.max(1,Math.round(srcW*scale)),ch=Math.max(1,Math.round(srcH*scale));
  const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;
  const ctx=canvas.getContext('2d');draw(ctx,cw,ch);
  if(looksLikeTimeoutCanvas(ctx,cw,ch))throw new Error('timeout-shot');
  let dataUrl=canvas.toDataURL('image/jpeg',PREVIEW_JPEG_Q);
  if(dataUrl.length>PREVIEW_MAX_CHARS)dataUrl=canvas.toDataURL('image/jpeg',.55);
  return dataUrl;
}
function imgToPreviewCache(img){
  const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
  if(!w||!h)throw new Error('no-size');
  return compressDrawnJpeg((ctx,cw,ch)=>ctx.drawImage(img,0,0,cw,ch),w,h);
}
async function blobToPreviewCache(blob){
  const bmp=await createImageBitmap(blob);
  try{
    return compressDrawnJpeg((ctx,cw,ch)=>ctx.drawImage(bmp,0,0,cw,ch),bmp.width,bmp.height);
  }finally{bmp.close?.()}
}
async function persistPreviewCache(card,dataUrl){
  if(!card||!dataUrl||card.previewCache===dataUrl)return;
  card.previewCache=dataUrl;scheduleSave();
}
function showCachedOrFallback(card,img){
  if(card?.previewCache){
    img.setAttribute('data-stage','cache');img.classList.remove('fallback');
    img.removeAttribute('crossorigin');img.src=card.previewCache;
    const w=img.closest('.link-shot-wrap');if(w)w.dataset.state='ok';
    return true;
  }
  linkShotErr(img);return false;
}
async function verifyAndCacheLive(card,img){
  if(!card)return;
  const src=img.currentSrc||img.src;
  if(src&&!src.startsWith('data:')){
    try{
      const res=await fetch(src,{mode:'cors',credentials:'omit'});
      if(!res.ok){showCachedOrFallback(card,img);return}
      const dataUrl=await blobToPreviewCache(await res.blob());
      await persistPreviewCache(card,dataUrl);
      img.setAttribute('data-stage','cache');
      return;
    }catch(_){}
  }
  try{
    const dataUrl=imgToPreviewCache(img);
    await persistPreviewCache(card,dataUrl);
    img.setAttribute('data-stage','cache');
  }catch(err){
    if(String(err&&err.message)==='timeout-shot')showCachedOrFallback(card,img);
  }
}
function linkShotLoad(img){
  const wrap=img&&img.closest&&img.closest('.link-shot-wrap');
  const stage=img.getAttribute('data-stage')||'';
  if(wrap)wrap.dataset.state=img.classList.contains('fallback')?'icon':'ok';
  if(stage==='fav'||stage==='cache')return;
  const card=cardFromShotImg(img);if(!card)return;
  if(stage==='live'){verifyAndCacheLive(card,img);return}
  if(stage==='image'||stage==='user'){
    try{persistPreviewCache(card,imgToPreviewCache(img))}catch(_){}
  }
}
function linkShotErr(img){
  const wrap=img&&img.closest&&img.closest('.link-shot-wrap');
  const card=cardFromShotImg(img);
  const stage=img.getAttribute('data-stage')||'';
  if(card?.previewCache&&stage!=='cache'){
    img.setAttribute('data-stage','cache');
    img.classList.remove('fallback');
    img.removeAttribute('crossorigin');
    img.src=card.previewCache;
    if(wrap)wrap.dataset.state='ok';
    return;
  }
  const fav=img.getAttribute('data-fav')||'';
  if(fav&&stage!=='fav'){
    img.setAttribute('data-stage','fav');
    img.classList.add('fallback');
    img.removeAttribute('data-fav');
    img.removeAttribute('crossorigin');
    img.src=fav;
    if(wrap)wrap.dataset.state='icon';
    return;
  }
  if(img&&img.parentNode)img.remove();
  if(!wrap)return;
  wrap.dataset.state='broken';
  if(!wrap.querySelector('.link-shot-ph')){
    const ph=document.createElement('div');
    ph.className='link-shot-ph';
    ph.innerHTML=`<span>${esc(t('card.previewBroken'))}</span>`;
    wrap.insertBefore(ph,wrap.firstChild);
  }
}
function cardFaceHtml(c){
  if(!isLinkCard(c))return `<div class="kind">${esc(scaleLabel(c.cardScale))} · ${esc(kindLabel(c.kind))}</div><div class="title">${esc(c.title||t('card.untitled'))}</div><div class="excerpt">${esc(c.note||'')}</div>`;
  const url=c.url||'',host=hostOf(url),fav=faviconOf(url),pick=previewPick(c);
  const directImg=pick.stage==='image'||(pick.stage==='cache'&&isImageUrl(url))||(pick.stage==='user'&&isImageUrl(c.preview||url));
  const hostLabel=host||t('card.webLink'),title=c.title||(isImageUrl(url)?imageFileName(url):host)||t('card.webLink'),note=c.note||'';
  const kindExtra=c.kind&&c.kind!=='链接'?` · ${esc(kindLabel(c.kind))}`:'';
  const kindLabelText=isImageUrl(url)?t('card.imageClip'):t('card.linkClip');
  const bodyClass=isImageUrl(url)?'link-body link-body-image':'link-body';
  const chip=`<div class="link-chip">${fav?`<img src="${esc(fav)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"/>`:''}<span>${esc(hostLabel)}</span></div>`;
  let media;
  if(pick.src){
    const needsCors=pick.stage==='live'&&!pick.src.startsWith('data:');
    const cors=needsCors?' crossorigin="anonymous"':'';
    media=`<div class="link-shot-wrap" data-state="loading"${directImg||pick.stage==='image'?' data-kind="image"':''}><img class="link-shot" src="${esc(pick.src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"${cors} data-stage="${esc(pick.stage)}" data-fav="${esc(fav)}" onerror="linkShotErr(this)" onload="linkShotLoad(this)"/>${chip}</div>`;
  }else if(fav){
    media=`<div class="link-shot-wrap" data-state="icon"><img class="link-shot fallback" src="${esc(fav)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-stage="fav" onerror="linkShotErr(this)"/>${chip}</div>`;
  }else{
    media=`<div class="link-shot-wrap" data-state="empty"><div class="link-shot-ph"><span>${esc(t('card.previewPh'))}</span></div>${chip}</div>`;
  }
  const excerpt=isImageUrl(url)
    ?(note?`<div class="excerpt">${esc(note)}</div>`:'')
    :`<div class="excerpt${note?'':' is-ph'}">${esc(note||t('card.notePh'))}</div>`;
  return `${media}<div class="${bodyClass}"><div class="kind">${kindLabelText}${kindExtra}</div><div class="title">${esc(title)}</div>${excerpt}</div>`;
}
function markerDefs(color,prefix='mk'){return (
  `<marker id="${prefix}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="${color}"/></marker>`+
  `<marker id="${prefix}-dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse"><circle cx="5" cy="5" r="4.5" fill="${color}"/></marker>`+
  `<marker id="${prefix}-diamond" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path d="M5,0L10,5L5,10L0,5z" fill="${color}"/></marker>`+
  `<marker id="${prefix}-bar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto"><rect x="3.5" y="0" width="3" height="10" fill="${color}"/></marker>`
)}
function colorKey(c){return String(c||'').replace('#','').toLowerCase()}
function swatchHtml(active,name){
  return LINK_COLORS.map(([c,labelKey])=>`<button type="button" class="swatch${colorKey(c)===colorKey(active)?' on':''}" data-color="${c}" data-swatch="${name}" style="--c:${c}" title="${esc(t(labelKey))}" aria-label="${esc(t(labelKey))}" aria-pressed="${colorKey(c)===colorKey(active)}"></button>`).join('')
}
function bindSwatches(root,get,set){
  root.querySelectorAll('.swatch').forEach(btn=>btn.onclick=()=>{set(btn.dataset.color);root.querySelectorAll('.swatch').forEach(b=>{const on=b.dataset.color===btn.dataset.color;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on))})})
}
// 从卡片中心朝目标方向，落到矩形边缘外 pad 像素处，避免标志被卡片盖住
function edgePoint(cx,cy,w,h,tx,ty,pad){
  const dx=tx-cx,dy=ty-cy;if(!dx&&!dy)return {x:cx,y:cy};
  const hx=w/2,hy=h/2,sx=dx?hx/Math.abs(dx):Infinity,sy=dy?hy/Math.abs(dy):Infinity;
  const t=Math.min(sx,sy);let x=cx+dx*t,y=cy+dy*t;
  const len=Math.hypot(dx,dy);x-=dx/len*pad;y-=dy/len*pad;
  return {x,y};
}
function save(){state.panels={left:leftOpen,right:false};state.camera={x:camera.x,y:camera.y,scale};try{CaseboardStore.save(localStorage,workspace);document.querySelector('#storageError').hidden=true}catch(error){document.querySelector('#storageError').hidden=false;document.querySelector('#storageError').textContent=t('storage.fail')}document.querySelector('#caseTitle').textContent=state.caseTitle;document.querySelector('#count').textContent=t('count.cards',{n:state.cards.length});const bl=document.querySelector('#boardPickerLabel');if(bl)bl.textContent=boardTitle(state.caseTitle)}
let saveTimer=0;
function scheduleSave(ms=320){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveTimer=0;save()},ms)}
function saveNow(){clearTimeout(saveTimer);saveTimer=0;save()}
const LOD_WORLD=.4,BUBBLE_SIZE=[14,14];
function isWorldCard(c){return !!(c&&!isLinkCard(c)&&c.cardScale==='世界问题')}
function shouldBubble(c){return scale<LOD_WORLD&&!isWorldCard(c)&&!c?.keepVisible}
function cardSizeKey(c){return isLinkCard(c)?(isImageUrl(c.url)?'linkImage':'link'):(scaleClass[c.cardScale]||'mechanism')}
function fallbackCardSize(c){
  if(shouldBubble(c))return BUBBLE_SIZE;
  const fit=fitCardStyle(c);
  const base=cardDimensions[cardSizeKey(c)]||cardDimensions.mechanism;
  return [fit.width,Math.max(fit.minHeight||0,base[1]*0.55)];
}
function applyCardLod(){
  const lod=scale<LOD_WORLD;
  stage.classList.toggle('lod-world',lod);
  stage.classList.remove('far');
  let changed=false;
  board.querySelectorAll('.card').forEach(e=>{
    const c=state.cards.find(x=>x.id===e.dataset.id);
    const bubble=shouldBubble(c);
    if(e.classList.contains('bubble')!==bubble)changed=true;
    e.classList.toggle('bubble',bubble);
  });
  return changed;
}
function applyCamera(){
  boardWrap.style.backgroundPosition=`${camera.x}px ${camera.y}px`;
  stage.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${scale})`;
  document.querySelector('#zoomLabel').textContent=Math.round(scale*100)+'%';
  if(applyCardLod())drawLinks();
}
function applyStyle(){
  boardWrap.style.backgroundColor=state.boardColor;
  const bc=document.querySelector('#boardColor'),lw=document.querySelector('#lineWidth'),lv=document.querySelector('#lineWidthVal');
  if(bc&&bc.value!==state.boardColor)bc.value=state.boardColor;
  if(lw&&String(lw.value)!==String(state.lineWidth))lw.value=state.lineWidth;
  if(lv)lv.textContent=state.lineWidth;
  applyCamera();
}
let lineSwatchesBound=false;
function refreshLineColorSwatches(){
  const box=document.querySelector('#lineColorSwatches');if(!box)return;
  box.innerHTML=swatchHtml(state.lineColor,'default');
  bindSwatches(box,()=>state.lineColor,c=>{state.lineColor=c;drawLinks();saveNow();refreshLineColorSwatches()});
  lineSwatchesBound=true;
}
function markCards(){document.querySelectorAll('.card').forEach(e=>{e.classList.toggle('selected',e.dataset.id===selected);e.classList.toggle('target',e.dataset.id===linking)});boardWrap.classList.toggle('linking',!!linking);document.querySelector('#linkBtn').classList.toggle('active',!!linking)}
function render(){board.querySelectorAll('.card').forEach(e=>e.remove());document.querySelector('#empty').hidden=state.cards.length>0;ensureCardLayers(state);[...state.cards].sort((a,b)=>cardZ(a)-cardZ(b)).forEach(c=>{let e=document.createElement('article');const link=isLinkCard(c);const world=isWorldCard(c);const imgCard=link&&isImageUrl(c.url);const fit=fitCardStyle(c);e.className=`card fit ${link?(imgCard?'link link-image':'link'):(scaleClass[c.cardScale]||'mechanism')}`;e.dataset.id=c.id;e.style.cssText=`left:${c.x}px;top:${c.y}px;--tilt:${c.tilt||'0deg'};--type:${typeColor[c.kind]||(link?'#5a9f78':'#e5b55c')};width:${fit.width}px;min-height:${fit.minHeight||0}px;height:auto;z-index:${cardZ(c)}`;e.innerHTML=`<button class="pin" aria-label="${esc(t('card.pin'))}" title="${esc(t('card.pinTitle'))}"></button>${world?'<span class="world-ring" aria-hidden="true"></span>':''}${cardFaceHtml(c)}`;e.addEventListener('pointerdown',startDrag);e.addEventListener('click',clickCard);let pin=e.querySelector('.pin');pin.addEventListener('pointerdown',x=>x.stopPropagation());pin.addEventListener('click',x=>{x.stopPropagation();enterLinkMode(c.id)});board.appendChild(e)});markCards();applyStyle();drawLinks();scheduleSave()}
let linksRaf=0;
function requestDrawLinks(){if(linksRaf)return;linksRaf=requestAnimationFrame(()=>{linksRaf=0;drawLinks()})}
function drawLinks(){
  const sizes=new Map([...board.querySelectorAll('.card')].map(e=>[e.dataset.id,[e.offsetWidth,e.offsetHeight]]));
  const used=new Set([state.lineColor,...state.links.map(lk=>lk.color||state.lineColor)]);
  let out='<defs>'+[...used].map(c=>markerDefs(c,'mk'+colorKey(c))).join('')+'</defs>';
  state.links.forEach((lk,i)=>{
    const A=state.cards.find(c=>c.id===lk.from),B=state.cards.find(c=>c.id===lk.to);if(!A||!B)return;
    const [aw,ah]=sizes.get(lk.from)||fallbackCardSize(A);
    const [bw,bh]=sizes.get(lk.to)||fallbackCardSize(B);
    const acx=A.x+aw/2,acy=A.y+ah/2,bcx=B.x+bw/2,bcy=B.y+bh/2;
    const pad=lk.marker&&lk.marker!=='none'?10:4;
    const p1=edgePoint(acx,acy,aw,ah,bcx,bcy,4),p2=edgePoint(bcx,bcy,bw,bh,acx,acy,pad);
    const w=lk.width||state.lineWidth||2,sel=i===selectedLink,stroke=lk.color||state.lineColor;
    const prefix='mk'+colorKey(stroke);
    const mk=(lk.marker&&lk.marker!=='none')?` marker-end="url(#${prefix}-${lk.marker})"`:'';
    out+=`<line class="link-hit" data-i="${i}" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke-width="${Math.max(16,w+12)}"/>`;
    out+=`<line class="${sel?'sel':''}" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${stroke}" stroke-width="${w}" opacity="${sel?1:.9}"${mk}/>`;
  });
  svg.innerHTML=out;
  svg.querySelectorAll('.link-hit').forEach(el=>el.addEventListener('click',ev=>{ev.stopPropagation();selectLink(+el.dataset.i)}));
}
function startDrag(e){let c=state.cards.find(x=>x.id===e.currentTarget.dataset.id),r=boardWrap.getBoundingClientRect();drag={c,dx:(e.clientX-r.left-camera.x)/scale-c.x,dy:(e.clientY-r.top-camera.y)/scale-c.y,startX:e.clientX,startY:e.clientY,moved:false,el:e.currentTarget};window.addEventListener('pointermove',moveDrag);window.addEventListener('pointerup',endDrag,{once:true})}
function moveDrag(e){if(!drag)return;if(!drag.moved&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<6)return;if(!drag.moved){drag.moved=true;bringCardToFront(drag.c,{quiet:true})}let r=boardWrap.getBoundingClientRect();drag.c.x=(e.clientX-r.left-camera.x)/scale-drag.dx;drag.c.y=(e.clientY-r.top-camera.y)/scale-drag.dy;drag.el.style.left=drag.c.x+'px';drag.el.style.top=drag.c.y+'px';requestDrawLinks()}
function endDrag(){window.removeEventListener('pointermove',moveDrag);if(drag?.moved){if(linksRaf){cancelAnimationFrame(linksRaf);linksRaf=0;drawLinks()}saveNow()}if(drag)setTimeout(()=>drag=null,0)}
function enterLinkMode(id){linking=id||'choose-source';markCards();toastMsg(id?t('toast.linkPickOther'):t('toast.linkPickSource'))}
function clearLinkMode(){linking=null;markCards()}
function clickCard(e){if(drag?.moved)return;if(selectedLink!=null){selectedLink=null;drawLinks()}let id=e.currentTarget.dataset.id;if(linking==='choose-source'){selected=id;linking=id;markCards();toastMsg(t('toast.linkSourceOk'));return}if(linking&&linking!==id){if(!state.links.some(x=>x.from===linking&&x.to===id))state.links.push({from:linking,to:id,marker:'none',width:state.lineWidth,color:state.lineColor});selected=id;clearLinkMode();drawLinks();save();toastMsg(t('toast.linkDone'));return}if(linking){return}selected=id;markCards();openInspector()}
function isClipOpen(){return openClips.size>0}
function cardClipKey(id){return 'card:'+id}
function linkClipKey(lk){return 'link:'+(lk?.from||'')+':'+(lk?.to||'')}
function syncClipLayer(){
  if(!clipDetail)return;
  const open=isClipOpen();
  clipDetail.hidden=!open;
  clipDetail.classList.toggle('is-open',open);
  clipDetail.setAttribute('aria-hidden',String(!open));
  syncDetailToggle();
}
function focusClip(key){
  const win=openClips.get(key);if(!win)return;
  activeClipKey=key;
  clipStackZ+=1;win.z=clipStackZ;win.paper.style.zIndex=String(clipStackZ);
  openClips.forEach((w,k)=>w.paper.classList.toggle('is-focus',k===key));
}
function closeClip(key,{save=true}={}){
  const win=openClips.get(key);if(!win)return;
  if(save&&win.kind==='card')flushCardForm(win.body,win.targetId);
  win.paper.remove();
  openClips.delete(key);
  if(activeClipKey===key)activeClipKey=null;
  syncClipLayer();
  scheduleSave();
}
function closeTopClip(){
  if(!openClips.size)return;
  let topKey=null,topZ=-1;
  openClips.forEach((w,k)=>{if(w.z>=topZ){topZ=w.z;topKey=k}});
  if(topKey)closeClip(topKey);
}
function closeAllClips({save=true}={}){
  [...openClips.keys()].forEach(k=>closeClip(k,{save}));
}
function saveAllClipDrafts(){
  openClips.forEach(win=>{if(win.kind==='card')flushCardForm(win.body,win.targetId)});
  save();
}
function hideClip(){closeAllClips({save:false})}
function dismissClip(){
  saveAllClipDrafts();
  selected=null;selectedLink=null;linking=null;
  markCards();drawLinks();
  closeAllClips({save:false});
}
const CLIP_PAPER_W=720;
function placeClipPaper(paper,cardId){
  const br=boardWrap.getBoundingClientRect();
  const pad=14,pw=Math.min(CLIP_PAPER_W,br.width-pad*2);
  const offset=Math.max(0,openClips.size-1)*28;
  paper.style.width=pw+'px';
  paper.style.transform='none';
  if(narrowScreen.matches){
    paper.style.left=pad+'px';paper.style.top=(pad+offset)+'px';
    paper.style.right=pad+'px';paper.style.width='auto';
    return;
  }
  const el=cardId?board.querySelector(`.card[data-id="${CSS.escape(cardId)}"]`):null;
  let left,top;
  if(el){
    const cr=el.getBoundingClientRect();
    left=cr.right-br.left+16;top=cr.top-br.top-12;
    if(left+pw>br.width-pad)left=cr.left-br.left-pw-16;
    if(left<pad)left=pad;
    top=Math.max(pad,top)+offset;
  }else{
    left=Math.max(pad,(br.width-pw)/2)+offset;
    top=Math.max(pad,br.height*.12)+offset;
  }
  paper.style.left=left+'px';paper.style.top=top+'px';
  paper.classList.add('anchored');
  requestAnimationFrame(()=>{
    const ph=paper.offsetHeight,maxTop=Math.max(pad,br.height-pad-ph);
    let t=parseFloat(paper.style.top)||pad;
    if(t>maxTop)paper.style.top=maxTop+'px';
  });
}
function ensureClipWindow(key,{kind,targetId,heading}){
  let win=openClips.get(key);
  if(win){focusClip(key);return win}
  if(!clipDetail)return null;
  const paper=document.createElement('article');
  paper.className='clip-paper is-animating';
  paper.dataset.clipKey=key;
  paper.setAttribute('role','dialog');
  paper.setAttribute('aria-modal','false');
  paper.innerHTML=`<header class="clip-drag"><div class="clip-drag-meta"><p class="clip-kicker">${esc(t('clip.kicker'))}</p><h2 class="clip-heading">${esc(heading||t('clip.detail'))}</h2></div><button type="button" class="clip-close" aria-label="${esc(t('clip.closeAria'))}">${esc(t('clip.close'))}</button></header><div class="clip-body"></div>`;
  const body=paper.querySelector('.clip-body');
  clipStackZ+=1;
  win={paper,body,kind,targetId,z:clipStackZ};
  paper.style.zIndex=String(clipStackZ);
  openClips.set(key,win);
  clipDetail.appendChild(paper);
  syncClipLayer();
  placeClipPaper(paper,kind==='card'?targetId:null);
  focusClip(key);
  paper.querySelector('.clip-close').onclick=e=>{e.stopPropagation();closeClip(key)};
  paper.addEventListener('pointerdown',e=>{
    e.stopPropagation();
    focusClip(key);
    const handle=e.target.closest('.clip-drag');
    if(!handle||e.target.closest('.clip-close,input,textarea,select,button,a'))return;
    const r=paper.getBoundingClientRect(),br=boardWrap.getBoundingClientRect();
    clipWinDrag={key,dx:e.clientX-r.left,dy:e.clientY-r.top,ox:br.left,oy:br.top,moved:false};
    paper.classList.add('is-dragging');
    window.addEventListener('pointermove',moveClipWin);
    window.addEventListener('pointerup',endClipWin,{once:true});
  });
  return win;
}
function moveClipWin(e){
  if(!clipWinDrag)return;
  const win=openClips.get(clipWinDrag.key);if(!win)return;
  clipWinDrag.moved=true;
  const br=boardWrap.getBoundingClientRect();
  let left=e.clientX-clipWinDrag.ox-clipWinDrag.dx;
  let top=e.clientY-clipWinDrag.oy-clipWinDrag.dy;
  const pad=8,pw=win.paper.offsetWidth,ph=win.paper.offsetHeight;
  left=Math.max(pad,Math.min(br.width-pw-pad,left));
  top=Math.max(pad,Math.min(br.height-ph-pad,top));
  win.paper.style.left=left+'px';
  win.paper.style.top=top+'px';
  win.paper.style.right='';
  win.paper.style.transform='none';
  win.paper.classList.add('anchored');
}
function endClipWin(){
  window.removeEventListener('pointermove',moveClipWin);
  if(clipWinDrag){
    const win=openClips.get(clipWinDrag.key);
    win?.paper.classList.remove('is-dragging');
  }
  setTimeout(()=>clipWinDrag=null,0);
}
function q(root,sel){return root?root.querySelector(sel):null}
function flushCardForm(root,cardId){
  const id=cardId||root?.closest?.('.clip-paper')?.dataset?.cardId||selected;
  const c=state.cards.find(x=>x.id===id);if(!c)return null;
  const scope=root||openClips.get(cardClipKey(id))?.body;
  if(!scope||!q(scope,'.f-title'))return c;
  const prevUrl=c.url,prevPreview=c.preview;
  c.cardScale=q(scope,'.f-scale')?.value||c.cardScale;
  c.kind=q(scope,'.f-kind')?.value||c.kind;
  c.title=(q(scope,'.f-title')?.value||'').trim()||t('card.untitled');
  const rawUrl=(q(scope,'.f-url')?.value||'').trim();
  c.url=tryParseUrl(rawUrl)||'';
  if(!c.url&&rawUrl)toastMsg(t('toast.badUrl'));
  c.preview=(q(scope,'.f-preview')?.value||'').trim();
  c.note=(q(scope,'.f-note')?.value||'').trim();
  const keepEl=q(scope,'.f-keep');
  if(keepEl&&!keepEl.disabled)c.keepVisible=!!keepEl.checked;
  if(c.url!==prevUrl||c.preview!==prevPreview)delete c.previewCache;
  if(c.url&&c.kind!=='链接'&&!['来源','线索'].includes(c.kind))c.kind='链接';
  if(c.url&&(!c.title||c.title===t('card.untitled')||c.title==='无标题'))c.title=isImageUrl(c.url)?imageFileName(c.url):(hostOf(c.url)||t('card.webLink'));
  else if(c.url&&c.url!==prevUrl&&c.title===hostOf(prevUrl||''))c.title=isImageUrl(c.url)?imageFileName(c.url):(hostOf(c.url)||t('card.webLink'));
  return c;
}
const CARD_CLIP_PREFIX='caseboard-card:v1:';
function cloneCardOnto(boardData,source,offset=36){
  if(!boardData.cards)boardData.cards=[];
  const copy=JSON.parse(JSON.stringify(source));
  copy.id=crypto.randomUUID();
  copy.x=(Number(source.x)||0)+offset;
  copy.y=(Number(source.y)||0)+offset;
  copy.z=nextCardZ(boardData);
  if(!copy.tilt)copy.tilt=(Math.random()>.5?'-1deg':'1deg');
  boardData.cards.push(copy);
  return copy;
}
function cardClipboardText(c){
  const payload=JSON.parse(JSON.stringify(c));
  delete payload.id;
  return CARD_CLIP_PREFIX+JSON.stringify(payload);
}
function parseCardClipboard(text){
  const t=String(text||'').trim();
  if(!t.startsWith(CARD_CLIP_PREFIX))return null;
  try{
    const data=JSON.parse(t.slice(CARD_CLIP_PREFIX.length));
    if(!data||typeof data!=='object'||Array.isArray(data))return null;
    return data;
  }catch{return null}
}
function pasteCardPayload(data){
  const seed={...data,id:'tmp',x:data.x??0,y:data.y??0};
  const card=cloneCardOnto(state,seed);
  selected=card.id;selectedLink=null;clearLinkMode();
  render();openInspector();
  toastMsg(t('toast.pasted'));
}
function openInspector(){
  const c=state.cards.find(x=>x.id===selected);if(!c||!clipDetail)return;
  const key=cardClipKey(c.id);
  const kinds=['线索','链接','来源','观察','推断','问题','下一步'];
  const scales=['世界问题','研究判断','机制 / 局部问题','观察 / 证据'];
  const heading=isLinkCard(c)?(isImageUrl(c.url)?t('card.imageClip'):t('card.linkClip')):t('clip.leadDetail');
  const cacheHint=c.previewCache?t('clip.cacheOk'):(isImageUrl(c.url)?t('clip.cacheImage'):t('clip.cacheShot'));
  const worldLocked=isWorldCard(c);
  const pick=previewPick(c);
  const fav=faviconOf(c.url||'');
  const win=ensureClipWindow(key,{kind:'card',targetId:c.id,heading});
  if(!win)return;
  win.paper.dataset.cardId=c.id;
  win.targetId=c.id;
  const headingEl=win.paper.querySelector('.clip-heading');
  if(headingEl)headingEl.textContent=heading;
  const kicker=win.paper.querySelector('.clip-kicker');
  if(kicker)kicker.textContent=t('clip.kicker');
  const closeBtn=win.paper.querySelector('.clip-close');
  if(closeBtn){closeBtn.textContent=t('clip.close');closeBtn.setAttribute('aria-label',t('clip.closeAria'))}
  const previewHtml=c.url||c.preview||c.previewCache
    ?`<div class="clip-preview${pick.stage==='image'||isImageUrl(c.url)?' is-image':''}">${pick.src
      ?`<img src="${esc(pick.src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"${pick.stage==='live'?' crossorigin="anonymous"':''} data-stage="${esc(pick.stage)}" data-fav="${esc(fav)}" onerror="this.classList.add('is-fallback');this.src=this.dataset.fav||'';this.onerror=null" />`
      :`<div class="clip-preview-empty">${esc(t('clip.noPreview'))}</div>`}</div>`
    :'';
  const root=win.body;
  root.innerHTML=`${linking?`<div class="connection-help">${esc(t('clip.helpLink'))}</div>`:''}`+
    `<div class="clip-layout">`+
    `<div class="clip-col clip-col-meta">`+
    previewHtml+
    `<div class="field-row">`+
    `<div class="field"><label>${esc(t('clip.scale'))}</label><select class="f-scale">${scales.map(x=>`<option value="${esc(x)}" ${x===c.cardScale?'selected':''}>${esc(scaleLabel(x))}</option>`).join('')}</select></div>`+
    `<div class="field"><label>${esc(t('clip.type'))}</label><select class="f-kind">${kinds.map(x=>`<option value="${esc(x)}" ${x===c.kind?'selected':''}>${esc(kindLabel(x))}</option>`).join('')}</select></div>`+
    `</div>`+
    `<div class="field check"><label><input type="checkbox" class="f-keep" ${c.keepVisible||worldLocked?'checked':''} ${worldLocked?'disabled':''} /> ${esc(t('clip.keepVisible'))}</label></div>`+
    `<p class="hint">${esc(worldLocked?t('clip.keepWorld'):t('clip.keepHint'))}</p>`+
    `<div class="field"><label>${esc(t('clip.title'))}</label><input class="f-title" value="${esc(c.title||'')}" /></div>`+
    `<div class="field"><label>${esc(t('clip.url'))}</label><input class="f-url" type="url" placeholder="https://example.com/…" value="${esc(c.url||'')}" /></div>`+
    `<div class="field"><label>${esc(t('clip.preview'))}</label><input class="f-preview" type="url" placeholder="${esc(t('clip.previewPh'))}" value="${esc(c.preview||'')}" /></div>`+
    `<p class="hint">${esc(c.preview?t('clip.hintUserCover'):(isImageUrl(c.url)?t('clip.hintImage'):t('clip.hintShot')))}${esc(cacheHint)}</p>`+
    `</div>`+
    `<div class="clip-col clip-col-note">`+
    `<div class="field field-note"><label>${esc(t('clip.note'))}</label><textarea class="f-note" placeholder="${esc(t('clip.notePh'))}">${esc(c.note||'')}</textarea></div>`+
    `<div class="field"><label>${esc(t('clip.layer'))}</label><div class="layer-actions" role="group" aria-label="${esc(t('clip.layerAria'))}">`+
    `<button type="button" class="btn layer-back" title="${esc(t('clip.back'))}">${esc(t('clip.back'))}</button>`+
    `<button type="button" class="btn layer-down" title="${esc(t('clip.down'))}">${esc(t('clip.down'))}</button>`+
    `<button type="button" class="btn layer-up" title="${esc(t('clip.up'))}">${esc(t('clip.up'))}</button>`+
    `<button type="button" class="btn layer-front" title="${esc(t('clip.front'))}">${esc(t('clip.front'))}</button>`+
    `</div></div>`+
    `<div class="actions"><button class="btn success save-card">${esc(t('clip.save'))}</button><button class="btn dup-card" type="button">${esc(t('clip.dup'))}</button>${workspace.boards.length>1?`<select class="btn copy-to-board" aria-label="${esc(t('clip.copyToAria'))}"><option value="">${esc(t('clip.copyTo'))}</option>${workspace.boards.filter(b=>b.id!==workspace.activeId).map(b=>`<option value="${esc(b.id)}">${esc(boardTitle(b.data.caseTitle))}</option>`).join('')}</select>`:''}${c.url?`<button class="btn refresh-preview" type="button">${esc(t('clip.refresh'))}</button><a class="btn open-url" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(t('clip.openUrl'))}</a>`:''}<button class="btn make-link">${esc(t('clip.makeLink'))}</button><button class="btn del-card">${esc(t('clip.delete'))}</button></div>`+
    `</div></div>`;
  const syncKeepVisibleUi=()=>{
    const scaleVal=q(root,'.f-scale')?.value;
    const locked=!isLinkCard(c)&&scaleVal==='世界问题';
    const el=q(root,'.f-keep');
    if(!el)return;
    el.disabled=locked;
    if(locked)el.checked=true;
  };
  q(root,'.f-scale').onchange=syncKeepVisibleUi;
  q(root,'.layer-back').onclick=()=>sendCardToBack(c);
  q(root,'.layer-down').onclick=()=>sendCardBackward(c);
  q(root,'.layer-up').onclick=()=>bringCardForward(c);
  q(root,'.layer-front').onclick=()=>bringCardToFront(c);
  q(root,'.save-card').onclick=()=>{
    if(!flushCardForm(root,c.id))return;
    render();closeClip(key,{save:false});toastMsg(t('toast.saved'));
  };
  q(root,'.dup-card').onclick=()=>{
    const src=flushCardForm(root,c.id);if(!src)return;
    const copy=cloneCardOnto(state,src);
    selected=copy.id;selectedLink=null;clearLinkMode();
    render();openInspector();toastMsg(t('toast.duped'));
  };
  const copyTo=q(root,'.copy-to-board');
  if(copyTo)copyTo.onchange=()=>{
    const targetId=copyTo.value;if(!targetId)return;
    const src=flushCardForm(root,c.id);if(!src){copyTo.value='';return}
    const boardEntry=workspace.boards.find(b=>b.id===targetId);
    if(!boardEntry){copyTo.value='';return}
    cloneCardOnto(boardEntry.data,src);
    save();copyTo.value='';
    toastMsg(t('toast.copiedTo',{name:boardTitle(boardEntry.data.caseTitle)}));
  };
  const refreshBtn=q(root,'.refresh-preview');
  if(refreshBtn)refreshBtn.onclick=()=>{
    delete c.previewCache;
    const rawUrl=q(root,'.f-url')?.value.trim();
    const parsed=tryParseUrl(rawUrl||c.url||'');
    if(parsed)c.url=parsed;
    c.preview=(q(root,'.f-preview')?.value.trim())||'';
    render();openInspector();toastMsg(t('toast.refreshing'));
  };
  q(root,'.make-link').onclick=()=>enterLinkMode(c.id);
  q(root,'.del-card').onclick=()=>{
    state.cards=state.cards.filter(x=>x.id!==c.id);
    state.links=state.links.filter(x=>x.from!==c.id&&x.to!==c.id);
    if(selected===c.id)selected=null;
    selectedLink=null;clearLinkMode();
    closeClip(key,{save:false});render();
  };
}
function selectLink(i){if(i<0||i>=state.links.length)return;selectedLink=i;selected=null;markCards();drawLinks();openLinkInspector()}
function clearLinkSelection(){selectedLink=null;drawLinks()}
function openLinkInspector(){
  const lk=state.links[selectedLink];if(!lk||!clipDetail)return;
  const key=linkClipKey(lk);
  const from=state.cards.find(c=>c.id===lk.from),to=state.cards.find(c=>c.id===lk.to);
  const w=lk.width||state.lineWidth||2,col=lk.color||state.lineColor;
  const win=ensureClipWindow(key,{kind:'link',targetId:selectedLink,heading:t('clip.linkDetail')});
  if(!win)return;
  win.targetId=selectedLink;
  const headingEl=win.paper.querySelector('.clip-heading');
  if(headingEl)headingEl.textContent=t('clip.linkDetail');
  const kicker=win.paper.querySelector('.clip-kicker');
  if(kicker)kicker.textContent=t('clip.kickerLink');
  const closeBtn=win.paper.querySelector('.clip-close');
  if(closeBtn){closeBtn.textContent=t('clip.close');closeBtn.setAttribute('aria-label',t('clip.closeAria'))}
  const root=win.body;
  root.innerHTML=`<p class="empty-note">${esc(from?.title||'?')} → ${esc(to?.title||'?')}</p>`+
    `<div class="clip-layout clip-layout-link">`+
    `<div class="clip-col">`+
    `<div class="field"><label>${esc(t('clip.color'))}</label><div class="swatches l-color">${swatchHtml(col,'link')}</div></div>`+
    `<div class="field"><label>${esc(t('clip.marker'))}</label><select class="l-marker">${MARKERS.map(([v,labelKey])=>`<option value="${v}" ${(lk.marker||'none')===v?'selected':''}>${esc(t(labelKey))}</option>`).join('')}</select></div>`+
    `</div><div class="clip-col">`+
    `<div class="field"><label>${esc(t('clip.width',{n:'‹n›'})).split('‹n›').join(`<span class="l-wval">${w}</span>`)}</label><input type="range" class="l-width" min="1" max="10" value="${w}"></div>`+
    `<div class="actions"><button class="btn link-flip">${esc(t('clip.flip'))}</button><button class="btn primary link-done">${esc(t('clip.done'))}</button><button class="btn link-del">${esc(t('clip.delLink'))}</button></div>`+
    `</div></div>`;
  bindSwatches(q(root,'.l-color'),()=>lk.color||state.lineColor,c=>{lk.color=c;drawLinks();saveNow()});
  q(root,'.l-marker').onchange=e=>{lk.marker=e.target.value;drawLinks();saveNow()};
  const lw=q(root,'.l-width');lw.oninput=e=>{lk.width=+e.target.value;q(root,'.l-wval').textContent=lk.width;drawLinks();saveNow()};
  q(root,'.link-flip').onclick=()=>{
    closeClip(key,{save:false});
    [lk.from,lk.to]=[lk.to,lk.from];
    drawLinks();saveNow();
    openLinkInspector();
  };
  q(root,'.link-done').onclick=()=>{clearLinkSelection();closeClip(key,{save:false})};
  q(root,'.link-del').onclick=()=>{
    const idx=state.links.indexOf(lk);
    if(idx>=0)state.links.splice(idx,1);
    if(selectedLink===idx)selectedLink=null;
    drawLinks();saveNow();closeClip(key,{save:false});toastMsg(t('toast.linkDeleted'));
  };
}
function clearSelection(){
  const had=selected!=null||selectedLink!=null||linking;
  saveAllClipDrafts();
  selected=null;selectedLink=null;linking=null;
  markCards();drawLinks();
  return had;
}
function startPan(e){
  if(e.target.closest('.card')||e.target.classList?.contains('link-hit')||e.target.closest('#clipDetail'))return;
  pan={x:e.clientX,y:e.clientY,cx:camera.x,cy:camera.y,moved:false};
  boardWrap.classList.add('panning');
  window.addEventListener('pointermove',movePan);
  window.addEventListener('pointerup',endPan,{once:true});
}
function movePan(e){
  if(!pan)return;
  if(!pan.moved&&Math.hypot(e.clientX-pan.x,e.clientY-pan.y)<6)return;
  pan.moved=true;
  camera.x=pan.cx+e.clientX-pan.x;camera.y=pan.cy+e.clientY-pan.y;
  applyCamera();
}
function endPan(){
  window.removeEventListener('pointermove',movePan);
  boardWrap.classList.remove('panning');
  if(!pan)return;
  if(!pan.moved)clearSelection();
  else scheduleSave();
  setTimeout(()=>pan=null,0);
}
function setZoom(next,anchor){
  const r=boardWrap.getBoundingClientRect(),point=anchor||{x:r.width/2,y:r.height/2};
  const wx=(point.x-camera.x)/scale,wy=(point.y-camera.y)/scale;
  scale=Math.max(.35,Math.min(1.8,next));
  camera.x=point.x-wx*scale;camera.y=point.y-wy*scale;applyCamera();scheduleSave();
}
function wheelOverClip(e){
  const paper=e.target.closest?.('.clip-paper');
  if(!paper||!clipDetail||clipDetail.hidden)return false;
  e.preventDefault();
  e.stopPropagation();
  const unit=e.deltaMode===1?16:e.deltaMode===2?(paper.clientHeight||100):1;
  const dy=e.deltaY*unit;
  let el=e.target;
  while(el&&el!==clipDetail){
    if(el.scrollHeight>el.clientHeight+1){
      const max=el.scrollHeight-el.clientHeight,next=el.scrollTop+dy;
      if((dy<0&&el.scrollTop>0)||(dy>0&&el.scrollTop<max-.5)){
        el.scrollTop=Math.max(0,Math.min(max,next));
        return true;
      }
    }
    el=el.parentElement;
  }
  if(paper.scrollHeight>paper.clientHeight+1)paper.scrollTop+=dy;
  return true;
}
function wheelZoom(e){
  if(wheelOverClip(e))return;
  e.preventDefault();
  if(drag||pan||!e.deltaY)return;
  const r=boardWrap.getBoundingClientRect();
  const unit=e.deltaMode===1?16:e.deltaMode===2?r.height:1;
  const delta=Math.max(-120,Math.min(120,e.deltaY*unit));
  setZoom(scale*Math.exp(-delta*.002),{x:e.clientX-r.left,y:e.clientY-r.top});
}
boardWrap.addEventListener('wheel',wheelZoom,{passive:false});
if(clipDetail)clipDetail.addEventListener('wheel',wheelOverClip,{passive:false});
const boardPicker=document.querySelector('#boardPicker');
const boardPickerBtn=document.querySelector('#boardPickerBtn');
const boardPickerMenu=document.querySelector('#boardPickerMenu');
const boardPickerList=document.querySelector('#boardPickerList');
const boardPickerLabel=document.querySelector('#boardPickerLabel');
function isBoardPickerOpen(){return !!(boardPickerMenu&&!boardPickerMenu.hidden)}
function setBoardPickerOpen(open){
  if(!boardPickerMenu||!boardPickerBtn)return;
  boardPickerMenu.hidden=!open;
  boardPickerBtn.setAttribute('aria-expanded',String(open));
  if(open)boardPickerList?.querySelector('.board-picker-item.is-current')?.focus();
}
function updateBoardSelect(){
  const active=workspace.boards.find(b=>b.id===workspace.activeId);
  const title=boardTitle(active?.data?.caseTitle);
  if(boardPickerLabel)boardPickerLabel.textContent=title;
  if(boardPickerBtn)boardPickerBtn.title=`${t('toolbar.boards')}: ${title}`;
  if(!boardPickerList)return;
  const onlyOne=workspace.boards.length<=1;
  boardPickerList.replaceChildren();
  workspace.boards.forEach((b,i)=>{
    const row=document.createElement('div');
    row.className=`board-picker-row${b.id===workspace.activeId?' is-active':''}`;
    row.setAttribute('role','presentation');
    const item=document.createElement('button');
    item.type='button';
    item.className=`board-picker-item${b.id===workspace.activeId?' is-current':''}`;
    item.setAttribute('role','option');
    item.setAttribute('aria-selected',String(b.id===workspace.activeId));
    item.dataset.id=b.id;
    const boardName=boardTitle(b.data.caseTitle);
    item.innerHTML=`<span class="board-picker-index">${i+1}</span><span class="board-picker-title">${esc(boardName)}</span>${b.id===workspace.activeId?'<span class="board-picker-check" aria-hidden="true">✓</span>':''}`;
    item.title=b.id===workspace.activeId?t('board.renameHint'):t('board.switchHint');
    item.onclick=()=>{
      if(b.id===workspace.activeId){startBoardRename(b.id,row);return}
      saveDraft();activateBoard(b.id);setBoardPickerOpen(false);
    };
    const del=document.createElement('button');
    del.type='button';
    del.className='board-picker-del';
    del.dataset.id=b.id;
    del.textContent=t('board.delete');
    del.title=onlyOne?t('board.deleteDisabled'):t('board.deleteAria',{name:boardName});
    del.setAttribute('aria-label',t('board.deleteAria',{name:boardName}));
    del.disabled=onlyOne;
    del.onclick=e=>{e.stopPropagation();deleteBoard(b.id)};
    row.append(item,del);
    boardPickerList.appendChild(row);
  });
}
function startBoardRename(id,row){
  const entry=workspace.boards.find(b=>b.id===id);if(!entry)return;
  const editing=boardPickerList?.querySelector('.board-picker-row.is-editing .board-picker-edit');
  if(editing){
    editing.blur();
    row=boardPickerList?.querySelector(`.board-picker-item[data-id="${CSS.escape(id)}"]`)?.closest('.board-picker-row');
  }
  if(!row||row.classList.contains('is-editing'))return;
  row.classList.add('is-editing');
  const item=row.querySelector('.board-picker-item');
  const titleEl=row.querySelector('.board-picker-title');
  const check=row.querySelector('.board-picker-check');
  const del=row.querySelector('.board-picker-del');
  if(!item||!titleEl){row.classList.remove('is-editing');return}
  if(del)del.hidden=true;if(check)check.remove();
  const input=document.createElement('input');
  input.type='text';
  input.className='board-picker-edit';
  input.value=entry.data.caseTitle||'';
  input.placeholder=t('board.untitled');
  input.setAttribute('aria-label',t('board.editName'));
  input.maxLength=80;
  titleEl.replaceWith(input);
  item.onclick=e=>{e.preventDefault();e.stopPropagation()};
  let done=false;
  const finish=commit=>{
    if(done)return;done=true;
    if(commit){
      const title=input.value.trim()||t('board.untitled');
      entry.data.caseTitle=title;
      save();
      toastMsg(t('toast.renamed',{name:title}));
    }
    updateBoardSelect();
  };
  input.addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='Enter'){e.preventDefault();finish(true)}
    else if(e.key==='Escape'){e.preventDefault();finish(false)}
  });
  input.addEventListener('click',e=>e.stopPropagation());
  input.addEventListener('pointerdown',e=>e.stopPropagation());
  input.addEventListener('blur',()=>finish(true));
  queueMicrotask(()=>{input.focus();input.select()});
}
function deleteBoard(id){
  if(workspace.boards.length<=1){toastMsg(t('toast.keepOneBoard'));updateBoardSelect();return}
  const entry=workspace.boards.find(b=>b.id===id);if(!entry)return;
  const name=boardTitle(entry.data.caseTitle);
  if(!confirm(t('board.confirmDelete',{name})))return;
  const idx=workspace.boards.findIndex(b=>b.id===id);
  const wasActive=workspace.activeId===id;
  workspace.boards.splice(idx,1);
  setBoardPickerOpen(false);
  if(wasActive){
    const next=workspace.boards[Math.max(0,idx-1)]||workspace.boards[0];
    activateBoard(next.id);
  }else{
    updateBoardSelect();save();
  }
  toastMsg(t('toast.boardDeleted',{name}));
}
function saveDraft(){saveAllClipDrafts()}
function activateBoard(id){
  const entry=workspace.boards.find(b=>b.id===id);if(!entry)return;
  saveAllClipDrafts();
  closeAllClips({save:false});
  workspace.activeId=id;state=entry.data;state.lineWidth||=2;normalizeLinks(state);ensureCardLayers(state);selected=null;selectedLink=null;linking=null;drag=null;pan=null;
  window.removeEventListener('pointermove',moveDrag);window.removeEventListener('pointermove',movePan);
  boardWrap.classList.remove('panning');
  scale=state.camera?.scale||1;camera={x:state.camera?.x||0,y:state.camera?.y||0};
  leftOpen=narrowScreen.matches?false:state.panels?.left!==false;updatePanels();
  render();updateBoardSelect();boardWrap.focus({preventScroll:true});
}
function newBoardFromText(text=''){
  saveDraft();
  const title=text.trim().split(/\r?\n/).find(line=>line.trim())?.trim().slice(0,40)||t('board.untitled');
  const id=crypto.randomUUID();
  workspace.boards.push({id,data:{caseTitle:title,cards:[],links:[],boardColor:state.boardColor,lineColor:state.lineColor,lineWidth:state.lineWidth||2,camera:{x:0,y:0,scale:1},panels:{left:false,right:false}}});
  setBoardPickerOpen(false);
  activateBoard(id);
  if(text){
    const r=boardWrap.getBoundingClientRect();
    const card={id:crypto.randomUUID(),cardScale:'研究判断',kind:'线索',title,note:text,x:r.width/2-114,y:r.height/2-62,tilt:'0deg',z:nextCardZ(state)};
    state.cards.push(card);selected=card.id;render();openInspector();boardWrap.focus({preventScroll:true});
  }
  toastMsg(text?t('toast.boardNewText'):t('toast.boardNewEmpty'));
}
boardPickerBtn?.addEventListener('click',e=>{e.stopPropagation();setBoardPickerOpen(!isBoardPickerOpen())});
document.querySelector('#newBoard')?.addEventListener('click',()=>{setBoardPickerOpen(false);newBoardFromText()});
document.addEventListener('pointerdown',e=>{if(isBoardPickerOpen()&&boardPicker&&!boardPicker.contains(e.target))setBoardPickerOpen(false)});
document.addEventListener('copy',e=>{
  if(e.target instanceof Element&&(e.target.closest('input,textarea,select')||e.target.isContentEditable))return;
  if(!selected||selectedLink!=null)return;
  const win=selected?openClips.get(cardClipKey(selected)):null;
  const c=win?flushCardForm(win.body,selected):state.cards.find(x=>x.id===selected);
  if(!c)return;
  e.clipboardData.setData('text/plain',cardClipboardText(c));
  e.preventDefault();
  toastMsg(t('toast.cardCopied'));
});
document.addEventListener('paste',e=>{
  if(e.defaultPrevented||e.target instanceof Element&&(e.target.closest('input,textarea,select')||e.target.isContentEditable))return;
  const text=e.clipboardData?.getData('text/plain');if(!text||!text.trim())return;
  const cardData=parseCardClipboard(text);
  if(cardData){e.preventDefault();pasteCardPayload(cardData);return}
  e.preventDefault();
  const url=tryParseUrl(text.trim());
  if(url){addLinkCard(url);return}
  newBoardFromText(text);
});
updateBoardSelect();
function addLinkCard(url=''){
  saveDraft();
  const r=boardWrap.getBoundingClientRect(),parsed=tryParseUrl(url)||'';
  const host=hostOf(parsed)||t('card.webLink');
  const title=parsed&&isImageUrl(parsed)?imageFileName(parsed):host;
  const c={id:crypto.randomUUID(),cardScale:'观察 / 证据',kind:'链接',title,url:parsed,preview:'',note:'',x:(r.width/2-camera.x)/scale-110,y:(r.height/2-camera.y)/scale-105,tilt:(Math.random()>.5?'-1.2deg':'1.2deg'),z:nextCardZ(state)};
  state.cards.push(c);selected=c.id;render();openInspector();
  const fu=openClips.get(cardClipKey(c.id))?.body?.querySelector('.f-url');if(fu){fu.focus();fu.select()}
  toastMsg(parsed?(isImageUrl(parsed)?t('toast.imagePinned'):t('toast.linkPinned')):t('toast.fillUrl'));
}
function add(){let r=boardWrap.getBoundingClientRect(),c={id:crypto.randomUUID(),cardScale:'观察 / 证据',kind:'线索',title:t('card.newLead'),note:t('card.newLeadNote'),x:(r.width/2-camera.x)/scale-71,y:(r.height/2-camera.y)/scale-38,tilt:'0deg',z:nextCardZ(state)};state.cards.push(c);selected=c.id;render();openInspector();const titleEl=openClips.get(cardClipKey(c.id))?.body?.querySelector('.f-title');if(titleEl){titleEl.focus();titleEl.select()}}
function toastMsg(m){toast.textContent=m;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800)}
document.querySelector('#addLinkBtn').onclick=()=>addLinkCard();
document.querySelector('#addBtn').onclick=add;document.querySelector('#linkBtn').onclick=()=>{if(linking){clearLinkMode();toastMsg(t('toast.linkExit'));return}enterLinkMode(selected)};document.querySelector('#zoomIn').onclick=()=>setZoom(Math.min(1.8,+(scale+.1).toFixed(2)));document.querySelector('#zoomOut').onclick=()=>setZoom(Math.max(.35,+(scale-.1).toFixed(2)));document.querySelector('#boardColor').oninput=e=>{state.boardColor=e.target.value;applyStyle();scheduleSave()};document.querySelector('#lineWidth').oninput=e=>{state.lineWidth=+e.target.value;document.querySelector('#lineWidthVal').textContent=state.lineWidth;drawLinks();scheduleSave()};document.querySelector('#fontPreset').onchange=e=>{workspace.settings.font=e.target.value;applyFont();saveNow();toastMsg(t('toast.fontOk'))};boardWrap.addEventListener('pointerdown',startPan);applyFont();applyStaticI18n();refreshLineColorSwatches();render();
document.querySelector('#langPreset')?.addEventListener('change',e=>{
  workspace.settings.lang=CaseboardI18n.normalize(e.target.value);
  applyLang();saveNow();toastMsg(t('toast.langOk'));
});
function refreshOpenClipsLang(){
  const keys=[...openClips.keys()];
  keys.forEach(key=>{
    const win=openClips.get(key);if(!win)return;
    if(win.kind==='card'){
      const prev=selected;selected=win.targetId;openInspector();selected=prev;
    }else{
      const idx=state.links.findIndex(l=>linkClipKey(l)===key);
      if(idx<0)return;
      const prev=selectedLink;selectedLink=idx;openLinkInspector();selectedLink=prev;
    }
  });
}
function applyLang(){
  applyStaticI18n();
  applyFont();
  refreshLineColorSwatches();
  updateBoardSelect();
  save();
  render();
  refreshOpenClipsLang();
}

