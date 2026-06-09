// ===== Typer Mundial 2026 — frontend =====
const API = '/api';
let state = {
  token: localStorage.getItem('m26_token') || null,
  user: JSON.parse(localStorage.getItem('m26_user') || 'null'),
  view: 'matches',
  matches: [],
  leaderboard: [],
  filter: 'upcoming',
  authMode: 'login',
  special: null,        // typy specjalne usera + status
  specialDraft: {},     // robocze wybory zanim zapisze
};

// Drużyny w każdej grupie (do typowania zwycięzcy grupy)
const GROUP_TEAMS = {
  'A':['Mexico','South Africa','South Korea','Czechia'],
  'B':['Canada','Bosnia & Herzegovina','Qatar','Switzerland'],
  'C':['Brazil','Morocco','Haiti','Scotland'],
  'D':['USA','Paraguay','Australia','Türkiye'],
  'E':['Germany','Curaçao','Ivory Coast','Ecuador'],
  'F':['Netherlands','Japan','Sweden','Tunisia'],
  'G':['Belgium','Egypt','Iran','New Zealand'],
  'H':['Spain','Cape Verde','Saudi Arabia','Uruguay'],
  'I':['France','Senegal','Iraq','Norway'],
  'J':['Argentina','Algeria','Austria','Jordan'],
  'K':['Portugal','DR Congo','Uzbekistan','Colombia'],
  'L':['England','Croatia','Ghana','Panama'],
};
const GROUP_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
function allTeamsSorted(){ return GROUP_LETTERS.flatMap(g => GROUP_TEAMS[g]).sort((a,b)=> teamName(a).localeCompare(teamName(b))); }

// Mapowanie nazw drużyn -> flagi emoji
// Kody krajów dla obrazków flag (flagcdn.com) — działają na każdym systemie, też Windows
const FLAGS = {
  'Mexico':'mx','South Africa':'za','South Korea':'kr','Czechia':'cz',
  'Canada':'ca','Bosnia & Herzegovina':'ba','USA':'us','Paraguay':'py',
  'Qatar':'qa','Switzerland':'ch','Brazil':'br','Morocco':'ma',
  'Haiti':'ht','Scotland':'gb-sct','Australia':'au','Türkiye':'tr',
  'Germany':'de','Curaçao':'cw','Netherlands':'nl','Japan':'jp',
  'Ivory Coast':'ci','Ecuador':'ec','Sweden':'se','Tunisia':'tn',
  'Spain':'es','Cape Verde':'cv','Belgium':'be','Egypt':'eg',
  'Saudi Arabia':'sa','Uruguay':'uy','Iran':'ir','New Zealand':'nz',
  'France':'fr','Senegal':'sn','Iraq':'iq','Norway':'no',
  'Argentina':'ar','Algeria':'dz','Austria':'at','Jordan':'jo',
  'Portugal':'pt','DR Congo':'cd','England':'gb-eng','Croatia':'hr',
  'Ghana':'gh','Panama':'pa','Uzbekistan':'uz','Colombia':'co',
};
// Polskie nazwy drużyn
const PL = {
  'Mexico':'Meksyk','South Africa':'RPA','South Korea':'Korea Płd.','Czechia':'Czechy',
  'Canada':'Kanada','Bosnia & Herzegovina':'Bośnia i Herc.','USA':'USA','Paraguay':'Paragwaj',
  'Qatar':'Katar','Switzerland':'Szwajcaria','Brazil':'Brazylia','Morocco':'Maroko',
  'Haiti':'Haiti','Scotland':'Szkocja','Australia':'Australia','Türkiye':'Turcja',
  'Germany':'Niemcy','Curaçao':'Curaçao','Netherlands':'Holandia','Japan':'Japonia',
  'Ivory Coast':'Wyb. K. Słon.','Ecuador':'Ekwador','Sweden':'Szwecja','Tunisia':'Tunezja',
  'Spain':'Hiszpania','Cape Verde':'Rep. Ziel. Przyl.','Belgium':'Belgia','Egypt':'Egipt',
  'Saudi Arabia':'Arabia Saud.','Uruguay':'Urugwaj','Iran':'Iran','New Zealand':'Nowa Zelandia',
  'France':'Francja','Senegal':'Senegal','Iraq':'Irak','Norway':'Norwegia',
  'Argentina':'Argentyna','Algeria':'Algieria','Austria':'Austria','Jordan':'Jordania',
  'Portugal':'Portugalia','DR Congo':'DR Konga','England':'Anglia','Croatia':'Chorwacja',
  'Ghana':'Ghana','Panama':'Panama','Uzbekistan':'Uzbekistan','Colombia':'Kolumbia',
};
const STAGE_PL = {group:'Faza grupowa',R32:'1/16 finału',R16:'1/8 finału',QF:'Ćwierćfinał',SF:'Półfinał','3rd':'Mecz o 3. miejsce',Final:'FINAŁ'};

