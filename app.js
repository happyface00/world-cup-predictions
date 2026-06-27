const STORE='wc2026_pro_v3';
const ADMIN_PASSWORD='12345';
const CURRENT_USER='wc2026_user';

let db=JSON.parse(localStorage.getItem(STORE)||'null')||{
  players:[{id:'p1',name:'أبوعلي',phone:''}],
  matches:[],
  predictions:{}
};
let currentUser=JSON.parse(localStorage.getItem(CURRENT_USER)||'null');
let isAdmin=false;

const teams=['🇺🇸 أمريكا','🇨🇦 كندا','🇲🇽 المكسيك','🇸🇦 السعودية','🇦🇷 الأرجنتين','🇧🇷 البرازيل','🇫🇷 فرنسا','🇩🇪 ألمانيا','🇪🇸 إسبانيا','🏴 إنجلترا','🇵🇹 البرتغال','🇳🇱 هولندا','🇲🇦 المغرب','🇯🇵 اليابان','🇰🇷 كوريا','🇦🇺 أستراليا'];

if(!db.matches.length){
  for(let i=0;i<8;i++){
    db.matches.push({id:'m'+(i+1),home:teams[i*2],away:teams[i*2+1],kickoff:new Date(Date.now()+(i+1)*86400000).toISOString().slice(0,16),homeScore:null,awayScore:null});
  }
  localStorage.setItem(STORE,JSON.stringify(db));
}

function newId(){return 'x'+Date.now()+Math.random()}
function save(){localStorage.setItem(STORE,JSON.stringify(db))}
function locked(m){return new Date()>=new Date(m.kickoff)}
function outcome(a,b){return +a>+b?'H':+a<+b?'A':'D'}
function calc(m,p){if(!p||p.home===''||p.away===''||m.homeScore===null||m.awayScore===null)return 0;if(+p.home===+m.homeScore&&+p.away===+m.awayScore)return 5;return outcome(p.home,p.away)===outcome(m.homeScore,m.awayScore)?2:0}

function standings(){
  return db.players.map(pl=>{
    let total=db.matches.reduce((s,m)=>s+calc(m,(db.predictions[pl.id]||{})[m.id]),0);
    let count=Object.keys(db.predictions[pl.id]||{}).length;
    return{...pl,total,count}
  }).sort((a,b)=>b.total-a.total||b.count-a.count)
}

function showScreen(screen){
  document.getElementById('loginScreen').style.display=screen==='login'?'flex':'none';
  document.getElementById('mainApp').style.display=screen==='app'?'block':'none';
}

function login(){
  let name=document.getElementById('playerNameInput').value.trim();
  if(!name){alert('اكتب اسمك!');return;}
  
  let player=db.players.find(p=>p.name===name);
  if(!player){
    player={id:newId(),name:name,phone:''};
    db.players.push(player);
    save();
  }
  
  currentUser={id:player.id,name:player.name};
  localStorage.setItem(CURRENT_USER,JSON.stringify(currentUser));
  document.getElementById('playerNameInput').value='';
  showScreen('app');
  render();
}

function logout(){
  currentUser=null;
  localStorage.removeItem(CURRENT_USER);
  showScreen('login');
}

function changeName(){
  let newName=prompt('اسمك الجديد:',currentUser.name);
  if(!newName)return;
  let trimmed=newName.trim();
  if(!trimmed){alert('اكتب اسم!');return;}
  let other=db.players.find(p=>p.id!==currentUser.id&&p.name===trimmed);
  if(other){alert('الاسم موجود!');return;}
  let p=db.players.find(x=>x.id===currentUser.id);
  if(p){p.name=trimmed;currentUser.name=trimmed;localStorage.setItem(CURRENT_USER,JSON.stringify(currentUser));save();render();}
}

// Events
document.getElementById('loginBtn').onclick=login;
document.getElementById('playerNameInput').addEventListener('keypress',e=>{if(e.key==='Enter')login()});
document.getElementById('changeNameBtn').onclick=changeName;

