// app.js (v2-compat, 20250808) — iOS WebKitでも動く古い構文版
const $ = function(s){ return document.querySelector(s); };
const $$ = function(s){ return document.querySelectorAll(s); };
const byId = function(id){ return document.getElementById(id); };
const STATE = {
  all: [], glossary: [], handbook:{chapters:[]},
  wrongIds: new Set(JSON.parse(localStorage.getItem('gravure_wrongIds')||'[]')),
  history: JSON.parse(localStorage.getItem('gravure_history')||'[]'),
  mastery: JSON.parse(localStorage.getItem('gravure_mastery')||'{}'),
};

// Bottom nav routing
(function(){
  var btns = $$('.nav button');
  for(var i=0;i<btns.length;i++){
    (function(b){
      b.addEventListener('click', function(){
        for(var j=0;j<btns.length;j++){ btns[j].classList.remove('active'); }
        b.classList.add('active');
        var tab = b.getAttribute('data-tab');
        var names = ['train','glossary','diagram','handbook'];
        for(var k=0;k<names.length;k++){ byId('tab-'+names[k]).hidden = (names[k]!==tab); }
        if(tab==='handbook') renderHandbook();
      });
    })(btns[i]);
  }
})();

// /data 配下だけ参照
var DATA = {
  questions: ["./data/questions.json","./data/extra_questions.json"],
  glossary:  ["./data/glossary.json","./data/extra_glossary.json"],
  handbook:  ["./data/handbook.json"]
};
var STARTER = {
  questions: [
    {id:"S0001", cat:"基礎/方式", q:"グラビア印刷の版は？", choices:["凹版","凸版","孔版","平版"], answer:0, exp:"セルにインキを保持する凹版。", level:1, tags:["凹版"]},
    {id:"S0002", cat:"色/色校正", q:"ΔE*00の利点は？", choices:["知覚差に近い","RGB必須","測色不要","必ず0.0になる"], answer:0, exp:"CIEDE2000は知覚均等性に配慮。", level:1, tags:["ΔE"]},
    {id:"S0003", cat:"基材/表面処理", q:"OPPの前処理で一般的なのは？", choices:["コロナ処理","加硫","硫酸洗浄","UV硬化"], answer:0, exp:"ぬれ性向上のため。", level:1, tags:["ダイン"]},
  ],
  glossary: [
    {term:"デザイン入稿", cat:"工程", desc:"制作データを色管理条件とともに受け取る工程。プロファイル/白引き設計など要確認。"},
    {term:"色校正", cat:"色評価", desc:"標準見本・光源条件・測色ルールの合意のもとで行う評価。ΔE*00で判定することが多い。"},
    {term:"白引き", cat:"カラマネ", desc:"下地に白インキを敷き、基材色の影響を減らして発色を安定。"},
  ],
  handbook: {chapters:[{title:"スターター",sections:[{title:"概要",content:"data/ 配下に JSON を置くと自動で読み込みます。questions.json / glossary.json は最低限必要です。"}]}]}
};