function flag(t){
  const code = FLAGS[t];
  if(!code) return `<span class="flag-fallback">⚽</span>`;
  // flagcdn: obrazek 80px szerokości, wyświetlany jako ~40px (retina)
  return `<img class="flag-img" src="https://flagcdn.com/w80/${code}.png" alt="${t}" loading="lazy">`;
}
function teamName(t){ return PL[t] || t; }

// ---- API helper ----
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers||{}) };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  const res = await fetch(API + path, { ...opts, headers });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || 'Błąd serwera');
  return data;
}

function saveSession(token, user){
  state.token = token; state.user = user;
  localStorage.setItem('m26_token', token);
  localStorage.setItem('m26_user', JSON.stringify(user));
}
function logout(){
  state.token=null;state.user=null;
  localStorage.removeItem('m26_token');localStorage.removeItem('m26_user');
  render();
}

let toastT;
function toast(msg){
  const old=document.querySelector('.toast'); if(old)old.remove();
  const el=document.createElement('div');el.className='toast';el.textContent=msg;
  document.body.appendChild(el);
  clearTimeout(toastT);toastT=setTimeout(()=>el.remove(),2200);
}

// ---- formatowanie daty (lokalna strefa przeglądarki) ----
function fmtDay(iso){
  const d=new Date(iso);
  return d.toLocaleDateString('pl-PL',{weekday:'long',day:'numeric',month:'long'});
}
function fmtTime(iso){
  const d=new Date(iso);
  return d.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'});
}
function dayKey(iso){ return new Date(iso).toLocaleDateString('pl-PL',{year:'numeric',month:'2-digit',day:'2-digit'}); }

// ================= RENDER =================
function render(){
  const app=document.getElementById('app');
  if(!state.user){ app.innerHTML=renderAuth(); bindAuth(); return; }
  app.innerHTML = renderHeader() + `<div class="wrap">${renderNav()}<div id="content"></div></div>`;
  bindHeader();
  renderContent();
}

function renderHeader(){
  const me = state.leaderboard.find(r=>r.id===state.user.id);
  const pts = me ? me.total : 0;
  return `<header><div class="hd">
    <div class="logo" id="logoHome" style="cursor:pointer"><div class="goat">🐐</div><b>MUNDIAL<span>26</span></b></div>
    <div class="userbox">
      <span class="pts">${pts} pkt</span>
      <span>${state.user.display_name}</span>
      <button class="btn btn-ghost" id="logoutBtn">Wyloguj</button>
    </div>
  </div></header>`;
}

function renderNav(){
  const tabs=[['matches','Mecze'],['special','Typy specjalne'],['leaderboard','Ranking'],['rules','Zasady']];
  if(state.user.is_admin) tabs.push(['admin','Panel admina']);
  return `<nav>${tabs.map(([k,l])=>
    `<div class="tab ${state.view===k?'active':''}" data-view="${k}">${l}</div>`).join('')}</nav>`;
}

function renderAuth(){
  const isLogin = state.authMode==='login';
  return `<div class="auth-screen"><div class="wrap"><div class="auth-card">
    <div class="logo" style="margin-bottom:18px"><div class="goat">🐐</div><b style="font-size:30px">MUNDIAL<span>26</span></b></div>
    <h2>${isLogin?'Zaloguj się':'Załóż konto'}</h2>
    <div class="sub">Typer Mistrzostw Świata 2026, graj ze znajomymi</div>
    <div id="authMsg"></div>
    ${!isLogin?`<div class="field"><label>Nazwa wyświetlana</label><input id="f_display" placeholder="np. Kuba" maxlength="30"></div>`:''}
    <div class="field"><label>Login</label><input id="f_user" placeholder="login" autocomplete="username"></div>
    <div class="field"><label>Hasło</label><input id="f_pass" type="password" placeholder="hasło" autocomplete="${isLogin?'current-password':'new-password'}"></div>
    ${!isLogin?`<div class="field"><label>Hasło rejestracji</label><input id="f_invite" type="password" placeholder="hasło dla znajomych"></div>`:''}
    <button class="btn btn-green" id="authBtn" style="width:100%;margin-top:8px">${isLogin?'Wejdź do gry':'Zarejestruj się'}</button>
    <div class="auth-toggle">${isLogin?'Nie masz konta?':'Masz już konto?'}
      <a id="toggleAuth">${isLogin?'Zarejestruj się':'Zaloguj się'}</a></div>
  </div></div></div>`;
}

