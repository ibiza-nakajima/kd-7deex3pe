const SET = window.SET;
const FORM = window.FORM;
const KANA = ["ア","イ","ウ","エ","オ"];
const Q = SET.questions;
const MC = Q.filter(q=>q.kind==="mc");
const PT = 4;

/* ---------- storage ---------- */
const LS_KEY = "kd-"+SET.id+"-progress", DRAFT_KEY = "kd-"+SET.id+"-draft", SUM_KEY = "kd-sum-"+SET.id;
const state = { i:-1, run:null, answers:{}, shownAt:0 };
function lsGet(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function persist(){ lsSet(LS_KEY, {run:state.run, i:state.i, answers:state.answers}); }
let memAnon=null;
function anonKey(){
  let k=null; try{ k=localStorage.getItem("kenpo-anon"); }catch(e){}
  if(!k){ k = memAnon || Array.from({length:4},()=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random()*32)]).join(""); memAnon=k; try{ localStorage.setItem("kenpo-anon",k);}catch(e){} }
  return k;
}
let memRun=0;
function newRun(){
  let n=memRun; try{ n=parseInt(localStorage.getItem("kenpo-attempt")||"0",10)||0; }catch(e){}
  n++; memRun=n; try{ localStorage.setItem("kenpo-attempt", String(n)); }catch(e){}
  return n;
}
function examCode(){ return anonKey()+"-"+(state.run||1); }

/* ---------- Googleフォームへの自動送信 ---------- */
const formReady = !!(FORM.action && FORM.fields.code && FORM.fields.question && FORM.fields.answer && FORM.fields.result);
const mode = formReady ? "self" : "none";
function setChip(){
  const chip=document.getElementById("saveChip"), t=document.getElementById("saveChipText");
  chip.classList.remove("on","off");
  if(mode==="self"){ chip.classList.add("on"); t.textContent="自動送信オン"; } else { chip.classList.add("off"); t.textContent="自動送信オフ"; }
}
let chain = Promise.resolve();
function save(rec){ const p = chain.then(()=>doSave(rec)); chain = p.catch(()=>{}); return p; }
async function doSave(rec){
  if(mode!=="self") return false;
  const body = new URLSearchParams();
  body.append("entry."+FORM.fields.code, examCode());
  body.append("entry."+FORM.fields.question, rec.question);
  body.append("entry."+FORM.fields.answer, rec.answer);
  body.append("entry."+FORM.fields.result, rec.result);
  const attempt = ()=>fetch(FORM.action, {method:"POST", mode:"no-cors", body});
  try{ await attempt(); return true; }
  catch(e){ await new Promise(r=>setTimeout(r, 1000+Math.random()*1000)); try{ await attempt(); return true; }catch(e2){ return false; } }
}
function savedText(s){
  if(s==="ok") return "回答を送信しました";
  if(s==="fail") return "送信できませんでした。最後に「結果をコピー」で送ってください";
  if(s==="pending") return "送信中…";
  return "自動送信オフ：最後に「結果をコピー」で送ってください";
}
function qLabel(q,k){ return SET.code+"-Q"+String(k+1).padStart(2,"0")+" "+q.area+"/"+q.topic; }