function savePersist(){
  localStorage.setItem('gravure_wrongIds', JSON.stringify(Array.from(STATE.wrongIds)));
  localStorage.setItem('gravure_history', JSON.stringify(STATE.history));
  localStorage.setItem('gravure_mastery', JSON.stringify(STATE.mastery));
}
function fetchFirst(urls){
  return new Promise(function(resolve){
    var i = 0;
    function tryNext(){
      if(i>=urls.length){ resolve(null); return; }
      var u = urls[i++] + '?v=20250808';
      fetch(u, {cache:'no-store'}).then(function(res){
        if(!res.ok){ tryNext(); return; }
        res.json().then(function(data){ resolve(data); }).catch(function(){ tryNext(); });
      }).catch(function(){ tryNext(); });
    }
    tryNext();
  });
}
function loadData(){
  Promise.all([fetchFirst(DATA.questions), fetchFirst(DATA.glossary), fetchFirst(DATA.handbook)]).then(function(arr){
    var qd = arr[0], gd = arr[1], hb = arr[2];
    var qs = normalizeQuestions(qd);
    var gl = normalizeGlossary(gd);
    STATE.handbook = (hb && hb.chapters) ? hb : STARTER.handbook;
    STATE.all = (qs && qs.length) ? qs : STARTER.questions;
    STATE.glossary = (gl && gl.length) ? gl : STARTER.glossary;
    initUI();
  });
}
function normalizeQuestions(any){
  var arr = Array.isArray(any) ? any : (any && (any.items||any.data) ? (any.items||any.data) : []);
  arr = arr.filter(function(q){
    return q && Array.isArray(q.choices) && typeof q.answer==='number' && typeof q.q==='string' && typeof q.id==='string' && typeof q.cat==='string' && q.answer>=0 && q.answer<q.choices.length;
  });
  return arr;
}
function normalizeGlossary(any){
  var arr = Array.isArray(any) ? any : (any && (any.items||any.data) ? (any.items||any.data) : []);
  var out = [];
  (arr||[]).forEach(function(t){
    if(!t || typeof t!=='object') return;
    var term = t.term || t['用語'] || t.name || t.title;
    var cat  = t.cat  || t.category || t['カテゴリ'] || "";
    var desc = t.desc || t.description || t.meaning || t.explanation || t['説明'];
    if(typeof term==='string' && typeof desc==='string'){ out.push({term:term, cat:cat, desc:desc}); }
  });
  return out;
}

function initUI(){
  var cats = Array.from(new Set(STATE.all.map(function(q){return q.cat;}))).sort();
  var sel=byId('category'); sel.innerHTML=''; cats.forEach(function(c){ var o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });

  var gSel=byId('gCat'); gSel.innerHTML='<option value="all">すべて</option>';
  var gCats = Array.from(new Set(STATE.glossary.map(function(t){return t.cat;}))).sort();
  gCats.forEach(function(c){ var o=document.createElement('option'); o.value=c; o.textContent=c; gSel.appendChild(o); });

  byId('stats').textContent = '問題:'+STATE.all.length+' | 用語:'+STATE.glossary.length+' | 誤答:'+STATE.wrongIds.size;

  var qtyBtns = $$('.btn-qty');
  for(var i=0;i<qtyBtns.length;i++){ qtyBtns[i].addEventListener('click', function(){ byId('count').value = this.getAttribute('data-n'); }); }
  byId('start').addEventListener('click', startGame);

  byId('gSearch').addEventListener('input', renderGlossary);
  byId('gCat').addEventListener('change', renderGlossary);
  renderGlossary();

  var nodes = document.querySelectorAll('svg .node');
  for(var n=0;n<nodes.length;n++){
    nodes[n].addEventListener('click', function(){
      var term = this.getAttribute('data-term');
      var item = STATE.glossary.find(function(g){ return g.term===term; }) || STATE.glossary.find(function(g){ return (g.term||'').indexOf(term)>=0; });
      var btns = $$('.nav button'); for(var j=0;j<btns.length;j++){ btns[j].classList.remove('active'); }
      $$('.nav button[data-tab="glossary"]')[0].classList.add('active');
      var names = ['train','glossary','diagram','handbook'];
      for(var k=0;k<names.length;k++){ byId('tab-'+names[k]).hidden = (names[k]!=='glossary'); }
      if(item){ showTerm(item); } else { alert('該当用語が見つかりません：'+term); }
      byId('gDetail').scrollIntoView({behavior:'smooth', block:'start'});
    });
  });
}