function bindAuth(){
  document.getElementById('toggleAuth').onclick=()=>{
    state.authMode = state.authMode==='login'?'register':'login'; render();
  };
  const submit=async()=>{
    const msg=document.getElementById('authMsg');
    msg.innerHTML='';
    const username=document.getElementById('f_user').value.trim();
    const password=document.getElementById('f_pass').value;
    try{
      let data;
      if(state.authMode==='login'){
        data=await api('/login',{method:'POST',body:JSON.stringify({username,password})});
        state.view='matches';
      }else{
        const display_name=document.getElementById('f_display').value.trim();
        const invite=document.getElementById('f_invite').value.trim();
        data=await api('/register',{method:'POST',body:JSON.stringify({username,password,display_name,invite})});
        state.view='rules';  // nowy gracz widzi najpierw zasady
        state.justRegistered=true;
      }
      saveSession(data.token,data.user);
      await loadAll(); render();
    }catch(e){
      msg.innerHTML=`<div class="msg error">${e.message}</div>`;
    }
  };
  document.getElementById('authBtn').onclick=submit;
  document.getElementById('f_pass').addEventListener('keydown',e=>{if(e.key==='Enter')submit();});
}

function bindHeader(){
  document.getElementById('logoutBtn').onclick=logout;
  const logo=document.getElementById('logoHome');
  if(logo) logo.onclick=()=>{ state.view='matches'; state.filter='upcoming'; render(); };
  document.querySelectorAll('.tab').forEach(t=>{
    t.onclick=()=>{ state.view=t.dataset.view; state.justRegistered=false; render(); };
  });
}

function renderContent(){
  const c=document.getElementById('content');
  if(state.view==='matches') c.innerHTML=renderMatches();
  else if(state.view==='special'){ c.innerHTML=renderSpecial(); loadSpecial(); }
  else if(state.view==='leaderboard') c.innerHTML=renderLeaderboard();
  else if(state.view==='rules') c.innerHTML=renderRules();
  else if(state.view==='admin'){ c.innerHTML=renderAdmin(); loadAdminUsers(); }
  bindContent();
}

async function loadSpecial(){
  try{
    const data=await api('/special');
    state.special=data;
    if(state.view==='special'){
      document.getElementById('content').innerHTML=renderSpecial();
      bindContent();
    }
  }catch(e){ /* ignoruj */ }
}

async function loadAdminUsers(){
  try{
    const [usersData] = await Promise.all([ api('/admin-users') ]);
    state.adminUsers=usersData.users;
    // dociągnij wyniki specjalne (dla sekcji w panelu)
    try{ state.special = await api('/special'); }catch(e){}
    if(state.view==='admin'){
      document.getElementById('content').innerHTML=renderAdmin();
      bindContent();
    }
  }catch(e){ /* brak uprawnień itp. — ignoruj */ }
}

// ---- MECZE ----
function renderMatches(){
  let list=[...state.matches];
  const now=Date.now();
  if(state.filter==='upcoming') list=list.filter(m=>!m.finished);
  else if(state.filter==='finished') list=list.filter(m=>m.finished);
  else if(state.filter==='mine') list=list.filter(m=>m.prediction);

  const chips=[['upcoming','Nadchodzące'],['mine','Moje typy'],['finished','Rozegrane'],['all','Wszystkie']];
  let html=`<div class="filterbar">${chips.map(([k,l])=>
    `<div class="chip ${state.filter===k?'active':''}" data-filter="${k}">${l}</div>`).join('')}</div>`;

  if(!list.length){ return html+`<div class="empty">Brak meczów w tym widoku ⚽</div>`; }

  // grupowanie po dniach
  const days={};
  for(const m of list){ (days[dayKey(m.kickoff)] ||= []).push(m); }
  for(const k of Object.keys(days)){
    const dayLabel=fmtDay(days[k][0].kickoff);
    html+=`<div class="daygroup"><div class="dayhead">${dayLabel}</div>`;
    for(const m of days[k]) html+=matchCard(m);
    html+=`</div>`;
  }
  return html;
}