/* ---------- rendering ---------- */
const main = document.getElementById("main");
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function setTrack(){
  const done = Object.keys(state.answers).length;
  document.getElementById("trackFill").style.width = (done/Q.length*100)+"%";
  document.getElementById("progText").textContent = state.i>=0 && state.i<Q.length ? `${state.i+1} / ${Q.length}` : `全${Q.length}問`;
}
function render(){
  setTrack();
  if(state.i<0) return renderStart();
  if(state.i>=Q.length) return renderResult();
  const q=Q[state.i];
  return q.kind==="essay" ? renderEssay(q) : renderMC(q);
}
function renderStart(){
  const prev = lsGet(LS_KEY);
  const canResume = prev && prev.run && prev.i>=0 && prev.i<Q.length && Object.keys(prev.answers||{}).length>0;
  const nEssay = Q.length-MC.length;
  const areas = [...new Set(Q.map(q=>q.area))];
  main.innerHTML = `
    <section class="card" style="gap:14px">
      <p class="muted small">令和8年度 行政書士試験（11月8日）弱点診断</p>
      <h1>${esc(SET.title)}</h1>
      <p>${esc(SET.lead)}</p>
      <p class="muted small">5肢択一${MC.length}問${nEssay?`・記述${nEssay}問`:""}／目安${SET.minutes}分。出題分野：${esc(areas.join("・"))}</p>
      <p class="note">迷った問題も、勘で選ばずに「いちばん自信のある肢」を選んでください。最後に分野ごとの正答率と弱点が出ます。途中で閉じても、同じiPhoneのSafariなら「続きから」再開できます。${mode==="self"?"回答は1問ごとに自動で送信されます（お名前などは送りません）。":""}</p>
      <div class="row">
        ${canResume ? `<button class="btn" id="resume">続きから（第${prev.i+1}問）</button><button class="btn ghost" id="start">最初から</button>` : `<button class="btn" id="start">はじめる</button>`}
      </div>
    </section>`;
  document.getElementById("start").onclick=()=>{ state.run=newRun(); state.answers={}; state.i=0; persist(); render(); window.scrollTo(0,0); };
  if(canResume) document.getElementById("resume").onclick=()=>{ state.run=prev.run; state.answers=prev.answers; state.i=prev.i; render(); window.scrollTo(0,0); };
}
function head(q){
  return `<div class="qhead"><span class="qno">第${state.i+1}問</span><span class="tag">${esc(q.area)}</span><span class="tag">${esc(q.format)}</span></div>`;
}
function renderMC(q){
  const a = state.answers[q.id];
  const itemsHtml = q.items ? `<div class="items">${q.items.map((t,k)=>`<div><b>${KANA[k]}</b><span>${esc(t)}</span></div>`).join("")}</div>` : "";
  const opts = q.options.map((t,k)=>{
    let cls="opt";
    if(a){ if(k===q.answer) cls+=" is-right"; else if(k===a.choice) cls+=" is-wrong"; else cls+=" dim"; }
    return `<button class="${cls}" data-k="${k}" id="opt-${q.id}-${k}" ${a?"disabled":""}><span class="n">${k+1}</span><span>${esc(t)}</span></button>`;
  }).join("");
  main.innerHTML = `${head(q)}<p class="stem">${q.stem}</p>${itemsHtml}<div class="opts" role="radiogroup" aria-label="選択肢">${opts}</div><div id="after"></div>`;
  if(a) return renderAfter(q, a);
  state.shownAt = Date.now();
  let sel = -1;
  const after = document.getElementById("after");
  after.insertAdjacentHTML("beforebegin", `<div class="confirmbar"><button class="btn" id="confirm" disabled>肢を選んでください</button><p class="note" style="text-align:center">選び直しできます。「確定する」を押すと正解と解説が出ます。</p></div>`);
  const conf = document.getElementById("confirm");
  const btns = main.querySelectorAll(".opt");
  btns.forEach(b=>{
    b.setAttribute("role","radio"); b.setAttribute("aria-checked","false");
    b.onclick=()=>{
      sel = +b.dataset.k;
      btns.forEach(x=>{ const on = +x.dataset.k===sel; x.classList.toggle("is-sel", on); x.setAttribute("aria-checked", on?"true":"false"); });
      conf.disabled = false; conf.textContent = `肢${sel+1}で確定する`;
    };
  });
  conf.onclick=()=>{ if(sel<0) return; choose(q, sel); };
}
function choose(q,k){
  const secs = Math.max(1, Math.round((Date.now()-state.shownAt)/1000));
  const rec = {choice:k, correct:k===q.answer, seconds:secs, saved: mode==="self"?"pending":"off"};
  state.answers[q.id]=rec; persist(); render();
  const after=document.getElementById("after"); if(after) after.scrollIntoView({behavior:"smooth",block:"start"});
  if(rec.saved==="pending"){
    save({question:qLabel(q,state.i), answer:"肢"+(k+1), result:(rec.correct?"○":"×")+" 正解肢"+(q.answer+1)+" "+secs+"秒"}).then(ok=>{
      rec.saved = ok?"ok":"fail"; persist();
      const el=document.getElementById("savenote-"+q.id); if(el) el.textContent=savedText(rec.saved);
    });
  }
}
function next(){ state.i++; persist(); render(); window.scrollTo(0,0); }
function renderAfter(q,a){
  const ok = a.correct;
  const whyHtml = q.items
    ? q.items.map((_,k)=>`<div><span class="mk ${q.itemOk[k]?"o":"x"}">${KANA[k]} ${q.itemOk[k]?"○":"×"}</span><span>${esc(q.itemWhy[k])}</span></div>`).join("")
    : q.why.map((t,k)=>`<div><span class="mk ${k===q.answer?"o":"x"}">肢${k+1}</span><span>${esc(t)}</span></div>`).join("");
  const isLast = state.i===Q.length-1;
  document.getElementById("after").innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="verdict ${ok?"ok":"ng"}">
        <strong>${ok?"正解":"不正解"}　<span style="font-size:15px">正解は肢${q.answer+1}${ok?"":"（あなたの解答は肢"+(a.choice+1)+"）"}</span></strong>
        <span class="savenote" id="savenote-${q.id}">${savedText(a.saved)}</span>
      </div>
      <details open><summary>${q.items?"ア〜オの解説":"肢ごとの解説"}</summary><div class="why">${whyHtml}</div></details>
      ${q.basis&&q.basis.length?`<details><summary>根拠（条文・判例）</summary><ul class="basis">${q.basis.map(b=>`<li>${esc(b)}</li>`).join("")}</ul></details>`:""}
      ${q.tip?`<p class="tip"><b>解き方のコツ</b>　${esc(q.tip)}</p>`:""}
      <button class="btn" id="next">${isLast?"結果を見る":"次の問題へ"}</button>
    </div>`;
  document.getElementById("next").onclick=next;
}
function charLen(s){ return Array.from(s.replace(/\s/g,"")).length; }
function renderEssay(q){
  const a = state.answers[q.id];
  main.innerHTML = `${head(q)}<p class="stem">${q.stem}</p>
    <label for="essay" class="muted small">解答欄（目安は40〜45字。句読点も1字）</label>
    <textarea id="essay" placeholder="ここに解答を書いてください" ${a?"readonly":""}></textarea>
    <div class="count" id="count">0字</div>
    <div id="after"></div>`;
  const ta=document.getElementById("essay"), cnt=document.getElementById("count");
  const drafts = lsGet(DRAFT_KEY)||{};
  ta.value = a ? a.text : (drafts[q.id]||"");
  const upd=()=>{ const n=charLen(ta.value); cnt.textContent=n+"字"; cnt.classList.toggle("over", n>50); };
  upd();
  if(!a){
    state.shownAt = Date.now();
    ta.oninput=()=>{ upd(); const d=lsGet(DRAFT_KEY)||{}; d[q.id]=ta.value; lsSet(DRAFT_KEY,d); };
    document.getElementById("after").innerHTML = `<button class="btn" id="check">答え合わせをする</button>`;
    document.getElementById("check").onclick=()=>{
      const text=ta.value.trim();
      if(!text){ ta.focus(); cnt.textContent="解答を書いてから答え合わせをしてください"; return; }
      const secs=Math.max(1,Math.round((Date.now()-state.shownAt)/1000));
      const checks=q.elements.map(e=>e.kw.some(w=>text.includes(w)));
      state.answers[q.id]={text, checks, seconds:secs, graded:false, saved:"off"}; persist(); render();
    };
  } else renderEssayAfter(q,a);
}
function essayMax(q){ return q.elements.reduce((s,e)=>s+e.pts,0); }
function essayScore(q,checks){ return q.elements.reduce((s,e,k)=>s+(checks[k]?e.pts:0),0); }
function renderEssayAfter(q,a){
  const total=essayMax(q);
  const checksHtml = q.elements.map((e,k)=>`<label for="el-${q.id}-${k}"><input type="checkbox" id="el-${q.id}-${k}" ${a.checks[k]?"checked":""} ${a.graded?"disabled":""}><span>${esc(e.label)}</span><span class="pts">${e.pts}点</span></label>`).join("");
  const isLast = state.i===Q.length-1;
  document.getElementById("after").innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="card"><p class="muted small">模範解答（${charLen(q.model)}字）</p><p class="model">${esc(q.model)}</p></div>
      <div class="card">
        <p><b>採点</b>　自分の解答に入っている要素にチェックしてください。キーワードから自動で仮チェックしています。</p>
        <div class="checks">${checksHtml}</div>
        <p class="score" id="escore">${essayScore(q,a.checks)}<small> / ${total}点</small></p>
        ${a.graded ? `<span class="savenote" id="savenote-${q.id}">${savedText(a.saved)}</span>` : `<button class="btn" id="grade">この採点で確定する</button>`}
      </div>
      <details open><summary>解説</summary><div class="why"><p>${esc(q.explain)}</p></div></details>
      ${q.basis&&q.basis.length?`<details><summary>根拠（条文・判例）</summary><ul class="basis">${q.basis.map(b=>`<li>${esc(b)}</li>`).join("")}</ul></details>`:""}
      ${q.tip?`<p class="tip"><b>メモ</b>　${esc(q.tip)}</p>`:""}
      ${a.graded ? `<button class="btn" id="next">${isLast?"結果を見る":"次の問題へ"}</button>` : ""}
    </div>`;
  if(!a.graded){
    q.elements.forEach((_,k)=>{ document.getElementById("el-"+q.id+"-"+k).onchange=ev=>{ a.checks[k]=ev.target.checked; persist(); document.getElementById("escore").firstChild.nodeValue=essayScore(q,a.checks); }; });
    document.getElementById("grade").onclick=()=>{
      a.graded=true; a.score=essayScore(q,a.checks); a.saved=mode==="self"?"pending":"off"; persist();
      const d=lsGet(DRAFT_KEY)||{}; delete d[q.id]; lsSet(DRAFT_KEY,d);
      render();
      if(a.saved==="pending"){
        save({question:qLabel(q,state.i), answer:a.text, result:"記述 "+a.score+"/"+total+"点 ["+q.elements.map((e,k)=>(a.checks[k]?"○":"×")).join("")+"] "+a.seconds+"秒"}).then(ok=>{
          a.saved=ok?"ok":"fail"; persist();
          const el=document.getElementById("savenote-"+q.id); if(el) el.textContent=savedText(a.saved);
        });
      }
    };
  } else document.getElementById("next").onclick=next;
}

