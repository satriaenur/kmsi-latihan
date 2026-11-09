import { DAYS } from './days.js';
import { TYPES } from './types.js';
import { Abacus, COL_NAMES } from './abacus.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const SUBJ = {
  mat: { name: 'Matematika', icon: '🔢', color: '#FF8A00' },
  eng: { name: 'Bahasa Inggris', icon: '🔤', color: '#8E44D9' },
};
const SEC_PER_Q = 14; // juara emas Final Jatim 2025: 100 poin dalam ±5–7 menit (±25 soal)
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('kmsi:' + k)) ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem('kmsi:' + k, JSON.stringify(v)); },
};
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ================= SPEECH =================
const tts = {
  on: store.get('sound', true), rate: store.get('rate', 1),
  voices: [],
  pick(lang) {
    const v = this.voices.length ? this.voices : (this.voices = speechSynthesis.getVoices());
    const pref = v.filter(x => x.lang.replace('_', '-').toLowerCase().startsWith(lang.toLowerCase()));
    return pref.find(x => /google|siri|enhanced|premium|damayanti|samantha/i.test(x.name)) || pref[0] || null;
  },
  stop() { try { speechSynthesis.cancel(); } catch { } },
  // parts: string (indonesia) atau [[teks, 'id'|'en'], ...]
  speak(parts, alive = () => true) {
    if (typeof parts === 'string') parts = [[parts, 'id']];
    const plain = parts.map(p => p[0]).join(' ');
    const est = Math.max(900, plain.length * 62) / this.rate;
    if (!this.on || !('speechSynthesis' in window)) return new Promise(r => setTimeout(r, est));
    return parts.reduce((p, [t, l]) => p.then(() => new Promise(res => {
      if (!alive() || !t.trim()) return res();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = l === 'en' ? 'en-US' : 'id-ID'; const v = this.pick(u.lang); if (v) u.voice = v;
      u.rate = (l === 'en' ? 0.85 : 1.0) * this.rate;
      let done = false; const fin = () => { if (!done) { done = true; clearTimeout(to); res(); } };
      const to = setTimeout(fin, Math.max(1500, t.length * 110) / this.rate + 1200);
      u.onend = fin; u.onerror = fin;
      speechSynthesis.speak(u);
    })), Promise.resolve());
  },
};
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { tts.voices = speechSynthesis.getVoices(); };
const strip = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.replace(/\s+/g, ' ').trim(); };

// ================= VIDEO PLAYER =================
const player = {
  run: 0, tracked: [],
  open(title, q) {
    this.q = q; this.title = title;
    const el = document.createElement('div'); el.id = 'player';
    el.innerHTML = `<div class="ph"><button class="icon" data-a="close">✕</button><div class="t">🎬 ${title}</div></div>
      <div class="pbar"><i></i></div><div class="stage"></div><div class="cap">…</div>
      <div class="pctl"><button data-a="replay">↺ Ulang</button><button data-a="slow" class="${tts.rate < 1 ? 'on' : ''}">🐢 Pelan</button><button data-a="sound" class="${tts.on ? 'on' : ''}">${tts.on ? '🔊 Suara' : '🔇 Suara'}</button></div>`;
    document.body.appendChild(el); this.el = el;
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      if (a === 'close') this.close();
      if (a === 'replay') this.play();
      if (a === 'slow') { tts.rate = tts.rate < 1 ? 1 : 0.75; store.set('rate', tts.rate); e.target.classList.toggle('on', tts.rate < 1); this.play(); }
      if (a === 'sound') { tts.on = !tts.on; store.set('sound', tts.on); e.target.classList.toggle('on', tts.on); e.target.textContent = tts.on ? '🔊 Suara' : '🔇 Suara'; if (!tts.on) tts.stop(); }
    });
    this.play();
  },
  cleanup() { tts.stop(); this.tracked.forEach(t => t.dispose && t.dispose()); this.tracked = []; },
  close() { this.run++; this.cleanup(); this.el?.remove(); this.el = null; },
  async play() {
    const id = ++this.run; this.cleanup();
    const alive = () => id === this.run && !!this.el;
    const stage = $('.stage', this.el), cap = $('.cap', this.el), bar = $('.pbar i', this.el);
    let n = 0;
    const guard = () => { if (!alive()) throw 'stop'; };
    const ctx = {
      stage,
      $: (s) => stage.querySelector(s), $$: (s) => stage.querySelectorAll(s),
      set: (h) => { ctx.tracked().forEach(t => t.dispose()); player.tracked = []; stage.innerHTML = h; },
      tracked: () => player.tracked,
      track: (o) => { player.tracked.push(o); return o; },
      wait: (ms) => new Promise((r) => setTimeout(r, ms / tts.rate)).then(guard),
      async talk(html, speech, pause = 350) {
        guard(); cap.innerHTML = `<div class="ct">${html}</div>`; n++; bar.style.width = Math.min(96, n * 6) + '%';
        await tts.speak(speech ?? strip(html), alive); guard();
        await ctx.wait(pause);
      },
    };
    stage.innerHTML = ''; cap.textContent = '…'; bar.style.width = '0';
    try {
      await TYPES[this.q.type].video(ctx, this.q);
      bar.style.width = '100%';
      cap.querySelector('.ct')?.insertAdjacentHTML('beforeend', ' <br><small style="color:#bbb">Ketuk ↺ untuk ulang, ✕ untuk kembali ke soal.</small>');
    } catch (e) { if (e !== 'stop') { console.error(e); cap.textContent = 'Video error: ' + e; } }
  },
};