function matchCard(m){
  const stageLabel = m.stage==='group' ? `Grupa ${m.group}` : (STAGE_PL[m.group]||'Faza pucharowa');
  let statusHtml,scoreSection;

  if(m.finished){
    scoreSection=`<div class="result-badge">${m.home_score} : ${m.away_score}</div>`;
    let ptsHtml='';
    if(m.prediction){
      const p=m.prediction.points;
      const cls = p===10?'hit10':(p===5?'hit5':'hit0');
      ptsHtml=`<div class="your-pts ${cls}">Twój typ ${m.prediction.home}:${m.prediction.away} → +${p??0} pkt</div>`;
    }else{
      ptsHtml=`<div class="saved-pred">Nie obstawiłeś</div>`;
    }
    statusHtml=`<div class="status"><span class="dot done"></span>Zakończony</div>${ptsHtml}`;
  } else if(m.locked){
    if(m.prediction){
      scoreSection=`<div class="score-in"><div style="font-family:Bebas Neue;font-size:28px">${m.prediction.home}</div><span class="sep">:</span><div style="font-family:Bebas Neue;font-size:28px">${m.prediction.away}</div></div>`;
    }else{
      scoreSection=`<div class="vs">VS</div>`;
    }
    const pred = m.prediction?`<div class="saved-pred">Twój typ: <b>${m.prediction.home}:${m.prediction.away}</b></div>`:`<div class="saved-pred">Nie obstawiłeś</div>`;
    statusHtml=`<div class="status"><span class="dot locked"></span>Zamknięte</div>${pred}`;
  } else {
    const ph = m.prediction?m.prediction.home:'';
    const pa = m.prediction?m.prediction.away:'';
    scoreSection=`<div class="score-in">
      <input type="number" min="0" max="99" id="h_${m.id}" value="${ph}" placeholder="-">
      <span class="sep">:</span>
      <input type="number" min="0" max="99" id="a_${m.id}" value="${pa}" placeholder="-">
    </div>`;
    statusHtml=`<div class="status"><span class="dot open"></span>Otwarte do ${fmtTime(m.kickoff)}</div>
      <button class="btn btn-green" data-save="${m.id}">${m.prediction?'Zmień typ':'Obstaw'}</button>`;
  }

  return `<div class="match ${m.locked&&!m.finished?'locked':''}">
    <div class="match-top">
      <span class="tag ${m.stage==='group'?'grp':''}">${stageLabel}</span>
      <span class="kotime">${fmtTime(m.kickoff)}</span>
    </div>
    <div class="teams">
      <div class="team"><div class="flag">${flag(m.home)}</div><div class="nm">${teamName(m.home)}</div></div>
      ${scoreSection}
      <div class="team"><div class="flag">${flag(m.away)}</div><div class="nm">${teamName(m.away)}</div></div>
    </div>
    <div class="match-actions">${statusHtml}</div>
  </div>`;
}

// ---- RANKING ----
function renderLeaderboard(){
  if(!state.leaderboard.length) return `<div class="empty">Brak danych rankingu</div>`;
  let html=`<div class="lb"><div class="lb-row head"><div>#</div><div>Gracz</div><div style="text-align:right">Punkty</div></div>`;
  for(const r of state.leaderboard){
    const me=r.id===state.user.id?'me':'';
    const medal=r.rank===1?'gold':r.rank===2?'silver':r.rank===3?'bronze':'';
    html+=`<div class="lb-row ${me}">
      <div class="lb-rank ${medal}">${r.rank}</div>
      <div class="lb-name">${r.name}${me?' <span style="color:var(--green)">(Ty)</span>':''}
        <small>${r.played} typów · ${r.exact_hits}× dokładnie${r.special_pts?' · '+r.special_pts+' pkt specjalnych 🏆':''}</small></div>
      <div class="lb-total">${r.total}<small> pkt</small></div>
    </div>`;
  }
  html+=`</div>`;
  return html;
}

