/* Keep each board's data together and retain the original single-board backup. */
(function(root){
  const KEY='caseboard-workspace-v1';
  function load(storage,fallback){
    const saved=storage.getItem(KEY);
    if(saved){
      const workspace=JSON.parse(saved);
      if(workspace.version!==1||!Array.isArray(workspace.boards)||!workspace.boards.length||!workspace.boards.some(b=>b.id===workspace.activeId))throw new Error('无法读取板子列表');
      return workspace;
    }
    const old=storage.getItem('caseboard-v1');
    const data=old?JSON.parse(old):JSON.parse(JSON.stringify(fallback));
    return {version:1,activeId:'original',boards:[{id:'original',data}]};
  }
  function save(storage,workspace){storage.setItem(KEY,JSON.stringify(workspace))}
  const api={KEY,load,save};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.CaseboardStore=api;
})(globalThis);