// Nav
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{
  let view=b.dataset.view;
  if(view==='admin'){
    let pass=prompt('كلمة مرور الإدارة:');
    if(pass!==ADMIN_PASSWORD){alert('خطأ!');return;}
    isAdmin=true;
  }
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===view));
  document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
  document.getElementById('pageTitle').textContent=b.textContent;
  render();
});

// Admin
document.getElementById('addPlayerBtn').onclick=()=>{
  if(!isAdmin){alert('ادمن فقط!');return;}
  let name=document.getElementById('playerName').value.trim();
  if(!name)return;
  db.players.push({id:newId(),name,phone:document.getElementById('playerPhone').value.trim()});
  document.getElementById('playerName').value=document.getElementById('playerPhone').value='';
  save();render();
};

document.getElementById('addMatchBtn').onclick=()=>{
  if(!isAdmin){alert('ادمن فقط!');return;}
  let ht=document.getElementById('homeTeam').value.trim();
  let at=document.getElementById('awayTeam').value.trim();
  let ko=document.getElementById('kickoff').value;
  if(!ht||!at||!ko)return;
  db.matches.push({id:newId(),home:ht,away:at,kickoff:ko,homeScore:null,awayScore:null});
  document.getElementById('homeTeam').value=document.getElementById('awayTeam').value=document.getElementById('kickoff').value='';
  save();render();
};

document.getElementById('exportBtn').onclick=()=>{
  if(!isAdmin)return;
  let blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'});
  let a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='data.json';
  a.click();
};

document.getElementById('importBtn').onclick=()=>{
  if(!isAdmin)return;
  document.getElementById('importFile').click();
};

document.getElementById('importFile').onchange=e=>{
  let f=e.target.files[0];
  if(!f)return;
  let r=new FileReader();
  r.onload=()=>{try{db=JSON.parse(r.result);save();render();}catch{alert('خطأ!')}};
  r.readAsText(f);
};

document.getElementById('resetBtn').onclick=()=>{
  if(!isAdmin)return;
  if(confirm('مسح كل البيانات؟')){localStorage.removeItem(STORE);location.reload()}
};

['matchSearch','statusFilter'].forEach(x=>{
  let el=document.getElementById(x);
  if(el)el.addEventListener('input',render);
});

function setPrediction(mid,side,val){
  let m=db.matches.find(x=>x.id===mid);
  if(locked(m))return alert('المباراة مغلقة!');
  let pid=currentUser.id;
  db.predictions[pid]??={};
  db.predictions[pid][mid]??={home:'',away:''};
  db.predictions[pid][mid][side]=val;
  save();
  renderTables();
}

function setResult(mid,h,a){
  if(!isAdmin)return;
  let m=db.matches.find(x=>x.id===mid);
  m.homeScore=h===''?null:+h;
  m.awayScore=a===''?null:+a;
  save();render();
}

function delPlayer(pid){
  if(!isAdmin)return;
  if(confirm('حذف؟')){db.players=db.players.filter(p=>p.id!==pid);delete db.predictions[pid];save();render();}
}

function delMatch(mid){
  if(!isAdmin)return;
  if(confirm('حذف؟')){db.matches=db.matches.filter(m=>m.id!==mid);Object.values(db.predictions).forEach(p=>delete p[mid]);save();render();}
}

function render(){
  if(!currentUser)return;
  document.getElementById('userGreeting').textContent=`👋 ${currentUser.name}`;
  renderTables();
  renderAdmin();
}