// ---- TYPY SPECJALNE ----
function renderSpecial(){
  if(!state.special){ return `<div class="loading">Ładowanie...</div>`; }
  const sp=state.special;
  const locked=sp.locked;
  const preds=sp.predictions||{};
  const results=sp.results||{};

  // pomocnik: pobierz aktualny wybór (draft > zapisany)
  const cur=(key)=> (state.specialDraft[key]!==undefined ? state.specialDraft[key] : (preds[key]?preds[key].team:''));

  let html='';

  // Nagłówek / status
  if(locked){
    html+=`<div class="info-card"><h3>Typy specjalne</h3>
      <p style="color:var(--muted);font-size:14px">Obstawianie jest <b style="color:var(--red)">zamknięte</b> — Mundial wystartował. Poniżej Twoje typy. Punkty doliczą się po wyłonieniu zwycięzców grup (3 pkt) i mistrza (15 pkt).</p></div>`;
  } else {
    const lt=sp.lock_time?`${fmtDay(sp.lock_time)} ${fmtTime(sp.lock_time)}`:'startu Mundialu';
    html+=`<div class="info-card" style="border-color:var(--green)"><h3 style="color:var(--green)">Typy specjalne 🏆</h3>
      <p style="color:var(--muted);font-size:14px">Obstaw <b style="color:var(--txt)">zwycięzcę każdej grupy</b> (3 pkt za trafienie) oraz <b style="color:var(--txt)">mistrza Mundialu</b> (15 pkt). Można to zrobić tylko do <b style="color:var(--txt)">${lt}</b>. Potem zablokowane na stałe!</p></div>`;
  }

  // MISTRZ
  const champKey='champion:WC';
  const champPicked=cur(champKey);
  html+=`<div class="info-card"><h3>🏆 Mistrz Mundialu <span style="color:var(--gold);font-size:16px">15 pkt</span></h3>`;
  if(locked){
    const realChamp=results[champKey];
    const p=preds[champKey];
    html+=`<div style="font-size:16px;font-weight:700">${p?teamName(p.team):'<span style="color:var(--muted)">nie obstawiłeś</span>'}</div>`;
    if(realChamp) html+=`<div style="font-size:13px;color:var(--muted);margin-top:6px">Mistrz: <b style="color:var(--txt)">${teamName(realChamp)}</b> ${p?(p.points>0?'· +15 pkt ✅':'· 0 pkt'):''}</div>`;
  } else {
    html+=`<select class="special-select" data-key="${champKey}" data-kind="champion" data-betkey="WC">
      <option value="">— wybierz drużynę —</option>
      ${allTeamsSorted().map(t=>`<option value="${t}" ${champPicked===t?'selected':''}>${teamName(t)}</option>`).join('')}
    </select>`;
  }
  html+=`</div>`;

  // GRUPY
  html+=`<div class="info-card"><h3>Zwycięzcy grup <span style="color:var(--gold);font-size:16px">3 pkt każda</span></h3>
    <p style="color:var(--muted);font-size:13px;margin-bottom:14px">Kto zajmie 1. miejsce w każdej grupie?</p>
    <div class="special-grid">`;
  for(const g of GROUP_LETTERS){
    const key='group:'+g;
    const picked=cur(key);
    html+=`<div class="special-group">
      <div class="special-group-label">Grupa ${g}</div>`;
    if(locked){
      const real=results[key];
      const p=preds[key];
      html+=`<div class="special-locked-pick">${p?teamName(p.team):'<span style="color:var(--muted)">—</span>'}`;
      if(real) html+=` <span style="font-size:12px;color:${p&&p.points>0?'var(--green)':'var(--muted)'}">${p&&p.points>0?'✅':'❌ '+teamName(real)}</span>`;
      html+=`</div>`;
    } else {
      html+=`<select class="special-select" data-key="${key}" data-kind="group" data-betkey="${g}">
        <option value="">— wybierz —</option>
        ${GROUP_TEAMS[g].slice().sort((a,b)=>teamName(a).localeCompare(teamName(b))).map(t=>`<option value="${t}" ${picked===t?'selected':''}>${teamName(t)}</option>`).join('')}
      </select>`;
    }
    html+=`</div>`;
  }
  html+=`</div>`;
  if(!locked){
    html+=`<button class="btn btn-green" id="saveSpecial" style="width:100%;margin-top:18px;padding:14px">Zapisz typy specjalne</button>`;
  }
  html+=`</div>`;

  return html;
}

