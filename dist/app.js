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
state.boardColor ||= '#6a4a32'; state.lineColor ||= '#d95650'; state.lineWidth ||= 2; normalizeLinks(state);
state.cards.forEach(c=>c.cardScale ||= (c.kind==='问题'?'世界问题':c.kind==='推断'?'研究判断':(c.kind==='观察'||c.kind==='来源'||c.kind==='下一步')?'观察 / 证据':'机制 / 局部问题'));
if(state.camera){scale=state.camera.scale||1;camera.x=state.camera.x||0;camera.y=state.camera.y||0}
const board=document.querySelector('#board'),stage=document.querySelector('#stage'),boardWrap=document.querySelector('.board-wrap'),svg=document.querySelector('#strings'),inspector=document.querySelector('#inspector'),toast=document.querySelector('#toast');
const app=document.querySelector('.app'),sidebar=document.querySelector('#sidebar'),inspectorContent=document.querySelector('#inspectorContent');
const narrowScreen=window.matchMedia('(max-width:900px)');
let leftOpen=narrowScreen.matches?false:state.panels?.left!==false,rightOpen=narrowScreen.matches?false:state.panels?.right!==false;
function updatePanels(){
  sidebar.hidden=!leftOpen;
  inspector.removeAttribute('hidden');
  inspector.setAttribute('aria-hidden',String(!rightOpen));
  app.classList.toggle('left-collapsed',!leftOpen);app.classList.toggle('right-collapsed',!rightOpen);
  document.querySelector('#toggleSidebar').setAttribute('aria-expanded',String(leftOpen));
  document.querySelector('#toggleInspector').setAttribute('aria-expanded',String(rightOpen));
}
function animInspectorContent(){
  if(window.matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  inspectorContent.classList.remove('content-pop');
  void inspectorContent.offsetWidth;
  inspectorContent.classList.add('content-pop');
}
function setPanel(which,open){
  if(which==='left')leftOpen=open;else rightOpen=open;
  if(narrowScreen.matches&&open){if(which==='left')rightOpen=false;else leftOpen=false}
  updatePanels();save();
}
document.querySelector('#toggleSidebar').onclick=()=>setPanel('left',!leftOpen);
document.querySelector('#toggleInspector').onclick=()=>setPanel('right',!rightOpen);
document.querySelector('#closeSidebar').onclick=()=>{setPanel('left',false);document.querySelector('#toggleSidebar').focus()};
document.querySelector('#closeInspector').onclick=()=>{setPanel('right',false);document.querySelector('#toggleInspector').focus()};
narrowScreen.addEventListener('change',()=>{if(narrowScreen.matches){leftOpen=false;rightOpen=false}else{leftOpen=state.panels?.left!==false;rightOpen=state.panels?.right!==false}updatePanels()});
updatePanels();
const typeColor={线索:'#e5b55c',来源:'#77b7d5',观察:'#77b7d5',推断:'#c68bf1',问题:'#ff7168',下一步:'#ff7168',链接:'#5a9f78'};
const scaleClass={'世界问题':'world','研究判断':'research','机制 / 局部问题':'mechanism','观察 / 证据':'evidence'};
window.addEventListener('resize',()=>drawLinks());
const cardDimensions={world:[286,154],research:[228,123],mechanism:[185,104],evidence:[142,76],link:[220,210]};
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
function tryParseUrl(text){
  const s=String(text||'').trim();if(!s||/\s/.test(s))return null;
  try{const u=new URL(/^https?:\/\//i.test(s)?s:'https://'+s);if(!/^https?:$/i.test(u.protocol)||!u.hostname.includes('.'))return null;return u.href}catch{return null}
}
function hostOf(url){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return ''}}
function faviconOf(url){const h=hostOf(url);return h?`https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=128`:''}
function shotOf(url){return `https://mini.s-shot.ru/1024x768/JPEG/480/Z100/?${encodeURIComponent(url)}`}
function isLinkCard(c){return !!(c&&(c.url||c.kind==='链接'))}
function linkShotErr(img){
  const wrap=img&&img.closest&&img.closest('.link-shot-wrap');
  const fav=img.getAttribute('data-fav')||'';
  if(fav&&img.getAttribute('data-stage')!=='fav'){
    img.setAttribute('data-stage','fav');
    img.classList.add('fallback');
    img.removeAttribute('data-fav');
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
  const url=c.url||'',host=hostOf(url),fav=faviconOf(url),shot=c.preview||(url?shotOf(url):'');
  const hostLabel=host||'未填写网址',title=c.title||host||'网页链接',note=c.note||'';
  const kindExtra=c.kind&&c.kind!=='链接'?` · ${esc(c.kind)}`:'';
  const chip=`<div class="link-chip">${fav?`<img src="${esc(fav)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"/>`:''}<span>${esc(hostLabel)}</span></div>`;
  let media;
  if(shot){
    media=`<div class="link-shot-wrap" data-state="loading"><img class="link-shot" src="${esc(shot)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-fav="${esc(fav)}" onerror="linkShotErr(this)" onload="const w=this.closest('.link-shot-wrap');if(w)w.dataset.state=this.classList.contains('fallback')?'icon':'ok'"/>${chip}</div>`;
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
function save(){state.panels={left:leftOpen,right:rightOpen};state.camera={x:camera.x,y:camera.y,scale};try{CaseboardStore.save(localStorage,workspace);document.querySelector('#storageError').hidden=true}catch(error){document.querySelector('#storageError').hidden=false;document.querySelector('#storageError').textContent='本地保存失败，可能是存储空间已满。请保留当前页面，勿刷新或关闭。'}document.querySelector('#caseTitle').textContent=state.caseTitle;document.querySelector('#count').textContent=`${state.cards.length} 张卡片`}
const LOD_WORLD=.4,BUBBLE_SIZE=[14,14];
function isWorldCard(c){return !!(c&&!isLinkCard(c)&&c.cardScale==='世界问题')}
function shouldBubble(c){return scale<LOD_WORLD&&!isWorldCard(c)}
function cardSizeKey(c){return isLinkCard(c)?'link':(scaleClass[c.cardScale]||'mechanism')}
function fallbackCardSize(c){return shouldBubble(c)?BUBBLE_SIZE:cardDimensions[cardSizeKey(c)]}
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
function applyStyle(){boardWrap.style.backgroundColor=state.boardColor;boardWrap.style.backgroundPosition=`${camera.x}px ${camera.y}px`;document.querySelector('#boardColor').value=state.boardColor;document.querySelector('#lineWidth').value=state.lineWidth;document.querySelector('#lineWidthVal').textContent=state.lineWidth;stage.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${scale})`;if(applyCardLod())drawLinks();document.querySelector('#zoomLabel').textContent=Math.round(scale*100)+'%'}
function refreshLineColorSwatches(){
  const box=document.querySelector('#lineColorSwatches');if(!box)return;
  box.innerHTML=swatchHtml(state.lineColor,'default');
  bindSwatches(box,()=>state.lineColor,c=>{state.lineColor=c;drawLinks();save()});
}
function markCards(){document.querySelectorAll('.card').forEach(e=>{e.classList.toggle('selected',e.dataset.id===selected);e.classList.toggle('target',e.dataset.id===linking)});boardWrap.classList.toggle('linking',!!linking);document.querySelector('#linkBtn').classList.toggle('active',!!linking)}
function render(){board.querySelectorAll('.card').forEach(e=>e.remove());document.querySelector('#empty').hidden=state.cards.length>0;state.cards.forEach(c=>{let e=document.createElement('article');const link=isLinkCard(c);e.className=`card ${link?'link':(scaleClass[c.cardScale]||'mechanism')}`;e.dataset.id=c.id;e.style.cssText=`left:${c.x}px;top:${c.y}px;--tilt:${c.tilt||'0deg'};--type:${typeColor[c.kind]||(link?'#5a9f78':'#e5b55c')}`;e.innerHTML=`<button class="pin" aria-label="从这张卡片连线" title="从这里连线"></button>${cardFaceHtml(c)}`;e.addEventListener('pointerdown',startDrag);e.addEventListener('click',clickCard);let pin=e.querySelector('.pin');pin.addEventListener('pointerdown',x=>x.stopPropagation());pin.addEventListener('click',x=>{x.stopPropagation();enterLinkMode(c.id)});board.appendChild(e)});markCards();applyStyle();drawLinks();refreshLineColorSwatches();save()}
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
function moveDrag(e){if(!drag)return;if(!drag.moved&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<6)return;let r=boardWrap.getBoundingClientRect();drag.moved=true;drag.c.x=(e.clientX-r.left-camera.x)/scale-drag.dx;drag.c.y=(e.clientY-r.top-camera.y)/scale-drag.dy;drag.el.style.left=drag.c.x+'px';drag.el.style.top=drag.c.y+'px';drawLinks()}
function endDrag(){window.removeEventListener('pointermove',moveDrag);if(drag?.moved)save();if(drag)setTimeout(()=>drag=null,0)}
function enterLinkMode(id){linking=id||'choose-source';markCards();toastMsg(id?'现在点另一张卡片，红线会自动钉上。':'先点起点，再点终点。')}
function clearLinkMode(){linking=null;markCards()}
function clickCard(e){if(drag?.moved)return;if(selectedLink!=null){selectedLink=null;drawLinks()}let id=e.currentTarget.dataset.id;if(linking==='choose-source'){selected=id;linking=id;markCards();openInspector();toastMsg('已选起点；再点一张卡片即可连线。');return}if(linking&&linking!==id){if(!state.links.some(x=>x.from===linking&&x.to===id))state.links.push({from:linking,to:id,marker:'none',width:state.lineWidth,color:state.lineColor});selected=id;clearLinkMode();drawLinks();save();openInspector();toastMsg('红线已钉上。');return}selected=id;markCards();openInspector()}
function openInspector(){
  let c=state.cards.find(x=>x.id===selected);if(!c)return;setPanel('right',true);
  const kinds=['线索','链接','来源','观察','推断','问题','下一步'];
  inspectorContent.innerHTML=`<h2>${isLinkCard(c)?'链接剪报':'线索详情'}</h2>${linking?'<div class="connection-help">连线模式已开启：点另一张卡片即可自动建立关系。</div>':''}`+
    `<div class="field"><label>思想尺度</label><select id="fscale">${['世界问题','研究判断','机制 / 局部问题','观察 / 证据'].map(x=>`<option ${x===c.cardScale?'selected':''}>${x}</option>`).join('')}</select></div>`+
    `<div class="field"><label>类型</label><select id="fkind">${kinds.map(x=>`<option ${x===c.kind?'selected':''}>${x}</option>`).join('')}</select></div>`+
    `<div class="field"><label>标题</label><input id="ftitle" value="${esc(c.title||'')}" /></div>`+
    `<div class="field"><label>网址</label><input id="furl" type="url" placeholder="https://example.com/…" value="${esc(c.url||'')}" /></div>`+
    `<div class="field"><label>封面 / 预览图（可选）</label><input id="fpreview" type="url" placeholder="自备截图或封面图 URL，覆盖自动预览" value="${esc(c.preview||'')}" /></div>`+
    `<p class="hint">${c.preview?'当前用自备封面图。':'填写网址后会尝试自动截图；失败则显示站点图标。'}也可粘贴自备图覆盖。纯前端无法保证所有网站都能截到。</p>`+
    `<div class="field"><label>批注</label><textarea id="fnote" placeholder="这则链接和当前推理有什么关系？">${esc(c.note||'')}</textarea></div>`+
    `<div class="actions"><button class="btn primary" id="saveCard">保存</button>${c.url?`<a class="btn" id="openUrl" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">打开网页</a>`:''}<button class="btn" id="makeLink">从这里连线</button><button class="btn" id="delCard">删除</button></div>`;
  animInspectorContent();
  document.querySelector('#saveCard').onclick=()=>{
    c.cardScale=document.querySelector('#fscale').value;c.kind=document.querySelector('#fkind').value;
    c.title=document.querySelector('#ftitle').value.trim()||'无标题';
    const rawUrl=document.querySelector('#furl').value.trim();
    c.url=tryParseUrl(rawUrl)||'';
    if(!c.url&&rawUrl)toastMsg('请填写以 http(s) 开头的有效网址。');
    c.preview=document.querySelector('#fpreview').value.trim();
    c.note=document.querySelector('#fnote').value.trim();
    if(c.url&&c.kind!=='链接'&&!['来源','线索'].includes(c.kind))c.kind='链接';
    if(c.url&&(!c.title||c.title==='无标题'))c.title=hostOf(c.url)||'网页链接';
    render();openInspector();toastMsg('已保存。');
  };
  document.querySelector('#makeLink').onclick=()=>enterLinkMode(c.id);
  document.querySelector('#delCard').onclick=()=>{state.cards=state.cards.filter(x=>x.id!==c.id);state.links=state.links.filter(x=>x.from!==c.id&&x.to!==c.id);selected=null;selectedLink=null;clearLinkMode();setPanel('right',false);inspectorContent.innerHTML=EMPTY_INSPECTOR;render()};
}
const EMPTY_INSPECTOR='<h2>放大一张卡片</h2><p class="empty-note">点线索卡可编辑；粘贴网址或点「＋ 链接」可钉上带预览的链接剪报并写批注；点连线可改颜色、标志或删除。</p>';
function selectLink(i){if(i<0||i>=state.links.length)return;selectedLink=i;selected=null;markCards();drawLinks();openLinkInspector()}
function clearLinkSelection(){selectedLink=null;drawLinks();if(!selected){inspectorContent.innerHTML=EMPTY_INSPECTOR}}
function openLinkInspector(){
  const lk=state.links[selectedLink];if(!lk)return;setPanel('right',true);
  const from=state.cards.find(c=>c.id===lk.from),to=state.cards.find(c=>c.id===lk.to);
  const w=lk.width||state.lineWidth||2,col=lk.color||state.lineColor;
  inspectorContent.innerHTML=`<h2>连线详情</h2>`+
    `<p class="empty-note">${esc(from?.title||'?')} → ${esc(to?.title||'?')}</p>`+
    `<div class="field"><label>颜色</label><div class="swatches" id="lcolor">${swatchHtml(col,'link')}</div></div>`+
    `<div class="field"><label>标志</label><select id="lmarker">${MARKERS.map(([v,t])=>`<option value="${v}" ${(lk.marker||'none')===v?'selected':''}>${t}</option>`).join('')}</select></div>`+
    `<div class="field"><label>粗细 (<span id="lwval">${w}</span> px)</label><input type="range" id="lwidth" min="1" max="10" value="${w}"></div>`+
    `<div class="actions"><button class="btn" id="linkFlip">调换方向</button><button class="btn primary" id="linkDone">完成</button><button class="btn" id="linkDel">删除连线</button></div>`;
  bindSwatches(document.querySelector('#lcolor'),()=>lk.color||state.lineColor,c=>{lk.color=c;drawLinks();save()});
  document.querySelector('#lmarker').onchange=e=>{lk.marker=e.target.value;drawLinks();save()};
  const lw=document.querySelector('#lwidth');lw.oninput=e=>{lk.width=+e.target.value;document.querySelector('#lwval').textContent=lk.width;drawLinks();save()};
  document.querySelector('#linkFlip').onclick=()=>{[lk.from,lk.to]=[lk.to,lk.from];drawLinks();save();openLinkInspector()};
  document.querySelector('#linkDone').onclick=()=>{clearLinkSelection();setPanel('right',false)};
  document.querySelector('#linkDel').onclick=()=>{state.links.splice(selectedLink,1);selectedLink=null;drawLinks();save();inspectorContent.innerHTML=EMPTY_INSPECTOR;setPanel('right',false);toastMsg('连线已删除。')};
  animInspectorContent();
}
function clearSelection(){
  const had=selected!=null||selectedLink!=null||linking;
  if(selected)saveDraft();
  selected=null;selectedLink=null;linking=null;
  markCards();drawLinks();
  inspectorContent.innerHTML=EMPTY_INSPECTOR;
  return had;
}
function startPan(e){if(e.target.closest('.card')||e.target.classList?.contains('link-hit'))return;clearSelection();pan={x:e.clientX,y:e.clientY,cx:camera.x,cy:camera.y,moved:false};boardWrap.classList.add('panning');window.addEventListener('pointermove',movePan);window.addEventListener('pointerup',endPan,{once:true})}
function movePan(e){if(!pan)return;pan.moved=true;camera.x=pan.cx+e.clientX-pan.x;camera.y=pan.cy+e.clientY-pan.y;applyStyle()}
function endPan(){window.removeEventListener('pointermove',movePan);boardWrap.classList.remove('panning');if(pan){save();setTimeout(()=>pan=null,0)}}
function setZoom(next,anchor){
  const r=boardWrap.getBoundingClientRect(),point=anchor||{x:r.width/2,y:r.height/2};
  const wx=(point.x-camera.x)/scale,wy=(point.y-camera.y)/scale;
  scale=Math.max(.35,Math.min(1.8,next));
  camera.x=point.x-wx*scale;camera.y=point.y-wy*scale;applyStyle();save();
}
function wheelZoom(e){
  e.preventDefault();
  if(drag||pan||!e.deltaY)return;
  const r=boardWrap.getBoundingClientRect();
  const unit=e.deltaMode===1?16:e.deltaMode===2?r.height:1;
  const delta=Math.max(-120,Math.min(120,e.deltaY*unit));
  setZoom(scale*Math.exp(-delta*.002),{x:e.clientX-r.left,y:e.clientY-r.top});
}
boardWrap.addEventListener('wheel',wheelZoom,{passive:false});
function updateBoardSelect(){
  const select=document.querySelector('#boardSelect');select.replaceChildren();
  workspace.boards.forEach((b,i)=>{const option=document.createElement('option');option.value=b.id;option.textContent=`${i+1}. ${b.data.caseTitle}`;select.appendChild(option)});
  select.value=workspace.activeId;
}
function saveDraft(){
  const c=state.cards.find(c=>c.id===selected),title=document.querySelector('#ftitle');
  if(c&&title){
    c.title=title.value.trim()||'无标题';c.note=document.querySelector('#fnote').value;c.kind=document.querySelector('#fkind').value;c.cardScale=document.querySelector('#fscale').value;
    const fu=document.querySelector('#furl'),fp=document.querySelector('#fpreview');
    if(fu){const raw=fu.value.trim();c.url=tryParseUrl(raw)||raw}
    if(fp)c.preview=fp.value.trim();
  }
  save();
}
function activateBoard(id){
  const entry=workspace.boards.find(b=>b.id===id);if(!entry)return;
  workspace.activeId=id;state=entry.data;state.lineWidth||=2;normalizeLinks(state);selected=null;selectedLink=null;linking=null;drag=null;pan=null;
  window.removeEventListener('pointermove',moveDrag);window.removeEventListener('pointermove',movePan);
  boardWrap.classList.remove('panning');
  scale=state.camera?.scale||1;camera={x:state.camera?.x||0,y:state.camera?.y||0};
  leftOpen=narrowScreen.matches?false:state.panels?.left!==false;rightOpen=false;updatePanels();
  inspectorContent.innerHTML=EMPTY_INSPECTOR;
  render();updateBoardSelect();boardWrap.focus({preventScroll:true});
}
function newBoardFromText(text=''){
  saveDraft();
  const title=text.trim().split(/\r?\n/).find(line=>line.trim())?.trim().slice(0,40)||'未命名板子';
  const id=crypto.randomUUID();
  workspace.boards.push({id,data:{caseTitle:title,cards:[],links:[],boardColor:state.boardColor,lineColor:state.lineColor,lineWidth:state.lineWidth||2,camera:{x:0,y:0,scale:1},panels:{left:false,right:false}}});
  activateBoard(id);
  if(text){
    setPanel('right',true);
    const r=boardWrap.getBoundingClientRect();
    const card={id:crypto.randomUUID(),cardScale:'研究判断',kind:'线索',title,note:text,x:r.width/2-114,y:r.height/2-62,tilt:'0deg'};
    state.cards.push(card);selected=card.id;render();openInspector();boardWrap.focus({preventScroll:true});
  }
  toastMsg(text?'已新建板子，全文已放入卡片。':'已新建空白板子。');
}
document.querySelector('#boardSelect').onchange=e=>{saveDraft();activateBoard(e.target.value)};
document.querySelector('#newBoard').onclick=()=>newBoardFromText();
document.addEventListener('paste',e=>{
  if(e.defaultPrevented||e.target instanceof Element&&(e.target.closest('input,textarea,select')||e.target.isContentEditable))return;
  const text=e.clipboardData?.getData('text/plain');if(!text||!text.trim())return;
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
  const c={id:crypto.randomUUID(),cardScale:'观察 / 证据',kind:'链接',title:host,url:parsed,preview:'',note:'',x:(r.width/2-camera.x)/scale-110,y:(r.height/2-camera.y)/scale-105,tilt:(Math.random()>.5?'-1.2deg':'1.2deg')};
  state.cards.push(c);selected=c.id;render();openInspector();
  const fu=document.querySelector('#furl');if(fu){fu.focus();fu.select()}
  toastMsg(parsed?'已钉上一张链接剪报。':'填写网址，保存后会显示预览。');
}
function add(){let r=boardWrap.getBoundingClientRect(),c={id:crypto.randomUUID(),cardScale:'观察 / 证据',kind:'线索',title:'新线索',note:'它让我想到什么？证据是什么？',x:(r.width/2-camera.x)/scale-71,y:(r.height/2-camera.y)/scale-38,tilt:'0deg'};state.cards.push(c);selected=c.id;render();openInspector();document.querySelector('#ftitle').focus();document.querySelector('#ftitle').select()}
function toastMsg(m){toast.textContent=m;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800)}
const settingsRoot=document.querySelector('#settingsRoot');
const openSettingsBtn=document.querySelector('#openSettings');
const closeSettingsBtn=document.querySelector('#closeSettings');
function openSettings(){
  settingsRoot.hidden=false;
  openSettingsBtn.setAttribute('aria-expanded','true');
  document.querySelector('#settingsPanel').focus({preventScroll:true});
  refreshLineColorSwatches();
  applyStyle();applyFont();
}
function closeSettings(){
  if(settingsRoot.hidden)return;
  settingsRoot.hidden=true;
  openSettingsBtn.setAttribute('aria-expanded','false');
  openSettingsBtn.focus({preventScroll:true});
}
openSettingsBtn.onclick=()=>{settingsRoot.hidden?openSettings():closeSettings()};
closeSettingsBtn.onclick=closeSettings;
document.querySelector('#settingsBackdrop').onclick=closeSettings;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!settingsRoot.hidden){e.preventDefault();closeSettings()}});
document.querySelector('#addLinkBtn').onclick=()=>addLinkCard();
document.querySelector('#addBtn').onclick=add;document.querySelector('#linkBtn').onclick=()=>{if(linking){clearLinkMode();toastMsg('已退出连线模式。');return}enterLinkMode(selected)};document.querySelector('#zoomIn').onclick=()=>setZoom(Math.min(1.8,+(scale+.1).toFixed(2)));document.querySelector('#zoomOut').onclick=()=>setZoom(Math.max(.35,+(scale-.1).toFixed(2)));document.querySelector('#boardColor').oninput=e=>{state.boardColor=e.target.value;applyStyle();save()};document.querySelector('#lineWidth').oninput=e=>{state.lineWidth=+e.target.value;document.querySelector('#lineWidthVal').textContent=state.lineWidth;drawLinks();save()};document.querySelector('#fontPreset').onchange=e=>{workspace.settings.font=e.target.value;applyFont();save();toastMsg('字体已更新。')};boardWrap.addEventListener('pointerdown',startPan);applyFont();render();