function renderTables(){
  let pid=currentUser.id;
  let total=Object.values(db.predictions).reduce((s,p)=>s+Object.keys(p).length,0);
  document.getElementById('statPlayers').textContent=db.players.length;
  document.getElementById('statMatches').textContent=db.matches.length;
  document.getElementById('statPredictions').textContent=total;
  document.getElementById('statTop').textContent=standings()[0]?.total||0;
  
  // Predictions
  let q=(document.getElementById('matchSearch')?.value||'').toLowerCase();
  let f=document.getElementById('statusFilter')?.value||'all';
  let arr=db.matches.filter(m=>(!q||(m.home+m.away).toLowerCase().includes(q))&&(f==='all'||(f==='open'&&!locked(m))||(f==='locked'&&locked(m))));
  document.getElementById('predictionCards').innerHTML=arr.map(m=>{
    let p=(db.predictions[pid]||{})[m.id]||{home:'',away:''};
    return `<div class="match-card"><div class="match-line"><div class="team">${m.home}</div><div class="score">${m.homeScore??'-'} : ${m.awayScore??'-'}</div><div class="team">${m.away}</div></div><span class="pill ${locked(m)?'locked':'open'}">${locked(m)?'🔒':'✅'}</span><div class="prediction-inputs"><input type="number" ${locked(m)?'disabled':''} value="${p.home}" onchange="setPrediction('${m.id}','home',this.value)"><input type="number" ${locked(m)?'disabled':''} value="${p.away}" onchange="setPrediction('${m.id}','away',this.value)"></div><p class="muted">نقاطك: <b>${calc(m,p)}</b></p></div>`;
  }).join('')||'<p>لا توجد مباريات</p>';
  
  // Leaderboard
  document.getElementById('leaderboardTable').innerHTML='<table><tr><th>#</th><th>المشارك</th><th>النقاط</th><th>التوقعات</th></tr>'+standings().map((r,i)=>`<tr><td>${i+1}</td><td>${r.name}</td><td>${r.total}</td><td>${r.count}</td></tr>`).join('')+'</table>';
  
  // Fixtures
  document.getElementById('fixturesList').innerHTML=db.matches.map(m=>`<div class="match-card"><div class="match-line"><div class="team">${m.home}</div><div class="score">${m.homeScore??'-'} : ${m.awayScore??'-'}</div><div class="team">${m.away}</div></div></div>`).join('');
  
  // Dashboard
  document.getElementById('nextMatches').innerHTML=db.matches.slice(0,5).map(m=>`<div class="match-card"><div class="match-line"><div class="team">${m.home}</div><div class="score">${m.homeScore??'-'} : ${m.awayScore??'-'}</div><div class="team">${m.away}</div></div></div>`).join('');
  document.getElementById('topFive').innerHTML='<table><tr><th>#</th><th>المشارك</th><th>النقاط</th></tr>'+standings().slice(0,5).map((r,i)=>`<tr><td>${i+1}</td><td>${r.name}</td><td>${r.total}</td></tr>`).join('')+'</table>';
}

function renderAdmin(){
  if(!isAdmin){document.getElementById('playersList').innerHTML='';document.getElementById('adminResults').innerHTML='';return;}
  document.getElementById('playersList').innerHTML='<table><tr><th>#</th><th>الاسم</th><th>ملاحظة</th><th></th></tr>'+db.players.map((p,i)=>`<tr><td>${i+1}</td><td>${p.name}</td><td>${p.phone||''}</td><td><button class="danger" onclick="delPlayer('${p.id}')">حذف</button></td></tr>`).join('')+'</table>';
  document.getElementById('adminResults').innerHTML='<table><tr><th>المباراة</th><th>البداية</th><th></th><th>النتيجة</th><th></th></tr>'+db.matches.map(m=>`<tr><td>${m.home} ضد ${m.away}</td><td>${m.kickoff}</td><td>${locked(m)?'🔒':'✅'}</td><td><input style="width:60px" type="number" value="${m.homeScore??''}" onchange="setResult('${m.id}',this.value,this.parentElement.parentElement.querySelectorAll('input')[1].value)"> - <input style="width:60px" type="number" value="${m.awayScore??''}" onchange="setResult('${m.id}',this.parentElement.parentElement.querySelectorAll('input')[0].value,this.value)"></td><td><button class="danger" onclick="delMatch('${m.id}')">حذف</button></td></tr>`).join('')+'</table>';
}

// Init
if(currentUser){
  showScreen('app');
  render();
} else {
  showScreen('login');
}