// ---- ZASADY ----
function renderRules(){
  const welcome = state.justRegistered ? `<div class="info-card" style="border-color:var(--green)">
    <h3 style="color:var(--green)">Witaj w grze, ${state.user.display_name}! 🐐</h3>
    <p style="color:var(--muted);font-size:14px">Konto założone. Zanim zaczniesz typować, rzuć okiem na zasady. Potem przejdź do zakładki <b style="color:var(--txt)">Mecze</b> i obstaw pierwsze spotkania!</p>
  </div>` : '';
  return welcome + `<div class="info-card">
    <h3>Jak grać?</h3>
    <p style="color:var(--muted);font-size:14px;margin-bottom:18px">Obstaw dokładny wynik każdego meczu. Typować możesz aż do <b style="color:var(--txt)">pierwszego gwizdka</b>, czyli rozpoczęcia meczu. Po starcie meczu typ się blokuje i nie da się go już zmienić. Do tego czasu możesz dowolnie zmieniać swój typ.</p>
    <div class="rule"><div class="pt">10</div><div class="desc"><b>Dokładny wynik</b>Trafiłeś dokładnie liczbę bramek obu drużyn (np. typ 2:1, wynik 2:1)</div></div>
    <div class="rule"><div class="pt">5</div><div class="desc"><b>Trafiony rezultat</b>Trafiłeś kto wygra (lub remis), ale nie dokładny wynik (np. typ 2:0, wynik 3:1)</div></div>
    <div class="rule"><div class="pt">0</div><div class="desc"><b>Pudło</b>Inny rezultat niż obstawiony</div></div>
  </div>
  <div class="info-card">
    <h3>Typy specjalne 🏆</h3>
    <p style="color:var(--muted);font-size:14px;margin-bottom:18px">Przed startem Mundialu (do pierwszego meczu) typujesz zwycięzców grup i mistrza. W zakładce <b style="color:var(--txt)">Typy specjalne</b>. Po starcie zablokowane na stałe.</p>
    <div class="rule"><div class="pt">15</div><div class="desc"><b>Mistrz Mundialu</b>Trafiłeś, kto wygra cały turniej</div></div>
    <div class="rule"><div class="pt">3</div><div class="desc"><b>Zwycięzca grupy</b>Trafiłeś drużynę z 1. miejsca w grupie (za każdą z 12 grup osobno)</div></div>
  </div>
  <div class="info-card">
    <h3>Dla luzu 😎</h3>
    <p style="color:var(--muted);font-size:14px">To zabawa dla znajomych, bez presji. Punkty liczą się automatycznie po wpisaniu wyniku przez administratora. Powodzenia!</p>
  </div>`;
}