/* ---------- results ---------- */
function fmtSec(s){ return s>=60 ? Math.floor(s/60)+"分"+String(s%60).padStart(2,"0")+"秒" : s+"秒"; }
function level(r){ return r<0.6 ? ["weak","要強化"] : r<0.8 ? ["mid","あと一歩"] : ["good","得点源"]; }
function areaStats(){
  const m=new Map();
  Q.forEach(q=>{
    const a=state.answers[q.id]; if(!a) return;
    if(!m.has(q.area)) m.set(q.area,{area:q.area,got:0,max:0});
    const s=m.get(q.area);
    if(q.kind==="essay"){ if(a.graded){ s.got+=a.score/essayMax(q); s.max+=1; } }
    else { s.max+=1; if(a.correct) s.got+=1; }
  });
  return [...m.values()].filter(s=>s.max>0).map(s=>({...s, rate:s.got/s.max})).sort((x,y)=>x.rate-y.rate);
}
function totals(){
  const mcOk=MC.filter(q=>state.answers[q.id]&&state.answers[q.id].correct).length;
  const es=Q.filter(q=>q.kind==="essay");
  const eGot=es.reduce((s,q)=>s+((state.answers[q.id]&&state.answers[q.id].graded)?state.answers[q.id].score:0),0);
  const eMax=es.reduce((s,q)=>s+essayMax(q),0);
  return {mcOk, eGot, eMax, es};
}
function summaryText(){
  const d=new Date(); const p=n=>String(n).padStart(2,"0");
  const stamp=`${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  const t=totals();
  const lines=[`【${SET.title} 結果】${stamp} 受験コード ${examCode()}`, `択一 ${t.mcOk}/${MC.length}問（${Math.round(t.mcOk/MC.length*100)}%）`+(t.es.length?` 記述 ${t.eGot}/${t.eMax}点`:"")];
  lines.push("■分野別");
  areaStats().forEach(s=>lines.push(`${s.area} ${Math.round(s.rate*100)}%（${level(s.rate)[1]}）`));
  lines.push("■各問");
  Q.forEach((q,k)=>{
    const a=state.answers[q.id];
    if(!a){ lines.push(`Q${k+1} 未解答 ${q.area}/${q.topic}`); return; }
    if(q.kind==="essay"){ lines.push(`Q${k+1} 記述 ${a.graded?a.score+"/"+essayMax(q)+"点":"未採点"} ${q.area}/${q.topic}`); lines.push(`  解答: ${a.text}`); }
    else lines.push(`Q${k+1} ${a.correct?"○":"×"} 肢${a.choice+1}（正解${q.answer+1}・${fmtSec(a.seconds)}） ${q.area}/${q.topic}`);
  });
  return lines.join("\n");
}
function renderResult(){
  const t=totals();
  const totalSec=Object.values(state.answers).reduce((s,a)=>s+(a.seconds||0),0);
  const anyFail = Object.values(state.answers).some(a=>a.saved==="fail"||a.saved==="off");
  const stats = areaStats();
  lsSet(SUM_KEY, {mcOk:t.mcOk, mcN:MC.length, eGot:t.eGot, eMax:t.eMax, at:Date.now(), weak:stats.filter(s=>s.rate<0.6).map(s=>s.area)});
  const areasHtml = stats.map(s=>{ const [cls,lab]=level(s.rate); const col = cls==="weak"?"var(--ng)":cls==="mid"?"var(--mid)":"var(--ok)";
    return `<div class="area"><span class="nm">${esc(s.area)}<span class="lv ${cls}">${lab}</span></span><span class="val">${Math.round(s.rate*100)}%（${Math.round(s.got*10)/10}/${s.max}）</span><span class="meter"><span style="width:${Math.max(3,Math.round(s.rate*100))}%;background:${col}"></span></span></div>`; }).join("");
  const missed = Q.filter(q=>{ const a=state.answers[q.id]; return a && (q.kind==="essay" ? (a.graded && a.score<essayMax(q)*0.6) : !a.correct); });
  const rows=Q.map((q,k)=>{
    const a=state.answers[q.id];
    if(!a) return `<tr><td>${k+1}</td><td>${esc(q.area)}</td><td>—</td><td>—</td></tr>`;
    if(q.kind==="essay") return `<tr><td>${k+1}</td><td>${esc(q.area)}</td><td>${a.graded?a.score+"/"+essayMax(q):"未採点"}</td><td>${fmtSec(a.seconds)}</td></tr>`;
    return `<tr><td>${k+1}</td><td>${esc(q.area)}</td><td class="${a.correct?"o":"x"}">${a.correct?"○":"×"} ${a.choice+1}</td><td>${fmtSec(a.seconds)}</td></tr>`;
  }).join("");
  main.innerHTML = `
    <div class="qhead"><h2>結果</h2><span class="tag">受験コード ${esc(examCode())}</span></div>
    <div class="card">
      <p class="muted small">5肢択一の正答率</p>
      <p class="score">${Math.round(t.mcOk/MC.length*100)}%<small>　${t.mcOk} / ${MC.length}問</small></p>
    </div>
    <div class="stats">
      <div><b>${t.es.length?t.eGot+"/"+t.eMax:"—"}</b><span>記述</span></div>
      <div><b>${t.mcOk*PT}</b><span>択一（${MC.length*PT}点中）</span></div>
      <div><b>${fmtSec(totalSec)}</b><span>合計時間</span></div>
    </div>
    <section class="card"><h2>分野別の正答率</h2><p class="note">60%未満は「要強化」、80%以上は「得点源」です。</p><div class="areas">${areasHtml}</div></section>
    ${missed.length?`<section class="card"><h2>復習する論点</h2><ul class="misslist">${missed.map(q=>`<li>第${Q.indexOf(q)+1}問　${esc(q.area)}／${esc(q.topic)}</li>`).join("")}</ul></section>`:""}
    <div class="tbl"><table><thead><tr><th>問</th><th>分野</th><th>結果</th><th>時間</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="card">
      <p><b>結果を送る</b></p>
      <p class="note">${mode!=="self" ? "下のボタンで結果をコピーし、LINEなどで送ってください。" : anyFail ? "一部の回答が自動送信されていません。下のボタンで結果をコピーし、LINEなどで送ってください。" : "回答は自動送信済みです。念のため、結果をコピーして送ることもできます。"}</p>
      <button class="btn${anyFail?"":" ghost"}" id="copy">結果をコピー</button>
      <p class="toast" id="toast"></p>
      <textarea id="copytext" class="copybox" readonly hidden></textarea>
    </div>
    <div class="row"><a class="btn" href="./">セット一覧へ</a><button class="btn ghost" id="again">最初から解き直す</button></div>`;
  document.getElementById("copy").onclick=async()=>{
    const tx=summaryText(), toast=document.getElementById("toast"), box=document.getElementById("copytext");
    try{ await navigator.clipboard.writeText(tx); toast.textContent="コピーしました。LINEなどに貼り付けて送ってください。"; box.hidden=true; }
    catch(err){ box.value=tx; box.hidden=false; box.focus(); box.select(); toast.textContent="自動でコピーできませんでした。下の文章を長押しして「すべてを選択」→「コピー」してください。"; }
  };
  document.getElementById("again").onclick=()=>{ state.run=newRun(); state.answers={}; state.i=0; persist(); render(); window.scrollTo(0,0); };
}
document.getElementById("setName").textContent = SET.title;
setChip();
render();