// ===== Training =====
var session=null;
function startGame(){
  var mode=byId('mode').value;
  var count=Math.max(1, Math.min(200, parseInt(byId('count').value||'10')));
  var pool=STATE.all.slice();
  if(mode==='category'){
    var chosen=[]; var opts=byId('category').selectedOptions;
    for(var i=0;i<opts.length;i++){ chosen.push(opts[i].value); }
    if(chosen.length) pool=pool.filter(function(q){ return chosen.indexOf(q.cat)>=0; });
  } else if(mode==='wrong'){
    pool=pool.filter(function(q){ return STATE.wrongIds.has(q.id); });
  } else if(mode==='weak'){
    pool.sort(function(a,b){ return getWeakScore(b.id)-getWeakScore(a.id); });
  }
  if(pool.length===0){ alert('選択条件に合う問題がありません。'); return; }
  shuffle(pool);
  var selected=pool.slice(0,count);
  session={ idx:0, list:selected, correct:0, total:selected.length, byCat:{} };
  byId('game').innerHTML='';
  showQuestion();
}
function getWeakScore(id){
  var m=STATE.mastery[id]||{seen:0,correct:0};
  if(m.seen===0) return 1;
  return 1 - (m.correct/m.seen);
}
function showQuestion(){
  var g=byId('game');
  var i=session.idx;
  var q=session.list[i];
  var card=document.createElement('div');
  card.className='qcard';
  var tags = (q.tags && q.tags.map(function(t){return '<span class="tag">'+escapeHtml(t)+'</span>';}).join(' ')) || '';
  card.innerHTML =
    '<div class="qhead">'+escapeHtml(q.q)+'</div>'+
    '<div class="qmeta">'+q.cat+'　<span class="tag">難度:'+(q.level||2)+'</span> '+tags+'</div>'+
    '<div class="choices">'+
      q.choices.map(function(c,idx){return '<button class="choice" data-i="'+idx+'">'+escapeHtml(c)+'</button>';}).join('')+
    '</div>'+
    '<div class="feedback" style="padding:10px 14px"></div>'+
    '<div style="padding:10px;display:flex;gap:8px;flex-wrap:wrap">'+
      '<button class="btn nextBtn" style="flex:1">次へ</button>'+
      '<button class="btn secondary skipBtn" style="flex:1">わからない（復習）</button>'+
    '</div>';
  g.appendChild(card);
  card.scrollIntoView({behavior:'smooth', block:'start'});
  var btns=card.querySelectorAll('.choice');
  for(var b=0;b<btns.length;b++){
    (function(btn){ btn.addEventListener('click', function(){ selectChoice(card, q, parseInt(btn.getAttribute('data-i'))); }); })(btns[b]);
  }
  card.querySelector('.nextBtn').addEventListener('click', nextQuestion);
  card.querySelector('.skipBtn').addEventListener('click', function(){ skipQuestion(q, card); });
}
function skipQuestion(q, card){
  STATE.wrongIds.add(q.id); savePersist();
  var fb=card.querySelector('.feedback');
  fb.textContent='スキップ：復習モードに追加しました。';
  nextQuestion();
}
function selectChoice(card,q,i){
  var ok=(i===q.answer);
  var btns=card.querySelectorAll('.choice');
  for(var b=0;b<btns.length;b++){
    var idx=b;
    btns[b].disabled=true;
    if(idx===q.answer) btns[b].classList.add('correct');
    if(idx===i && !ok) btns[b].classList.add('wrong');
  }
  var m=STATE.mastery[q.id]||{seen:0,correct:0};
  m.seen+=1; if(ok) m.correct+=1; STATE.mastery[q.id]=m;
  if(ok){ STATE.wrongIds.delete(q.id); session.correct+=1; }
  else { STATE.wrongIds.add(q.id); }
  savePersist();
  var fb=card.querySelector('.feedback');
  fb.innerHTML=(ok?'<span style="color:#16a34a">正解！</span>':'<span style="color:#ef4444">不正解…</span> 正解は「'+escapeHtml(q.choices[q.answer])+'」。') + ' ' + escapeHtml(q.exp||'');
  if(!session.byCat[q.cat]) session.byCat[q.cat]={c:0,t:0};
  session.byCat[q.cat].t+=1; if(ok) session.byCat[q.cat].c+=1;
}
function nextQuestion(){
  session.idx+=1;
  if(session.idx<session.list.length) showQuestion(); else endSession();
}
function endSession(){
  STATE.history.push({ts:Date.now(), correct:session.correct, total:session.total, byCat:session.byCat});
  savePersist();
  var g=byId('game');
  var res=document.createElement('div'); res.className='panel';
  var rate=Math.round(session.correct/session.total*100);
  res.innerHTML = '<h3>結果: '+session.correct+' / '+session.total+'（'+rate+'%）</h3><div class="tag">苦手分野（正答率が低い順）</div>';
  var arr=[]; for(var k in session.byCat){ var v=session.byCat[k]; arr.push([k, v.c/(v.t||1)]); }
  arr.sort(function(a,b){ return a[1]-b[1]; });
  res.innerHTML += '<div style="margin-top:6px">'+(arr.map(function(p){return '<span class="tag">'+p[0]+': '+(p[1]*100).toFixed(0)+'%</span>';}).join(' ')||'<span class="tag">データなし</span>')+'</div>';
  g.appendChild(res); res.scrollIntoView({behavior:'smooth'});
}