// ---- ADMIN ----
function renderAdmin(){
  let html=`<div class="info-card"><h3>Panel administratora</h3>
    <p style="color:var(--muted);font-size:14px">Wpisz wynik po zakończeniu meczu, punkty przeliczą się automatycznie. Dla faz pucharowych możesz też poprawić nazwy drużyn.</p></div>`;

  // Sekcja: zarządzanie graczami
  html+=`<div class="info-card"><h3>Gracze</h3>
    <p style="color:var(--muted);font-size:13px;margin-bottom:14px">Reset hasła ustawia nowe hasło wybranemu graczowi i wylogowuje go ze wszystkich urządzeń. Przekaż mu nowe hasło.</p>
    <div id="adminUsers">`;
  if(state.adminUsers && state.adminUsers.length){
    for(const u of state.adminUsers){
      html+=`<div class="admin-match">
        <div class="nm">${u.display_name} <small>· login: ${u.username}${u.is_admin?' · admin':''}</small></div>
        <div class="admin-ctrl">
          <button class="btn btn-ghost" data-resetpass="${u.id}" data-name="${u.display_name}">Resetuj hasło</button>
        </div>
      </div>`;
    }
  } else {
    html+=`<div style="color:var(--muted);font-size:13px">Ładowanie graczy...</div>`;
  }
  html+=`</div></div>`;

  // Sekcja: wyniki specjalne (zwycięzcy grup + mistrz)
  const results = (state.special && state.special.results) ? state.special.results : {};
  html+=`<div class="info-card"><h3>Typy specjalne — wyniki</h3>
    <p style="color:var(--muted);font-size:13px;margin-bottom:14px">Wpisz zwycięzcę każdej grupy (3 pkt dla graczy) oraz mistrza (15 pkt). Punkty przeliczą się automatycznie.</p>
    <div class="admin-match">
      <div class="nm">🏆 Mistrz Mundialu ${results['champion:WC']?'· <span style="color:var(--green)">'+teamName(results['champion:WC'])+'</span>':''}</div>
      <div class="admin-ctrl">
        <select id="sr_champion_WC" style="background:var(--bg);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:8px;font-size:13px">
          <option value="">— wybierz —</option>
          ${allTeamsSorted().map(t=>`<option value="${t}" ${results['champion:WC']===t?'selected':''}>${teamName(t)}</option>`).join('')}
        </select>
        <button class="btn btn-green" data-specialresult data-kind="champion" data-betkey="WC">Zapisz</button>
        ${results['champion:WC']?'<button class="btn btn-ghost" data-specialclear data-kind="champion" data-betkey="WC">Cofnij</button>':''}
      </div>
    </div>`;
  for(const g of GROUP_LETTERS){
    const key='group:'+g;
    html+=`<div class="admin-match">
      <div class="nm">Grupa ${g} ${results[key]?'· <span style="color:var(--green)">'+teamName(results[key])+'</span>':''}</div>
      <div class="admin-ctrl">
        <select id="sr_group_${g}" style="background:var(--bg);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:8px;font-size:13px">
          <option value="">— wybierz —</option>
          ${GROUP_TEAMS[g].slice().sort((a,b)=>teamName(a).localeCompare(teamName(b))).map(t=>`<option value="${t}" ${results[key]===t?'selected':''}>${teamName(t)}</option>`).join('')}
        </select>
        <button class="btn btn-green" data-specialresult data-kind="group" data-betkey="${g}">Zapisz</button>
        ${results[key]?`<button class="btn btn-ghost" data-specialclear data-kind="group" data-betkey="${g}">Cofnij</button>`:''}
      </div>
    </div>`;
  }
  html+=`</div>`;

  // Sekcja: mecze
  html+=`<div class="info-card" style="padding-bottom:8px"><h3>Wyniki meczów</h3></div>`;
  const list=[...state.matches];
  html+='<div style="margin-top:14px">';
  for(const m of list){
    const done=m.finished;
    html+=`<div class="admin-match">
      <div class="nm">${teamName(m.home)} vs ${teamName(m.away)}
        <small>· ${fmtDay(m.kickoff)} ${fmtTime(m.kickoff)} · ${m.stage==='group'?'Gr. '+m.group:(STAGE_PL[m.group]||'')}</small></div>
      <div class="admin-ctrl">
        <input type="number" min="0" id="ah_${m.id}" value="${m.home_score??''}" placeholder="-">
        <span class="sep">:</span>
        <input type="number" min="0" id="aa_${m.id}" value="${m.away_score??''}" placeholder="-">
        <button class="btn btn-green" data-result="${m.id}">${done?'Popraw':'Zapisz'}</button>
        ${done?`<button class="btn btn-ghost" data-clear="${m.id}">Cofnij</button>`:''}
      </div>
    </div>`;
  }
  html+='</div>';
  return html;
}

// ---- BIND CONTENT ----
function bindContent(){
  document.querySelectorAll('.chip[data-filter]').forEach(ch=>{
    ch.onclick=()=>{ state.filter=ch.dataset.filter; renderContent(); };
  });
  document.querySelectorAll('[data-save]').forEach(b=>{
    b.onclick=()=>savePrediction(parseInt(b.dataset.save));
  });
  document.querySelectorAll('[data-result]').forEach(b=>{
    b.onclick=()=>saveResult(parseInt(b.dataset.result));
  });
  document.querySelectorAll('[data-clear]').forEach(b=>{
    b.onclick=()=>clearResult(parseInt(b.dataset.clear));
  });
  document.querySelectorAll('[data-resetpass]').forEach(b=>{
    b.onclick=()=>resetPassword(parseInt(b.dataset.resetpass), b.dataset.name);
  });
  // Typy specjalne: dropdowny zapisują do draft
  document.querySelectorAll('.special-select').forEach(sel=>{
    sel.onchange=()=>{ state.specialDraft[sel.dataset.key]=sel.value; };
  });
  const saveSpec=document.getElementById('saveSpecial');
  if(saveSpec) saveSpec.onclick=saveSpecial;
  // Admin: wyniki specjalne
  document.querySelectorAll('[data-specialresult]').forEach(b=>{
    b.onclick=()=>saveSpecialResult(b.dataset.kind, b.dataset.betkey);
  });
  document.querySelectorAll('[data-specialclear]').forEach(b=>{
    b.onclick=()=>clearSpecialResult(b.dataset.kind, b.dataset.betkey);
  });
}

async function clearSpecialResult(kind, betKey){
  const label = kind==='champion' ? 'mistrza' : 'grupy '+betKey;
  if(!confirm(`Cofnąć wynik dla ${label}? Punkty graczy zostaną wyzerowane.`)) return;
  try{
    await api('/admin-special',{method:'DELETE',body:JSON.stringify({kind,bet_key:betKey})});
    toast('Wynik cofnięty');
    await loadAll();
    if(state.special) await loadSpecial();
    renderContent();
  }catch(e){ toast(e.message); }
}

