const DATA_FILES = {
  questions: ["questions.json", "extra_questions.json"],
  glossary: ["glossary.json", "extra_glossary.json"],
  handbook: ["handbook.json"]
};
const $ = sel => document.querySelector(sel);
const byId = id => document.getElementById(id);
const STATE = {
  all: [],
  glossary: [],
  wrongIds: new Set(JSON.parse(localStorage.getItem('gravure_wrongIds')||'[]')),
  history: JSON.parse(localStorage.getItem('gravure_history')||'[]'),
  mastery: JSON.parse(localStorage.getItem('gravure_mastery')||'{}'),
  handbook: {chapters:[]},
};
function savePersist(){
  localStorage.setItem('gravure_wrongIds', JSON.stringify([...STATE.wrongIds]));
  localStorage.setItem('gravure_history', JSON.stringify(STATE.history));
  localStorage.setItem('gravure_mastery', JSON.stringify(STATE.mastery));
}
document.querySelectorAll('.tab').forEach(t=>{
  t.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'));
    t.classList.add('active');
    const tab=t.dataset.tab;
    ['train','glossary','diagram','handbook'].forEach(name=> byId('tab-'+name).style.display = (name===tab)?'block':'none');
    if(tab==='handbook') renderHandbook();
  });
});
async function fetchMaybe(url){
  try{
    const res = await fetch(url, {cache:"no-store"});
    if(!res.ok) throw new Error(res.status);
    return await res.json();
  }catch(e){ return null; }
}
async function loadData(){
  const qs = [];
  for(const f of DATA_FILES.questions){
    const d = await fetchMaybe(f);
    if(d) qs.push(...d);
  }
  const gl = [];
  for(const f of DATA_FILES.glossary){
    const d = await fetchMaybe(f);
    if(d) gl.push(...d);
  }
  const hb = await fetchMaybe(DATA_FILES.handbook[0]) || {chapters:[]};
  STATE.all = qs.filter(q=> Array.isArray(q.choices) && typeof q.answer==='number' && q.answer>=0 && q.answer<q.choices.length && typeof q.q==='string' && typeof q.id==='string' && typeof q.cat==='string');
  STATE.glossary = gl.filter(t=> t && typeof t.term==='string' && typeof t.desc==='string');
  STATE.handbook = hb;
}
function initUI(){
  const cats = Array.from(new Set(STATE.all.map(q=>q.cat))).sort();
  const sel=byId('category'); sel.innerHTML='';
  cats.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
  const gSel=byId('gCat'); gSel.innerHTML='<option value="all">すべて</option>';
  const gCats = Array.from(new Set(STATE.glossary.map(t=>t.cat))).sort();
  gCats.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; gSel.appendChild(o); });
  byId('stats').textContent = `問題数: ${STATE.all.length}　誤答蓄積: ${STATE.wrongIds.size}　履歴: ${STATE.history.length}件`;
  document.querySelectorAll('.btn-qty').forEach(b=> b.addEventListener('click',()=>{ byId('count').value = b.dataset.n; }));
  byId('start').addEventListener('click', startGame);
  byId('gSearch').addEventListener('input', renderGlossary);
  byId('gCat').addEventListener('change', renderGlossary);
  renderGlossary();
  document.querySelectorAll('svg.flow .node').forEach(n=>{
    n.addEventListener('click', ()=>{
      const term = n.getAttribute('data-term');
      const item = STATE.glossary.find(g=> g.term===term) || STATE.glossary.find(g=> (g.term||'').includes(term));
      if(item){
        document.querySelector('.tab.active').classList.remove('active');
        document.querySelector('.tab[data-tab="glossary"]').classList.add('active');
        ['train','glossary','diagram','handbook'].forEach(name=> byId('tab-'+name).style.display = (name==='glossary')?'block':'none');
        showTerm(item);
        byId('gDetail').scrollIntoView({behavior:'smooth', block:'start'});
      }else{
        alert('該当用語が見つかりません：'+term);
      }
    });
  });
}
let session=null;
function startGame(){
  const mode=byId('mode').value;
  const count=Math.max(1, Math.min(200, parseInt(byId('count').value||'10')));
  let pool=STATE.all.slice();
  if(mode==='category'){
    const chosen=[...byId('category').selectedOptions].map(o=>o.value);
    if(chosen.length) pool=pool.filter(q=> chosen.includes(q.cat));
  } else if(mode==='wrong'){
    pool=pool.filter(q=> STATE.wrongIds.has(q.id));
  } else if(mode==='weak'){
    pool.sort((a,b)=> getWeakScore(b.id)-getWeakScore(a.id));
  }
  if(pool.length===0){ alert('選択条件に合う問題がありません。'); return; }
  shuffle(pool);
  const selected=pool.slice(0,count);
  session={ idx:0, list:selected, correct:0, total:selected.length, byCat:{} };
  byId('game').innerHTML='';
  showQuestion();
}
function getWeakScore(id){
  const m=STATE.mastery[id]||{seen:0,correct:0};
  if(m.seen===0) return 1;
  return 1 - (m.correct/m.seen);
}
function showQuestion(){
  const g=byId('game');
  const i=session.idx;
  const q=session.list[i];
  const card=document.createElement('div');
  card.className='qcard';
  card.innerHTML = `
    <div class="qhead">${escapeHtml(q.q)}</div>
    <div class="qmeta">${q.cat}　<span class="tag">難度:${q.level||2}</span> ${q.tags?.map(t=>`<span class="tag">${t}</span>`).join(' ')||''}</div>
    <div class="choices">
      ${q.choices.map((c,idx)=>`<button class="choice" data-i="${idx}">${escapeHtml(c)}</button>`).join('')}
    </div>
    <div class="feedback"></div>
    <div style="padding:12px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="primary nextBtn">次へ</button>
      <button class="skipBtn">わからない（スキップ）</button>
    </div>
  `;
  g.appendChild(card);
  card.scrollIntoView({behavior:'smooth', block:'start'});
  card.querySelectorAll('.choice').forEach(btn=>{
    btn.addEventListener('click', ()=>selectChoice(card, q, parseInt(btn.dataset.i)));
  });
  card.querySelector('.nextBtn').addEventListener('click', nextQuestion);
  card.querySelector('.skipBtn').addEventListener('click', ()=>skipQuestion(q, card));
}
function skipQuestion(q, card){
  STATE.wrongIds.add(q.id); savePersist();
  const fb=card.querySelector('.feedback');
  fb.textContent='スキップ：復習モードに追加しました。';
  nextQuestion();
}
function selectChoice(card,q,i){
  const ok=(i===q.answer);
  const btns=card.querySelectorAll('.choice');
  btns.forEach((b,idx)=>{
    b.disabled=true;
    if(idx===q.answer) b.classList.add('correct');
    if(idx===i && !ok) b.classList.add('wrong');
  });
  const m=STATE.mastery[q.id]||{seen:0,correct:0};
  m.seen+=1; if(ok) m.correct+=1; STATE.mastery[q.id]=m;
  if(ok){ STATE.wrongIds.delete(q.id); session.correct+=1; }
  else { STATE.wrongIds.add(q.id); }
  savePersist();
  const fb=card.querySelector('.feedback');
  fb.innerHTML=(ok?`<span style="color:var(--ok)">正解！</span>`:`<span style="color:var(--ng)">不正解…</span> 正解は「${escapeHtml(q.choices[q.answer])}」。`) + ' ' + escapeHtml(q.exp||'');
  session.byCat[q.cat]=session.byCat[q.cat]||{c:0,t:0};
  session.byCat[q.cat].t+=1; if(ok) session.byCat[q.cat].c+=1;
}
function nextQuestion(){
  session.idx+=1;
  if(session.idx<session.list.length) showQuestion(); else endSession();
}
function endSession(){
  STATE.history.push({ts:Date.now(), correct:session.correct, total:session.total, byCat:session.byCat});
  savePersist();
  const g=byId('game');
  const res=document.createElement('div'); res.className='panel';
  const rate=Math.round(session.correct/session.total*100);
  res.innerHTML = `<h3>結果: ${session.correct} / ${session.total}（${rate}%）</h3>
    <div class="small muted">苦手分野（正答率が低い順）:</div>`;
  const arr=Object.entries(session.byCat).map(([k,v])=>[k, v.c/(v.t||1)]).sort((a,b)=>a[1]-b[1]);
  res.innerHTML += `<div>${arr.map(([k,p])=>`<span class="tag">${k}: ${(p*100).toFixed(0)}%</span>`).join(' ')||'<span class="tag">データなし</span>'}</div>`;
  g.appendChild(res); res.scrollIntoView({behavior:'smooth'});
}
function renderGlossary(){
  const q=byId('gSearch').value.trim().toLowerCase();
  const cat=byId('gCat').value;
  const list=byId('gList'); list.innerHTML='';
  const filtered=STATE.glossary.filter(t=>{
    const okCat=(cat==='all' || t.cat===cat);
    const okQ=(!q || (t.term||'').toLowerCase().includes(q) || (t.desc||'').toLowerCase().includes(q));
    return okCat && okQ;
  });
  byId('gCount').textContent = filtered.length+' 語';
  filtered.forEach(t=>{
    const el=document.createElement('li'); el.className='term';
    el.innerHTML = `<div><b>${escapeHtml(t.term)}</b> <span class="tag">${escapeHtml(t.cat||'')}</span></div><div class="small">${escapeHtml(t.desc||'')}</div>`;
    el.addEventListener('click', ()=> showTerm(t)); list.appendChild(el);
  });
  byId('gDetail').style.display='none';
}
function showTerm(t){
  const d=byId('gDetail'); d.style.display='block';
  d.innerHTML = `<b>${escapeHtml(t.term)}</b> <span class="tag">${escapeHtml(t.cat||'')}</span>
  <div style="margin-top:6px">${escapeHtml(t.desc||'')}</div>`;
}
function renderHandbook(){
  const hb = STATE.handbook;
  const cSel = byId('hbChapter');
  const sSel = byId('hbSection');
  const content = byId('hbContent');
  if(!hb.chapters?.length){
    content.innerHTML = '<p class="small muted">handbook.json が見つかりませんでした。</p>';
    return;
  }
  if(!cSel.options.length){
    hb.chapters.forEach((ch,i)=>{
      const o=document.createElement('option'); o.value=i; o.textContent=(i+1)+'. '+ch.title; cSel.appendChild(o);
    });
    cSel.addEventListener('change', ()=>{ populateSections(); renderPage(); });
    sSel.addEventListener('change', renderPage);
    populateSections();
  }
  renderPage();
  function populateSections(){
    sSel.innerHTML='';
    const ch = hb.chapters[cSel.value||0];
    (ch.sections||[]).forEach((s,i)=>{
      const o=document.createElement('option'); o.value=i; o.textContent=(i+1)+') '+s.title; sSel.appendChild(o);
    });
  }
  function renderPage(){
    const ch = hb.chapters[cSel.value||0];
    const sec = (ch.sections||[])[sSel.value||0] || {content:""};
    byId('hbPos').textContent = (Number(cSel.value)+1)+'/'+hb.chapters.length;
    byId('hbContent').innerHTML = `<h4>${escapeHtml(ch.title)}</h4><h5>${escapeHtml(sec.title||'')}</h5><p>${(sec.content||'').split('\n').map(escapeHtml).join('<br>')}</p>`;
  }
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } }
function escapeHtml(s){ return String(s||'').replace(/[&<>\"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); }
(async function(){
  await loadData();
  initUI();
})();