// ===== Glossary =====
function renderGlossary(){
  var q=byId('gSearch').value.trim().toLowerCase();
  var cat=byId('gCat').value;
  var list=byId('gList'); list.innerHTML='';
  var filtered=STATE.glossary.filter(function(t){
    var okCat=(cat==='all' || t.cat===cat);
    var okQ=(!q || (t.term||'').toLowerCase().indexOf(q)>=0 || (t.desc||'').toLowerCase().indexOf(q)>=0);
    return okCat && okQ;
  });
  byId('gCount').textContent = filtered.length+' 語';
  filtered.forEach(function(t){
    var el=document.createElement('li'); el.className='term';
    el.innerHTML = '<div><b>'+escapeHtml(t.term)+'</b> <span class="tag">'+escapeHtml(t.cat||'')+'</span></div><div style="opacity:.9;margin-top:4px">'+escapeHtml(t.desc||'')+'</div>';
    el.addEventListener('click', function(){ showTerm(t); }); list.appendChild(el);
  });
  byId('gDetail').hidden=true;
}
function showTerm(t){
  var d=byId('gDetail'); d.hidden=false;
  d.innerHTML = '<b style="font-size:18px">'+escapeHtml(t.term)+'</b> <span class="tag">'+escapeHtml(t.cat||'')+'</span><div style="margin-top:6px;line-height:1.6">'+escapeHtml(t.desc||'')+'</div>';
}

// ===== Handbook =====
function renderHandbook(){
  var hb = STATE.handbook;
  var cSel = byId('hbChapter');
  var sSel = byId('hbSection');
  var content = byId('hbContent');
  if(!(hb.chapters && hb.chapters.length)){
    content.innerHTML = '<p class="tag">handbook.json が見つかりませんでした（任意）。</p>';
    return;
  }
  if(!cSel.options.length){
    for(var i=0;i<hb.chapters.length;i++){
      var ch=hb.chapters[i]; var o=document.createElement('option'); o.value=i; o.textContent=(i+1)+'. '+ch.title; cSel.appendChild(o);
    }
    cSel.addEventListener('change', function(){ populateSections(); renderPage(); });
    sSel.addEventListener('change', renderPage);
    populateSections();
  }
  renderPage();
  function populateSections(){
    sSel.innerHTML='';
    var ch = hb.chapters[parseInt(cSel.value||0,10)];
    var secs = (ch && ch.sections) ? ch.sections : [];
    for(var i=0;i<secs.length;i++){
      var s=secs[i]; var o=document.createElement('option'); o.value=i; o.textContent=(i+1)+') '+s.title; sSel.appendChild(o);
    }
  }
  function renderPage(){
    var ch = STATE.handbook.chapters[parseInt(cSel.value||0,10)];
    var secs = (ch && ch.sections) ? ch.sections : [];
    var sec = secs[parseInt(sSel.value||0,10)] || {content:""};
    content.innerHTML = '<h4 style="margin:.2em 0">'+escapeHtml(ch.title)+'</h4><h5 style="margin:.2em 0;color:#9ca3af">'+escapeHtml((sec.title||''))+'</h5><p style="line-height:1.7">'+(String(sec.content||'').split('\n').map(escapeHtml).join('<br>'))+'</p>';
  }
}

// Utils
function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } }
function escapeHtml(s){ return String(s||'').replace(/[&<>\"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }); }

// boot
loadData();