// ================= CONFETTI =================
function confetti(n = 26) {
  const c = document.createElement('div'); c.className = 'confetti';
  const em = ['🎉', '⭐', '🌟', '✨', '🎈', '💛'];
  for (let i = 0; i < n; i++) { const s = document.createElement('i'); s.textContent = em[i % em.length]; s.style.left = Math.random() * 100 + '%'; s.style.animationDelay = Math.random() * 0.5 + 's'; c.appendChild(s); }
  document.body.appendChild(c); setTimeout(() => c.remove(), 2200);
}

// ================= HOME =================
function home() {
  const days = [...DAYS].reverse();
  app.innerHTML = `
  <div class="hero"><h1>Latihan KMSI<br>Level A (TK)</h1><p>Matematika & Bahasa Inggris • 1 hari 1 paket<br>Ada video cara cepat 🎬 di setiap soal</p><div class="big">🏆</div></div>
  <details class="info"><summary>📋 Tentang lomba KMSI</summary><ul>
    <li><b>KMSI</b> = Kompetisi Matematika, Sains & Inggris, oleh Yayasan Pendidikan Intan Mutia (Malang). Motto: <i>Jujur itu Juara</i>.</li>
    <li><b>Level A = TK</b>. Babak: Penyisihan rayon → Final Provinsi → Grand Final Nasional.</li>
    <li>Tiap mapel <b>60 menit</b>, pilihan ganda a–d, jawaban disilang di kertas.</li>
    <li>Nilai: <b>benar +4, salah −1, kosong −1</b>. Peringkat dari <b>nilai lalu kecepatan</b>.</li>
    <li>Final Jatim 2025 Matematika Level A: juara emas nilai <b>100 dalam 5–6 menit</b>. Perak & perunggu juga 100, beda di waktu. <b>Kecepatan menentukan medali!</b></li>
    <li>Jadi latihan ini fokus ke <b>cara cepat</b> + mode <b>Lomba</b> dengan stopwatch.</li>
  </ul></details>
  <h2 class="sect">🧮 Alat</h2>
  <button class="tool" data-go="#/sempoa"><span class="ic">🧮</span><span><b>Sempoa 3D</b><small>Main sempoa: geser manik, tantangan angka</small></span></button>
  <h2 class="sect">📅 Latihan Harian</h2>
  ${days.map(d => {
    const st = (s) => { const b = store.get(`best:${d.id}:${s}`, null); return b ? `⭐ ${b.score}/${b.max} • ${fmt(b.time)}` : 'Belum dicoba'; };
    return `<div class="day"><div class="top"><h3>${d.title}</h3><span class="date">${new Date(d.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}</span></div>
      <div class="subj">${Object.keys(SUBJ).map(s => `<button class="sbtn ${s}" data-day="${d.id}" data-s="${s}"><b>${SUBJ[s].icon} ${SUBJ[s].name}</b><small>${d[s].length} soal</small><small class="stars">${st(s)}</small></button>`).join('')}</div>
      <div class="topics" style="margin:10px 0 0">🔢 ${d.topics.mat}<br>🔤 ${d.topics.eng}</div></div>`;
  }).join('')}
  <div class="foot">Untuk latihan pribadi. Soal dibuat ulang mengikuti pola soal KMSI Level A dan kisi-kisi.<br>Suara memakai suara bawaan HP (Bahasa Indonesia & English).</div>`;
  app.onclick = (e) => {
    const g = e.target.closest('[data-go]'); if (g) location.hash = g.dataset.go;
    const b = e.target.closest('.sbtn'); if (b) chooseMode(+b.dataset.day, b.dataset.s);
  };
}

function chooseMode(day, s) {
  const d = DAYS.find(x => x.id === day);
  const sh = document.createElement('div'); sh.className = 'sheet';
  sh.innerHTML = `<div class="box"><h2>${SUBJ[s].icon} ${SUBJ[s].name} • ${d.title}</h2><p>${d[s].length} soal. Pilih cara main:</p>
    <button class="mode" data-m="belajar"><span class="ic">📖</span><span><b>Belajar</b><small>Langsung tahu benar/salah. Tonton video cara cepat 🎬 di tiap soal.</small></span></button>
    <button class="mode lomba" data-m="lomba"><span class="ic">⏱️</span><span><b>Lomba</b><small>Seperti lomba asli: stopwatch jalan, benar +4, salah −1. Target ±${SEC_PER_Q} detik per soal.</small></span></button>
    <button class="ghost" data-m="x">Batal</button></div>`;
  document.body.appendChild(sh);
  sh.onclick = (e) => {
    const m = e.target.closest('[data-m]')?.dataset.m; if (!m && e.target !== sh) return;
    sh.remove(); if (m && m !== 'x') location.hash = `#/q/${day}/${s}/${m}`;
  };
}

// ================= QUIZ =================
let qcleanup = null;
function quiz(day, s, mode) {
  const d = DAYS.find(x => x.id === day); if (!d) return home();
  const qs = d[s], S = SUBJ[s];
  document.documentElement.style.setProperty('--accent', S.color);
  const st = { i: 0, ans: Array(qs.length).fill(null), t0: Date.now(), done: false, tries: Array(qs.length).fill(0) };
  let timer = null;
  const tick = () => { const t = $('.timer'); if (t) t.textContent = '⏱ ' + fmt((Date.now() - st.t0) / 1000); };
  if (mode === 'lomba') timer = setInterval(tick, 500);
  const exit = () => { clearInterval(timer); qcleanup && qcleanup(); qcleanup = null; tts.stop(); };

  const show = () => {
    qcleanup && qcleanup(); qcleanup = null; tts.stop();
    const q = qs[st.i], R = TYPES[q.type].render(q);
    const cls = R.one ? 'one' : (R.cols3 || R.opts.length === 3) ? 'three' : '';
    const letters = 'abcd';
    app.innerHTML = `
    <div class="qbar"><button class="icon" data-a="home">🏠</button><div class="prog"><i style="width:${(st.i / qs.length) * 100}%"></i></div>
      ${mode === 'lomba' ? '<div class="timer">⏱ 0:00</div>' : `<div class="timer">${st.i + 1}/${qs.length}</div>`}</div>
    <div class="qcard">
      <div class="qno"><span class="n">Soal ${st.i + 1} dari ${qs.length}</span><button class="speak" data-a="speak">🔊 Dengar</button></div>
      <div class="qtext">${R.text}</div>
      <div class="vis">${R.vis}</div>
      <div class="opts ${cls}">${R.opts.map((o, k) => `<button class="opt ${o.pic ? 'pic' : ''}" data-k="${k}"><span class="l">${letters[k]}</span><span class="v">${o.label}</span></button>`).join('')}</div>
      <div id="fb"></div>
      <div class="actions">
        ${mode === 'belajar' ? `<button class="btn video" data-a="video">🎬 Cara Cepat</button>` : `<button class="btn sec" data-a="skip">Lewati</button>`}
        <button class="btn ${mode === 'belajar' ? 'hidden' : 'hidden'}" data-a="next">Lanjut ➜</button>
      </div>
    </div>`;
    if (mode === 'lomba') tick();
    if (R.mount) qcleanup = R.mount($('.vis'));
    const optsEl = app.querySelectorAll('.opt');
    const answered = st.ans[st.i] != null;
    app.onclick = (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'home') { if (confirm('Keluar dari latihan?')) { exit(); location.hash = '#/'; } return; }
      if (a === 'speak') { tts.stop(); tts.speak(R.say); return; }
      if (a === 'video') { player.open(`Cara Cepat • Soal ${st.i + 1}`, q); return; }
      if (a === 'next' || a === 'skip') { if (a === 'skip') st.ans[st.i] = '__skip'; next(); return; }
      const ob = e.target.closest('.opt'); if (!ob) return;
      const o = R.opts[+ob.dataset.k];
      if (mode === 'lomba') {
        st.ans[st.i] = o.v; optsEl.forEach(x => x.classList.remove('sel')); ob.classList.add('sel');
        setTimeout(next, 220); return;
      }
      // belajar
      if (st.ans[st.i] != null && st.ans[st.i] === q.ans) return;
      st.tries[st.i]++;
      const ok = String(o.v) === String(q.ans);
      if (st.tries[st.i] === 1) st.ans[st.i] = o.v; // nilai dari jawaban pertama
      if (ok) {
        ob.classList.add('ok'); if (st.tries[st.i] === 1) confetti(14);
        $('#fb').innerHTML = `<div class="fb ok">✅ <b>Benar!</b> ${st.tries[st.i] === 1 ? 'Hebat! 🌟' : 'Sudah ketemu jawabannya 👍'}</div>`;
        if (o.say) tts.speak([[String(o.say), 'en']]); else tts.speak('Benar!');
        st.ans[st.i] = st.tries[st.i] === 1 ? o.v : (st.ans[st.i]);
        $('[data-a="next"]').classList.remove('hidden');
        $('[data-a="video"]').classList.remove('pulse');
      } else {
        ob.classList.add('bad');
        $('#fb').innerHTML = `<div class="fb bad">❌ Belum tepat. Coba lagi, atau tonton <b>🎬 Cara Cepat</b> dulu.</div>`;
        tts.speak('Belum tepat. Coba lagi ya.');
        $('[data-a="video"]').classList.add('pulse');
      }
    };
    if (answered && mode === 'belajar') $('[data-a="next"]').classList.remove('hidden');
  };
  const next = () => { if (st.i < qs.length - 1) { st.i++; show(); } else finish(); };
  const finish = () => {
    exit(); st.done = true;
    const time = (Date.now() - st.t0) / 1000;
    let benar = 0, salah = 0, kosong = 0;
    qs.forEach((q, i) => { const a = st.ans[i]; if (a == null || a === '__skip') kosong++; else if (String(a) === String(q.ans)) benar++; else salah++; });
    const score = benar * 4 - salah - kosong, max = qs.length * 4;
    const target = qs.length * SEC_PER_Q;
    const key = `best:${day}:${s}`; const best = store.get(key, null);
    if (!best || score > best.score || (score === best.score && time < best.time)) store.set(key, { score, max, time: Math.round(time), mode });
    const pct = score / max;
    const medal = pct === 1 && time <= target ? ['🥇', 'Juara Emas!'] : pct >= 0.9 ? ['🥈', 'Hebat sekali!'] : pct >= 0.7 ? ['🥉', 'Bagus!'] : ['💪', 'Ayo coba lagi!'];
    if (pct >= 0.7) confetti(40);
    app.innerHTML = `
    <div class="qbar"><button class="icon" data-a="home">🏠</button><div class="prog"><i style="width:100%"></i></div></div>
    <div class="res"><div class="big">${medal[0]}</div><h2>${medal[1]}</h2>
      <div class="score">${score} <small style="font-size:20px;color:var(--muted)">/ ${max}</small></div>
      <div class="meta">✅ Benar ${benar} (+${benar * 4}) • ❌ Salah ${salah} (−${salah}) • ⬜ Kosong ${kosong} (−${kosong})<br>
      ⏱ Waktu <b>${fmt(time)}</b> ${mode === 'lomba' ? `• Target juara ${fmt(target)} ${time <= target ? '✅' : '⏳'}` : ''}</div>
      <div class="actions"><button class="btn" data-a="again">↺ Ulangi</button>${mode === 'belajar' ? '<button class="btn sec" data-a="lomba">⏱️ Mode Lomba</button>' : ''}</div>
    </div>
    <h2 class="sect">Pembahasan</h2>
    <div class="rlist">${qs.map((q, i) => { const a = st.ans[i]; const ok = String(a) === String(q.ans); const R = TYPES[q.type].render(q);
      return `<div class="ritem"><span class="m">${ok ? '✅' : a == null || a === '__skip' ? '⬜' : '❌'}</span><span class="q"><b>${i + 1}.</b> ${strip(R.text).slice(0, 70)}<br><small>Jawaban: <b>${q.ans}</b>${!ok && a && a !== '__skip' ? ` • kamu: ${a}` : ''}</small></span><button data-v="${i}">🎬</button></div>`; }).join('')}</div>`;
    app.onclick = (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'home') location.hash = '#/';
      if (a === 'again') { location.hash = '#/'; setTimeout(() => location.hash = `#/q/${day}/${s}/${mode}`, 0); }
      if (a === 'lomba') location.hash = `#/q/${day}/${s}/lomba`;
      const v = e.target.closest('[data-v]'); if (v) player.open(`Cara Cepat • Soal ${+v.dataset.v + 1}`, qs[+v.dataset.v]);
    };
  };
  show();
  return exit;
}

