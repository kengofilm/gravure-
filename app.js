let mode = 'training';
const DATA_FILES = {
  questions: 'questions.json',
  glossary: 'glossary.json',
  extraQuestions: 'extra_questions.json',
  extraGlossary: 'extra_glossary.json'
};
let questions = [], glossary = [];

function setMode(m) {
  mode = m;
  render();
}

async function loadData() {
  const qMain = await fetch(DATA_FILES.questions).then(r=>r.json()).catch(()=>[]);
  const qExtra = await fetch(DATA_FILES.extraQuestions).then(r=>r.json()).catch(()=>[]);
  const gMain = await fetch(DATA_FILES.glossary).then(r=>r.json()).catch(()=>[]);
  const gExtra = await fetch(DATA_FILES.extraGlossary).then(r=>r.json()).catch(()=>[]);
  questions = qMain.concat(qExtra);
  glossary = gMain.concat(gExtra);
  render();
}

function render() {
  const app = document.getElementById('app');
  if(mode==='training') {
    app.innerHTML = '<h2>トレーニングモード</h2><p>問題数: '+questions.length+'</p>';
  } else if(mode==='glossary') {
    app.innerHTML = '<h2>用語集モード</h2><ul>'+glossary.map(g=>'<li>'+g.term+': '+g.desc+'</li>').join('')+'</ul>';
  } else if(mode==='diagram') {
    app.innerHTML = '<h2>図式モード</h2><p>印刷工程の図（簡易）</p>';
  } else if(mode==='reference') {
    app.innerHTML = '<h2>参考書モード</h2><p>体系的な学習内容（準備中）</p>';
  }
}

loadData();
