const DEFAULT={caseTitle:'关于“AI 与人的位置”',cards:[
 {id:'a',kind:'线索',title:'AI 让“会做”变得廉价',note:'模型能很快生成代码、总结、推导。但这不等于问题已经被解决。',x:94,y:116,tilt:'-1deg'},
 {id:'b',kind:'观察',title:'强者会被更强地放大',note:'领域知识、实验条件、判断力与长期记忆，会决定模型的能力落在哪里。',x:398,y:82,tilt:'1deg'},
 {id:'c',kind:'推断',title:'稀缺的是问题判断',note:'把模糊现象变成可检验、值得解决的问题，仍需要具体的人。',x:691,y:236,tilt:'-1.5deg'},
 {id:'d',kind:'问题',title:'我想成为怎样的人？',note:'不是与模型比赛写代码，而是能让模型在重要问题上变成放大器。',x:266,y:413,tilt:'1.5deg'},
 {id:'e',kind:'下一步',title:'找一个真实的反常现象',note:'从一个让我不服气的系统行为开始观察。',x:654,y:506,tilt:'-1deg'}],links:[['a','b'],['b','c'],['c','d'],['d','e']]};
const workspace=CaseboardStore.load(localStorage,DEFAULT);
workspace.settings||={};workspace.settings.font||='instrument';
let state=workspace.boards.find(b=>b.id===workspace.activeId).data,selected=null,selectedLink=null,linking=null,drag=null,pan=null,scale=1,camera={x:0,y:0};
if(state.boardColor==='#1b2738')state.boardColor='#6a4a32';
state.boardColor ||= '#6a4a32'; state.lineColor ||= '#d95650'; state.lineWidth ||= 2; normalizeLinks(state); ensureCardLayers(state);
state.cards.forEach(c=>c.cardScale ||= (c.kind==='问题'?'世界问题':c.kind==='推断'?'研究判断':(c.kind==='观察'||c.kind==='来源'||c.kind==='下一步')?'观察 / 证据':'机制 / 局部问题'));
if(state.camera){scale=state.camera.scale||1;camera.x=state.camera.x||0;camera.y=state.camera.y||0}
const board=document.querySelector('#board'),stage=document.querySelector('#stage'),boardWrap=document.querySelector('.board-wrap'),svg=document.querySelector('#strings'),toast=document.querySelector('#toast');
const app=document.querySelector('.app'),sidebar=document.querySelector('#sidebar');
const clipDetail=document.querySelector('#clipDetail'),clipPaper=document.querySelector('#clipPaper'),clipContent=document.querySelector('#clipContent');
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
  if(isClipOpen()){if(selected)saveDraft();hideClip();return}
  if(selected)openInspector();
  else if(selectedLink!=null)openLinkInspector();
  else toastMsg('先点一张卡片或连线。');
};
document.querySelector('#closeClip').onclick=()=>dismissClip();
if(clipPaper)clipPaper.addEventListener('pointerdown',e=>e.stopPropagation());
narrowScreen.addEventListener('change',()=>{if(narrowScreen.matches)leftOpen=false;else leftOpen=state.panels?.left!==false;updatePanels();if(isClipOpen())positionClipNearSelection()});
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
  if(isClipOpen()||selected!=null||selectedLink!=null||linking){e.preventDefault();dismissClip()}
});
const typeColor={线索:'#e5b55c',来源:'#77b7d5',观察:'#77b7d5',推断:'#c68bf1',问题:'#ff7168',下一步:'#ff7168',链接:'#5a9f78'};
const scaleClass={'世界问题':'world','研究判断':'research','机制 / 局部问题':'mechanism','观察 / 证据':'evidence'};
window.addEventListener('resize',()=>{drawLinks();if(typeof isClipOpen==='function'&&isClipOpen())positionClipNearSelection()});
const cardDimensions={world:[286,154],research:[228,123],mechanism:[185,104],evidence:[142,76],link:[220,210]};
const CARD_FIT_MAX_CHARS=200,CARD_FIT_W=[128,286],CARD_FIT_MIN_H=[58,154];
function cardTextLen(c){return String(c?.title||'').length+String(c?.note||'').length}
function fitCardStyle(c){
  if(isLinkCard(c))return {width:220,minHeight:0};
  const t=Math.min(1,cardTextLen(c)/CARD_FIT_MAX_CHARS);
  return {
    width:Math.round(CARD_FIT_W[0]+(CARD_FIT_W[1]-CARD_FIT_W[0])*t),
    minHeight:Math.round(CARD_FIT_MIN_H[0]+(CARD_FIT_MIN_H[1]-CARD_FIT_MIN_H[0])*t)
  };
}
const esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MARKERS=[['none','无'],['arrow','箭头'],['dot','圆点'],['diamond','菱形'],['bar','短杠']];
const LINK_COLORS=[
  ['#d95650','红'],['#e5b55c','金'],['#77b7d5','蓝'],['#c68bf1','紫'],
  ['#5ecf8e','绿'],['#ff8a5b','橙'],['#f0e6d2','米'],['#8e98a9','灰']
];
const FONT_PRESETS={
  instrument:{
    label:'精致 · Instrument',
    sans:'"Instrument Sans","PingFang SC","Hiragino Sans GB","Noto Sans SC",ui-sans-serif,system-ui,sans-serif',
    serif:'"Instrument Serif","Songti SC","Noto Serif SC",Georgia,serif'
  },
  classic:{
    label:'经典 · 系统',
    sans:'ui-sans-serif,system-ui,"PingFang SC","Hiragino Sans GB",sans-serif',
    serif:'Georgia,"Songti SC","Noto Serif SC",serif'
  },
  news:{
    label:'报纸 · 衬线',
    sans:'"Instrument Sans","PingFang SC",ui-sans-serif,sans-serif',
    serif:'Georgia,"Iowan Old Style","Songti SC","Noto Serif SC",serif'
  },
  rounded:{
    label:'圆润 · 圆角',
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
  if(!quiet)toastMsg('已置于顶层。');
}
function sendCardToBack(c){
  if(!c)return;
  const min=Math.min(...state.cards.map(cardZ));
  c.z=min-1;applyCardLayers();saveNow();toastMsg('已置于底层。');
}
function bringCardForward(c){
  if(!c)return;
  const above=state.cards.filter(x=>x!==c&&cardZ(x)>cardZ(c)).sort((a,b)=>cardZ(a)-cardZ(b))[0];
  if(!above){bringCardToFront(c);return}
  const t=cardZ(c);c.z=cardZ(above);above.z=t;applyCardLayers();saveNow();toastMsg('已上移一层。');
}
function sendCardBackward(c){
  if(!c)return;
  const below=state.cards.filter(x=>x!==c&&cardZ(x)<cardZ(c)).sort((a,b)=>cardZ(b)-cardZ(a))[0];
  if(!below){sendCardToBack(c);return}
  const t=cardZ(c);c.z=cardZ(below);below.z=t;applyCardLayers();saveNow();toastMsg('已下移一层。');
}
function tryParseUrl(text){
  const s=String(text||'').trim();if(!s||/\s/.test(s))return null;
  try{const u=new URL(/^https?:\/\//i.test(s)?s:'https://'+s);if(!/^https?:$/i.test(u.protocol)||!u.hostname.includes('.'))return null;return u.href}catch{return null}
}
function hostOf(url){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return ''}}
function faviconOf(url){const h=hostOf(url);return h?`https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=128`:''}
function shotOf(url){return `https://mini.s-shot.ru/1024x768/JPEG/480/Z100/?${encodeURIComponent(url)}`}
function isLinkCard(c){return !!(c&&(c.url||c.kind==='链接'))}
const PREVIEW_MAX_DIM=720,PREVIEW_JPEG_Q=.7,PREVIEW_MAX_CHARS=180000;
function previewPick(c){
  if(c.preview)return {src:c.preview,stage:'user'};
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
  if(stage==='user'){
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
    ph.innerHTML='<span>预览不可用</span>';
    wrap.insertBefore(ph,wrap.firstChild);
  }
}
function cardFaceHtml(c){
  if(!isLinkCard(c))return `<div class="kind">${esc(c.cardScale)} · ${esc(c.kind)}</div><div class="title">${esc(c.title||'无标题')}</div><div class="excerpt">${esc(c.note||'')}</div>`;
  const url=c.url||'',host=hostOf(url),fav=faviconOf(url),pick=previewPick(c);
  const hostLabel=host||'未填写网址',title=c.title||host||'网页链接',note=c.note||'';
  const kindExtra=c.kind&&c.kind!=='链接'?` · ${esc(c.kind)}`:'';
  const chip=`<div class="link-chip">${fav?`<img src="${esc(fav)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"/>`:''}<span>${esc(hostLabel)}</span></div>`;
  let media;
  if(pick.src){
    const cors=pick.src.startsWith('data:')?'':' crossorigin="anonymous"';
    media=`<div class="link-shot-wrap" data-state="loading"><img class="link-shot" src="${esc(pick.src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"${cors} data-stage="${esc(pick.stage)}" data-fav="${esc(fav)}" onerror="linkShotErr(this)" onload="linkShotLoad(this)"/>${chip}</div>`;
  }else if(fav){
    media=`<div class="link-shot-wrap" data-state="icon"><img class="link-shot fallback" src="${esc(fav)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-stage="fav" onerror="linkShotErr(this)"/>${chip}</div>`;
  }else{
    media=`<div class="link-shot-wrap" data-state="empty"><div class="link-shot-ph"><span>粘贴网址以显示预览</span></div>${chip}</div>`;
  }
  return `${media}<div class="link-body"><div class="kind">链接剪报${kindExtra}</div><div class="title">${esc(title)}</div><div class="excerpt${note?'':' is-ph'}">${esc(note||'写一句批注…')}</div></div>`;
}
function markerDefs(color,prefix='mk'){return (
  `<marker id="${prefix}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="${color}"/></marker>`+
  `<marker id="${prefix}-dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse"><circle cx="5" cy="5" r="4.5" fill="${color}"/></marker>`+
  `<marker id="${prefix}-diamond" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path d="M5,0L10,5L5,10L0,5z" fill="${color}"/></marker>`+
  `<marker id="${prefix}-bar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto"><rect x="3.5" y="0" width="3" height="10" fill="${color}"/></marker>`
)}
function colorKey(c){return String(c||'').replace('#','').toLowerCase()}
function swatchHtml(active,name){
  return LINK_COLORS.map(([c,label])=>`<button type="button" class="swatch${colorKey(c)===colorKey(active)?' on':''}" data-color="${c}" data-swatch="${name}" style="--c:${c}" title="${label}" aria-label="${label}" aria-pressed="${colorKey(c)===colorKey(active)}"></button>`).join('')
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
function save(){state.panels={left:leftOpen,right:false};state.camera={x:camera.x,y:camera.y,scale};try{CaseboardStore.save(localStorage,workspace);document.querySelector('#storageError').hidden=true}catch(error){document.querySelector('#storageError').hidden=false;document.querySelector('#storageError').textContent='本地保存失败，可能是存储空间已满（预览缓存也会占空间）。请保留当前页面，勿刷新或关闭。'}document.querySelector('#caseTitle').textContent=state.caseTitle;document.querySelector('#count').textContent=`${state.cards.length} 张卡片`;const bl=document.querySelector('#boardPickerLabel');if(bl)bl.textContent=state.caseTitle||'未命名板子'}
let saveTimer=0;
function scheduleSave(ms=320){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveTimer=0;save()},ms)}
function saveNow(){clearTimeout(saveTimer);saveTimer=0;save()}
const LOD_WORLD=.4,BUBBLE_SIZE=[14,14];
function isWorldCard(c){return !!(c&&!isLinkCard(c)&&c.cardScale==='世界问题')}
function shouldBubble(c){return scale<LOD_WORLD&&!isWorldCard(c)&&!c?.keepVisible}
function cardSizeKey(c){return isLinkCard(c)?'link':(scaleClass[c.cardScale]||'mechanism')}
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
function render(){board.querySelectorAll('.card').forEach(e=>e.remove());document.querySelector('#empty').hidden=state.cards.length>0;ensureCardLayers(state);[...state.cards].sort((a,b)=>cardZ(a)-cardZ(b)).forEach(c=>{let e=document.createElement('article');const link=isLinkCard(c);const fit=fitCardStyle(c);e.className=`card fit ${link?'link':(scaleClass[c.cardScale]||'mechanism')}`;e.dataset.id=c.id;e.style.cssText=`left:${c.x}px;top:${c.y}px;--tilt:${c.tilt||'0deg'};--type:${typeColor[c.kind]||(link?'#5a9f78':'#e5b55c')};width:${fit.width}px;min-height:${fit.minHeight||0}px;height:auto;z-index:${cardZ(c)}`;e.innerHTML=`<button class="pin" aria-label="从这张卡片连线" title="从这里连线"></button>${cardFaceHtml(c)}`;e.addEventListener('pointerdown',startDrag);e.addEventListener('click',clickCard);let pin=e.querySelector('.pin');pin.addEventListener('pointerdown',x=>x.stopPropagation());pin.addEventListener('click',x=>{x.stopPropagation();enterLinkMode(c.id)});board.appendChild(e)});markCards();applyStyle();drawLinks();scheduleSave()}
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
function enterLinkMode(id){hideClip();linking=id||'choose-source';markCards();toastMsg(id?'现在点另一张卡片，红线会自动钉上。':'先点起点，再点终点。')}
function clearLinkMode(){linking=null;markCards()}
function clickCard(e){if(drag?.moved)return;if(selectedLink!=null){selectedLink=null;drawLinks()}let id=e.currentTarget.dataset.id;if(linking==='choose-source'){selected=id;linking=id;markCards();hideClip();toastMsg('已选起点；再点一张卡片即可连线。');return}if(linking&&linking!==id){if(!state.links.some(x=>x.from===linking&&x.to===id))state.links.push({from:linking,to:id,marker:'none',width:state.lineWidth,color:state.lineColor});selected=id;clearLinkMode();drawLinks();save();hideClip();toastMsg('红线已钉上。');return}if(linking){hideClip();return}selected=id;markCards();openInspector()}
function isClipOpen(){return !!(clipDetail&&!clipDetail.hidden&&clipDetail.classList.contains('is-open'))}
function animClipPaper(){
  if(!clipPaper||window.matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  clipPaper.classList.remove('is-animating');
  void clipPaper.offsetWidth;
  clipPaper.classList.add('is-animating');
}
const CLIP_PAPER_W=720;
function positionClipNearSelection(){
  if(!clipPaper||!clipDetail||clipDetail.hidden)return;
  clipPaper.classList.remove('anchored');
  clipPaper.style.left='';clipPaper.style.top='';clipPaper.style.right='';clipPaper.style.bottom='';clipPaper.style.width='';clipPaper.style.transform='';
  if(narrowScreen.matches)return;
  const el=selected?board.querySelector(`.card[data-id="${CSS.escape(selected)}"]`):null;
  const br=boardWrap.getBoundingClientRect();
  const pad=14,pw=Math.min(CLIP_PAPER_W,br.width-pad*2);
  if(!el){
    clipPaper.style.left='50%';clipPaper.style.top='50%';clipPaper.style.width=pw+'px';
    clipPaper.style.transform='translate(-50%,-50%) rotate(-.6deg)';
    return;
  }
  const cr=el.getBoundingClientRect();
  let left=cr.right-br.left+16;
  let top=cr.top-br.top-12;
  if(left+pw>br.width-pad)left=cr.left-br.left-pw-16;
  if(left<pad)left=pad;
  clipPaper.classList.add('anchored');
  clipPaper.style.left=left+'px';clipPaper.style.top=Math.max(pad,top)+'px';clipPaper.style.width=pw+'px';clipPaper.style.transform='none';
  requestAnimationFrame(()=>{
    const ph=clipPaper.offsetHeight,maxTop=Math.max(pad,br.height-pad-ph);
    let t=parseFloat(clipPaper.style.top)||pad;
    if(t>maxTop)clipPaper.style.top=maxTop+'px';
  });
}
function showClip(){
  if(!clipDetail)return;
  clipDetail.hidden=false;
  clipDetail.classList.add('is-open');
  clipDetail.setAttribute('aria-hidden','false');
  positionClipNearSelection();
  animClipPaper();
  syncDetailToggle();
}
function hideClip(){
  if(!clipDetail||clipDetail.hidden)return;
  clipDetail.classList.remove('is-open');
  clipDetail.hidden=true;
  clipDetail.setAttribute('aria-hidden','true');
  if(clipContent)clipContent.innerHTML='';
  if(clipPaper){clipPaper.classList.remove('anchored','is-animating');clipPaper.style.left=clipPaper.style.top=clipPaper.style.width=clipPaper.style.transform=''}
  syncDetailToggle();
}
function dismissClip(){
  if(selected)saveDraft();
  selected=null;selectedLink=null;linking=null;
  markCards();drawLinks();
  hideClip();
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
function flushCardForm(){
  const c=state.cards.find(x=>x.id===selected);if(!c)return null;
  if(!document.querySelector('#ftitle'))return c;
  const prevUrl=c.url,prevPreview=c.preview;
  c.cardScale=document.querySelector('#fscale').value;c.kind=document.querySelector('#fkind').value;
  c.title=document.querySelector('#ftitle').value.trim()||'无标题';
  const rawUrl=document.querySelector('#furl').value.trim();
  c.url=tryParseUrl(rawUrl)||'';
  if(!c.url&&rawUrl)toastMsg('请填写以 http(s) 开头的有效网址。');
  c.preview=document.querySelector('#fpreview').value.trim();
  c.note=document.querySelector('#fnote').value.trim();
  const keepEl=document.querySelector('#fkeepVisible');
  if(keepEl&&!keepEl.disabled)c.keepVisible=!!keepEl.checked;
  if(c.url!==prevUrl||c.preview!==prevPreview)delete c.previewCache;
  if(c.url&&c.kind!=='链接'&&!['来源','线索'].includes(c.kind))c.kind='链接';
  if(c.url&&(!c.title||c.title==='无标题'))c.title=hostOf(c.url)||'网页链接';
  return c;
}
function pasteCardPayload(data){
  const seed={...data,id:'tmp',x:data.x??0,y:data.y??0};
  const card=cloneCardOnto(state,seed);
  selected=card.id;selectedLink=null;clearLinkMode();
  render();openInspector();
  toastMsg('已粘贴到当前板子。');
}
function openInspector(){
  let c=state.cards.find(x=>x.id===selected);if(!c||!clipContent)return;
  const kinds=['线索','链接','来源','观察','推断','问题','下一步'];
  const heading=isLinkCard(c)?'链接剪报':'线索详情';
  const cacheHint=c.previewCache?'已缓存本地预览。':'截图成功后会压缩缓存到本机。';
  const worldLocked=isWorldCard(c);
  const pick=previewPick(c);
  const fav=faviconOf(c.url||'');
  const previewHtml=c.url||c.preview||c.previewCache
    ?`<div class="clip-preview">${pick.src
      ?`<img src="${esc(pick.src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"${pick.stage==='live'?' crossorigin="anonymous"':''} data-stage="${esc(pick.stage)}" data-fav="${esc(fav)}" onerror="this.classList.add('is-fallback');this.src=this.dataset.fav||'';this.onerror=null" />`
      :`<div class="clip-preview-empty">暂无预览</div>`}</div>`
    :'';
  clipContent.innerHTML=`<p class="clip-kicker">Caseboard · 剪报</p><h2 id="clipHeading">${heading}</h2>${linking?'<div class="connection-help">连线模式已开启：点另一张卡片即可自动建立关系。</div>':''}`+
    `<div class="clip-layout">`+
    `<div class="clip-col clip-col-meta">`+
    previewHtml+
    `<div class="field-row">`+
    `<div class="field"><label>思想尺度</label><select id="fscale">${['世界问题','研究判断','机制 / 局部问题','观察 / 证据'].map(x=>`<option ${x===c.cardScale?'selected':''}>${x}</option>`).join('')}</select></div>`+
    `<div class="field"><label>类型</label><select id="fkind">${kinds.map(x=>`<option ${x===c.kind?'selected':''}>${x}</option>`).join('')}</select></div>`+
    `</div>`+
    `<div class="field check"><label><input type="checkbox" id="fkeepVisible" ${c.keepVisible||worldLocked?'checked':''} ${worldLocked?'disabled':''} /> 缩小时保持完整</label></div>`+
    `<p class="hint">${worldLocked?'「世界问题」缩小时始终保持完整。':'约 40% 以下勾选后仍显示完整卡片。'}</p>`+
    `<div class="field"><label>标题</label><input id="ftitle" value="${esc(c.title||'')}" /></div>`+
    `<div class="field"><label>网址</label><input id="furl" type="url" placeholder="https://example.com/…" value="${esc(c.url||'')}" /></div>`+
    `<div class="field"><label>封面 / 预览图（可选）</label><input id="fpreview" type="url" placeholder="自备封面图 URL，覆盖自动预览" value="${esc(c.preview||'')}" /></div>`+
    `<p class="hint">${c.preview?'当前用自备封面。':'填网址后自动截图；失败则显示站点图标。'}${cacheHint}</p>`+
    `</div>`+
    `<div class="clip-col clip-col-note">`+
    `<div class="field field-note"><label>批注</label><textarea id="fnote" placeholder="这则剪报和当前推理有什么关系？">${esc(c.note||'')}</textarea></div>`+
    `<div class="field"><label>叠放层级</label><div class="layer-actions" role="group" aria-label="叠放层级">`+
    `<button type="button" class="btn" id="layerBack" title="置于底层">置底</button>`+
    `<button type="button" class="btn" id="layerDown" title="下移一层">下移</button>`+
    `<button type="button" class="btn" id="layerUp" title="上移一层">上移</button>`+
    `<button type="button" class="btn" id="layerFront" title="置于顶层">置顶</button>`+
    `</div></div>`+
    `<div class="actions"><button class="btn success" id="saveCard">保存</button><button class="btn" id="dupCard" type="button">复制</button>${workspace.boards.length>1?`<select id="copyToBoard" class="btn" aria-label="复制到其他板子"><option value="">复制到其他板子…</option>${workspace.boards.filter(b=>b.id!==workspace.activeId).map(b=>`<option value="${esc(b.id)}">${esc(b.data.caseTitle||'未命名板子')}</option>`).join('')}</select>`:''}${c.url?`<button class="btn" id="refreshPreview" type="button">刷新预览</button><a class="btn" id="openUrl" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">打开网页</a>`:''}<button class="btn" id="makeLink">从这里连线</button><button class="btn" id="delCard">删除</button></div>`+
    `</div></div>`;
  showClip();
  const syncKeepVisibleUi=()=>{
    const scaleVal=document.querySelector('#fscale')?.value;
    const locked=!isLinkCard(c)&&scaleVal==='世界问题';
    const el=document.querySelector('#fkeepVisible');
    if(!el)return;
    el.disabled=locked;
    if(locked)el.checked=true;
  };
  document.querySelector('#fscale').onchange=syncKeepVisibleUi;
  document.querySelector('#layerBack').onclick=()=>sendCardToBack(c);
  document.querySelector('#layerDown').onclick=()=>sendCardBackward(c);
  document.querySelector('#layerUp').onclick=()=>bringCardForward(c);
  document.querySelector('#layerFront').onclick=()=>bringCardToFront(c);
  document.querySelector('#saveCard').onclick=()=>{
    if(!flushCardForm())return;
    render();dismissClip();toastMsg('已保存。');
  };
  document.querySelector('#dupCard').onclick=()=>{
    const src=flushCardForm();if(!src)return;
    const copy=cloneCardOnto(state,src);
    selected=copy.id;selectedLink=null;clearLinkMode();
    render();openInspector();toastMsg('已在本板复制。');
  };
  const copyTo=document.querySelector('#copyToBoard');
  if(copyTo)copyTo.onchange=()=>{
    const targetId=copyTo.value;if(!targetId)return;
    const src=flushCardForm();if(!src){copyTo.value='';return}
    const board=workspace.boards.find(b=>b.id===targetId);
    if(!board){copyTo.value='';return}
    cloneCardOnto(board.data,src);
    save();copyTo.value='';
    toastMsg(`已复制到「${board.data.caseTitle||'未命名板子'}」。`);
  };
  const refreshBtn=document.querySelector('#refreshPreview');
  if(refreshBtn)refreshBtn.onclick=()=>{
    delete c.previewCache;
    const rawUrl=document.querySelector('#furl')?.value.trim();
    const parsed=tryParseUrl(rawUrl||c.url||'');
    if(parsed)c.url=parsed;
    c.preview=(document.querySelector('#fpreview')?.value.trim())||'';
    render();openInspector();toastMsg('正在重新抓取预览…');
  };
  document.querySelector('#makeLink').onclick=()=>enterLinkMode(c.id);
  document.querySelector('#delCard').onclick=()=>{state.cards=state.cards.filter(x=>x.id!==c.id);state.links=state.links.filter(x=>x.from!==c.id&&x.to!==c.id);selected=null;selectedLink=null;clearLinkMode();hideClip();render()};
}
function selectLink(i){if(i<0||i>=state.links.length)return;selectedLink=i;selected=null;markCards();drawLinks();openLinkInspector()}
function clearLinkSelection(){selectedLink=null;drawLinks();if(!selected)hideClip()}
function openLinkInspector(){
  const lk=state.links[selectedLink];if(!lk||!clipContent)return;
  const from=state.cards.find(c=>c.id===lk.from),to=state.cards.find(c=>c.id===lk.to);
  const w=lk.width||state.lineWidth||2,col=lk.color||state.lineColor;
  clipContent.innerHTML=`<p class="clip-kicker">Caseboard · 连线</p><h2 id="clipHeading">连线详情</h2>`+
    `<p class="empty-note">${esc(from?.title||'?')} → ${esc(to?.title||'?')}</p>`+
    `<div class="clip-layout clip-layout-link">`+
    `<div class="clip-col">`+
    `<div class="field"><label>颜色</label><div class="swatches" id="lcolor">${swatchHtml(col,'link')}</div></div>`+
    `<div class="field"><label>标志</label><select id="lmarker">${MARKERS.map(([v,t])=>`<option value="${v}" ${(lk.marker||'none')===v?'selected':''}>${t}</option>`).join('')}</select></div>`+
    `</div><div class="clip-col">`+
    `<div class="field"><label>粗细 (<span id="lwval">${w}</span> px)</label><input type="range" id="lwidth" min="1" max="10" value="${w}"></div>`+
    `<div class="actions"><button class="btn" id="linkFlip">调换方向</button><button class="btn primary" id="linkDone">完成</button><button class="btn" id="linkDel">删除连线</button></div>`+
    `</div></div>`;
  showClip();
  bindSwatches(document.querySelector('#lcolor'),()=>lk.color||state.lineColor,c=>{lk.color=c;drawLinks();saveNow()});
  document.querySelector('#lmarker').onchange=e=>{lk.marker=e.target.value;drawLinks();saveNow()};
  const lw=document.querySelector('#lwidth');lw.oninput=e=>{lk.width=+e.target.value;document.querySelector('#lwval').textContent=lk.width;drawLinks();saveNow()};
  document.querySelector('#linkFlip').onclick=()=>{[lk.from,lk.to]=[lk.to,lk.from];drawLinks();saveNow();openLinkInspector()};
  document.querySelector('#linkDone').onclick=()=>{clearLinkSelection();hideClip()};
  document.querySelector('#linkDel').onclick=()=>{state.links.splice(selectedLink,1);selectedLink=null;drawLinks();saveNow();hideClip();toastMsg('连线已删除。')};
}
function clearSelection(){
  const had=selected!=null||selectedLink!=null||linking||isClipOpen();
  if(selected)saveDraft();
  selected=null;selectedLink=null;linking=null;
  markCards();drawLinks();
  hideClip();
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
  const over=e.target.closest?.('#clipDetail');
  if(!over||over.hidden)return false;
  e.preventDefault();
  e.stopPropagation();
  const unit=e.deltaMode===1?16:e.deltaMode===2?(clipPaper?.clientHeight||100):1;
  const dy=e.deltaY*unit;
  let el=e.target;
  while(el&&el!==over){
    if(el.scrollHeight>el.clientHeight+1){
      const max=el.scrollHeight-el.clientHeight,next=el.scrollTop+dy;
      if((dy<0&&el.scrollTop>0)||(dy>0&&el.scrollTop<max-.5)){
        el.scrollTop=Math.max(0,Math.min(max,next));
        return true;
      }
    }
    el=el.parentElement;
  }
  if(clipPaper&&clipPaper.scrollHeight>clipPaper.clientHeight+1)clipPaper.scrollTop+=dy;
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
  const title=active?.data?.caseTitle||'未命名板子';
  if(boardPickerLabel)boardPickerLabel.textContent=title;
  if(boardPickerBtn)boardPickerBtn.title=`当前板子：${title}`;
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
    const boardName=b.data.caseTitle||'未命名板子';
    item.innerHTML=`<span class="board-picker-index">${i+1}</span><span class="board-picker-title">${esc(boardName)}</span>${b.id===workspace.activeId?'<span class="board-picker-check" aria-hidden="true">✓</span>':''}`;
    item.title=b.id===workspace.activeId?'再点一次可重命名':'切换到这块板子';
    item.onclick=()=>{
      if(b.id===workspace.activeId){startBoardRename(b.id,row);return}
      saveDraft();activateBoard(b.id);setBoardPickerOpen(false);
    };
    const del=document.createElement('button');
    del.type='button';
    del.className='board-picker-del';
    del.dataset.id=b.id;
    del.textContent='删除';
    del.title=onlyOne?'至少保留一块板子':'删除这块板子';
    del.setAttribute('aria-label',`删除板子「${boardName}」`);
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
  input.placeholder='未命名板子';
  input.setAttribute('aria-label','编辑板子名称');
  input.maxLength=80;
  titleEl.replaceWith(input);
  item.onclick=e=>{e.preventDefault();e.stopPropagation()};
  let done=false;
  const finish=commit=>{
    if(done)return;done=true;
    if(commit){
      const title=input.value.trim()||'未命名板子';
      entry.data.caseTitle=title;
      save();
      toastMsg(`已重命名为「${title}」。`);
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
  if(workspace.boards.length<=1){toastMsg('至少保留一块板子。');updateBoardSelect();return}
  const entry=workspace.boards.find(b=>b.id===id);if(!entry)return;
  const name=entry.data.caseTitle||'未命名板子';
  if(!confirm(`确定删除板子「${name}」？\n板上的卡片与连线都会一并删除，此操作无法撤销。`))return;
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
  toastMsg(`已删除「${name}」。`);
}
function saveDraft(){
  const c=state.cards.find(c=>c.id===selected),title=document.querySelector('#ftitle');
  if(c&&title){
    c.title=title.value.trim()||'无标题';c.note=document.querySelector('#fnote').value;c.kind=document.querySelector('#fkind').value;c.cardScale=document.querySelector('#fscale').value;
    const fu=document.querySelector('#furl'),fp=document.querySelector('#fpreview'),fk=document.querySelector('#fkeepVisible');
    if(fu){const raw=fu.value.trim();c.url=tryParseUrl(raw)||raw}
    if(fp)c.preview=fp.value.trim();
    if(fk&&!fk.disabled)c.keepVisible=!!fk.checked;
  }
  save();
}
function activateBoard(id){
  const entry=workspace.boards.find(b=>b.id===id);if(!entry)return;
  workspace.activeId=id;state=entry.data;state.lineWidth||=2;normalizeLinks(state);ensureCardLayers(state);selected=null;selectedLink=null;linking=null;drag=null;pan=null;
  window.removeEventListener('pointermove',moveDrag);window.removeEventListener('pointermove',movePan);
  boardWrap.classList.remove('panning');
  scale=state.camera?.scale||1;camera={x:state.camera?.x||0,y:state.camera?.y||0};
  leftOpen=narrowScreen.matches?false:state.panels?.left!==false;updatePanels();
  hideClip();
  render();updateBoardSelect();boardWrap.focus({preventScroll:true});
}
function newBoardFromText(text=''){
  saveDraft();
  const title=text.trim().split(/\r?\n/).find(line=>line.trim())?.trim().slice(0,40)||'未命名板子';
  const id=crypto.randomUUID();
  workspace.boards.push({id,data:{caseTitle:title,cards:[],links:[],boardColor:state.boardColor,lineColor:state.lineColor,lineWidth:state.lineWidth||2,camera:{x:0,y:0,scale:1},panels:{left:false,right:false}}});
  setBoardPickerOpen(false);
  activateBoard(id);
  if(text){
    const r=boardWrap.getBoundingClientRect();
    const card={id:crypto.randomUUID(),cardScale:'研究判断',kind:'线索',title,note:text,x:r.width/2-114,y:r.height/2-62,tilt:'0deg',z:nextCardZ(state)};
    state.cards.push(card);selected=card.id;render();openInspector();boardWrap.focus({preventScroll:true});
  }
  toastMsg(text?'已新建板子，全文已放入卡片。':'已新建空白板子。');
}
boardPickerBtn?.addEventListener('click',e=>{e.stopPropagation();setBoardPickerOpen(!isBoardPickerOpen())});
document.querySelector('#newBoard')?.addEventListener('click',()=>{setBoardPickerOpen(false);newBoardFromText()});
document.addEventListener('pointerdown',e=>{if(isBoardPickerOpen()&&boardPicker&&!boardPicker.contains(e.target))setBoardPickerOpen(false)});
document.addEventListener('copy',e=>{
  if(e.target instanceof Element&&(e.target.closest('input,textarea,select')||e.target.isContentEditable))return;
  if(!selected||selectedLink!=null)return;
  const c=isClipOpen()?flushCardForm():state.cards.find(x=>x.id===selected);
  if(!c)return;
  e.clipboardData.setData('text/plain',cardClipboardText(c));
  e.preventDefault();
  toastMsg('已复制卡片，可在本板或其他板粘贴。');
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
  const host=hostOf(parsed)||'网页链接';
  const c={id:crypto.randomUUID(),cardScale:'观察 / 证据',kind:'链接',title:host,url:parsed,preview:'',note:'',x:(r.width/2-camera.x)/scale-110,y:(r.height/2-camera.y)/scale-105,tilt:(Math.random()>.5?'-1.2deg':'1.2deg'),z:nextCardZ(state)};
  state.cards.push(c);selected=c.id;render();openInspector();
  const fu=document.querySelector('#furl');if(fu){fu.focus();fu.select()}
  toastMsg(parsed?'已钉上一张链接剪报。':'填写网址，保存后会显示预览。');
}
function add(){let r=boardWrap.getBoundingClientRect(),c={id:crypto.randomUUID(),cardScale:'观察 / 证据',kind:'线索',title:'新线索',note:'它让我想到什么？证据是什么？',x:(r.width/2-camera.x)/scale-71,y:(r.height/2-camera.y)/scale-38,tilt:'0deg',z:nextCardZ(state)};state.cards.push(c);selected=c.id;render();openInspector();document.querySelector('#ftitle').focus();document.querySelector('#ftitle').select()}
function toastMsg(m){toast.textContent=m;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800)}
document.querySelector('#addLinkBtn').onclick=()=>addLinkCard();
document.querySelector('#addBtn').onclick=add;document.querySelector('#linkBtn').onclick=()=>{if(linking){clearLinkMode();toastMsg('已退出连线模式。');return}enterLinkMode(selected)};document.querySelector('#zoomIn').onclick=()=>setZoom(Math.min(1.8,+(scale+.1).toFixed(2)));document.querySelector('#zoomOut').onclick=()=>setZoom(Math.max(.35,+(scale-.1).toFixed(2)));document.querySelector('#boardColor').oninput=e=>{state.boardColor=e.target.value;applyStyle();scheduleSave()};document.querySelector('#lineWidth').oninput=e=>{state.lineWidth=+e.target.value;document.querySelector('#lineWidthVal').textContent=state.lineWidth;drawLinks();scheduleSave()};document.querySelector('#fontPreset').onchange=e=>{workspace.settings.font=e.target.value;applyFont();saveNow();toastMsg('字体已更新。')};boardWrap.addEventListener('pointerdown',startPan);applyFont();refreshLineColorSwatches();render();