// ================= SEMPOA PAGE =================
function sempoa() {
  let cols = store.get('abcols', 2), ab = null, target = null;
  const render = () => {
    ab && ab.dispose();
    app.innerHTML = `
    <div class="qbar"><button class="icon" data-a="home">🏠</button><h2 style="flex:1">🧮 Sempoa 3D</h2>
      <button class="icon" data-a="cols" style="width:auto;padding:0 12px;font-size:15px">${cols} batang</button></div>
    <div class="spad">
      <div class="target" id="tg">Ketuk manik untuk menggeser. Manik bawah = 1, manik merah = 5.</div>
      <div class="abx" id="ab" style="max-width:${cols === 1 ? 260 : 380}px"></div>
      <div class="ablab" style="max-width:${cols === 1 ? 260 : 380}px">${Array.from({ length: cols }, (_, k) => cols - 1 - k).map(i => `<div data-c="${i}"><b>0</b><small>${COL_NAMES[i]}</small></div>`).join('')}</div>
      <div class="abval" id="val">0</div>
      <div class="actions" style="width:100%"><button class="btn sec" data-a="reset">Nol-kan</button><button class="btn" data-a="challenge">🎯 Tantangan</button></div>
      <div class="actions" style="width:100%;margin-top:0"><button class="btn video" data-a="show">🎬 Tunjukkan caranya</button></div>
    </div>`;
    ab = new Abacus($('#ab'), { cols, interactive: true, onChange: (v, ds) => {
      $('#val').textContent = v;
      ds.forEach((d, i) => { const c = app.querySelector(`.ablab [data-c="${i}"] b`); if (c) c.textContent = d; });
      if (target != null && v === target) { confetti(30); tts.speak(`Hebat! ${target}!`); $('#tg').innerHTML = `✅ Benar! Itu <b>${target}</b>. Ketuk 🎯 untuk tantangan baru.`; target = null; }
    } });
    app.onclick = async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'home') { ab.dispose(); location.hash = '#/'; }
      if (a === 'cols') { cols = cols === 1 ? 2 : cols === 2 ? 3 : 1; store.set('abcols', cols); target = null; render(); }
      if (a === 'reset') ab.set(0);
      if (a === 'challenge') {
        const max = cols === 1 ? 9 : cols === 2 ? 30 : 300;
        target = 1 + Math.floor(Math.random() * max);
        ab.set(0); $('#tg').innerHTML = `🎯 Tunjukkan angka <b style="font-size:26px">${target}</b> di sempoa!`;
        tts.speak(`Tunjukkan angka ${target} di sempoa`);
      }
      if (a === 'show') {
        const v = target ?? (ab.value || 7); const t = target; target = null;
        $('#tg').innerHTML = `Lihat caranya membuat <b>${v}</b>…`;
        ab.set(0);
        for (let i = cols - 1; i >= 0; i--) {
          const d = Math.floor(v / 10 ** i) % 10; if (!d && i) continue;
          const parts = [];
          await new Promise(r => setTimeout(r, 500));
          let cur = ab.digits[i];
          if (d >= 5) { ab.setCol(i, 5); parts.push('manik merah turun (5)'); await tts.speak(`${COL_NAMES[i]}: manik merah turun, lima`); }
          if (d % 5) { ab.setCol(i, d); parts.push(`${d % 5} manik bawah naik`); await tts.speak(`${d % 5} manik bawah naik`); }
          $('#tg').innerHTML = `<b>${COL_NAMES[i]} ${d}</b>: ${parts.join(' + ') || 'kosong'}`;
        }
        await tts.speak(`Jadi ${v}`); $('#tg').innerHTML += `<br>Jadi <b>${v}</b> ✅`;
        if (t != null) target = null;
      }
    };
  };
  render();
  return () => ab && ab.dispose();
}

// ================= ROUTER =================
let leave = null;
function route() {
  leave && leave(); leave = null; player.close();
  document.documentElement.style.setProperty('--accent', '#FF8A00');
  const h = location.hash.split('/');
  window.scrollTo(0, 0);
  if (h[1] === 'q') leave = quiz(+h[2], h[3], h[4]);
  else if (h[1] === 'sempoa') leave = sempoa();
  else home();
}
window.addEventListener('hashchange', route);
route();
