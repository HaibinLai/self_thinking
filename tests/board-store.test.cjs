const test=require('node:test');
const assert=require('node:assert/strict');
const store=require('../dist/board-store.js');
function memory(initial={}){const values=new Map(Object.entries(initial));return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}}
test('migration preserves existing cards, links, camera and original backup',()=>{
  const original={caseTitle:'原板子',cards:[{id:'a',note:'原文\n第二行',cardScale:'世界问题'}],links:[['a','b']],camera:{x:-300,y:20,scale:.7},panels:{left:false}};
  const backup=JSON.stringify(original),storage=memory({'caseboard-v1':backup});
  const workspace=store.load(storage,{});
  assert.deepEqual(workspace.boards[0].data,original);
  store.save(storage,workspace);
  assert.equal(storage.getItem('caseboard-v1'),backup);
  assert.deepEqual(store.load(storage,{}),workspace);
});
test('multiple boards and full pasted text survive reload independently',()=>{
  const storage=memory(),workspace=store.load(storage,{caseTitle:'原板子',cards:[],links:[]});
  const text='第一行\n<script>alert("text")</script>\n'+'长文本'.repeat(5000)+'\n';
  workspace.boards.push({id:'pasted',data:{caseTitle:'第一行',cards:[{id:'p',note:text}],links:[]}});
  workspace.activeId='pasted';store.save(storage,workspace);
  const loaded=store.load(storage,{});
  assert.equal(loaded.activeId,'pasted');assert.equal(loaded.boards[1].data.cards[0].note,text);
  assert.equal(loaded.boards[0].data.cards.length,0);
});
test('storage failures are surfaced and malformed saved workspace is not replaced',()=>{
  assert.throws(()=>store.save({setItem(){throw new Error('quota')}},{}),/quota/);
  const storage=memory({[store.KEY]:'{"version":99}'});
  assert.throws(()=>store.load(storage,{}));
  assert.equal(storage.getItem(store.KEY),'{"version":99}');
});