async function saveSpecial(){
  const sp=state.special;
  if(!sp || sp.locked){ toast('Obstawianie zamknięte'); return; }
  // zbierz wszystkie wybory (draft + zapisane)
  const preds=sp.predictions||{};
  const bets=[];
  // mistrz
  const champ=state.specialDraft['champion:WC']!==undefined?state.specialDraft['champion:WC']:(preds['champion:WC']?preds['champion:WC'].team:'');
  if(champ) bets.push({kind:'champion',bet_key:'WC',team:champ});
  // grupy
  for(const g of GROUP_LETTERS){
    const key='group:'+g;
    const v=state.specialDraft[key]!==undefined?state.specialDraft[key]:(preds[key]?preds[key].team:'');
    if(v) bets.push({kind:'group',bet_key:g,team:v});
  }
  if(!bets.length){ toast('Wybierz przynajmniej jeden typ'); return; }
  try{
    await api('/special',{method:'POST',body:JSON.stringify({bets})});
    state.specialDraft={};
    toast('Typy specjalne zapisane! 🏆');
    await loadSpecial();
  }catch(e){ toast(e.message); }
}

async function saveSpecialResult(kind, betKey){
  const sel=document.getElementById('sr_'+kind+'_'+betKey);
  const team=sel?sel.value:'';
  if(!team){ toast('Wybierz drużynę'); return; }
  try{
    await api('/admin-special',{method:'POST',body:JSON.stringify({kind,bet_key:betKey,team})});
    toast('Wynik zapisany, punkty przeliczone');
    await loadAll();
    if(state.special) await loadSpecial();
    renderContent();
  }catch(e){ toast(e.message); }
}

async function resetPassword(userId, name){
  const newPass=prompt(`Nowe hasło dla gracza "${name}" (min. 4 znaki):`);
  if(newPass===null) return; // anulowano
  if(newPass.length<4){ toast('Hasło musi mieć min. 4 znaki'); return; }
  try{
    await api('/admin-users',{method:'POST',body:JSON.stringify({user_id:userId,new_password:newPass})});
    toast(`Hasło gracza ${name} zmienione`);
  }catch(e){ toast(e.message); }
}

async function savePrediction(id){
  const h=document.getElementById('h_'+id).value;
  const a=document.getElementById('a_'+id).value;
  if(h===''||a===''){ toast('Wpisz oba wyniki'); return; }
  try{
    await api('/predict',{method:'POST',body:JSON.stringify({match_id:id,pred_home:parseInt(h),pred_away:parseInt(a)})});
    const m=state.matches.find(x=>x.id===id);
    m.prediction={home:parseInt(h),away:parseInt(a),points:null};
    toast('Typ zapisany! ⚽');
    renderContent();
  }catch(e){ toast(e.message); }
}

async function saveResult(id){
  const h=document.getElementById('ah_'+id).value;
  const a=document.getElementById('aa_'+id).value;
  if(h===''||a===''){ toast('Wpisz wynik'); return; }
  try{
    await api('/admin-result',{method:'POST',body:JSON.stringify({match_id:id,home_score:parseInt(h),away_score:parseInt(a)})});
    toast('Wynik zapisany, punkty przeliczone');
    await loadAll(); renderContent();
    // odśwież też header (punkty)
    document.querySelector('header').outerHTML=renderHeader(); bindHeader();
  }catch(e){ toast(e.message); }
}

async function clearResult(id){
  if(!confirm('Cofnąć wynik tego meczu?')) return;
  try{
    await api('/admin-result',{method:'DELETE',body:JSON.stringify({match_id:id})});
    toast('Wynik cofnięty');
    await loadAll(); renderContent();
  }catch(e){ toast(e.message); }
}

// ---- ŁADOWANIE DANYCH ----
async function loadAll(){
  const [mRes,lRes]=await Promise.all([
    api('/matches'),
    api('/leaderboard')
  ]);
  state.matches=mRes.matches;
  state.leaderboard=lRes.standings;
}

// ---- START ----
(async function init(){
  if(state.token){
    try{
      const me=await api('/me');
      state.user=me.user;
      localStorage.setItem('m26_user',JSON.stringify(me.user));
      await loadAll();
    }catch(e){ logout(); return; }
  }
  render();
})();
