// Renderer soal + skrip "video cara cepat" untuk setiap tipe soal.
// render(q) -> { text, say, vis, opts:[{v,label,pic?}], mount?(el) -> cleanup }
// video(ctx, q) -> async animasi langkah demi langkah
import { Abacus } from './abacus.js';

export const EN_NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const E = (e, s = 40, cls = '') => `<span class="it emo ${cls}" style="font-size:${s}px">${e}</span>`;
const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const grp = (e, n, s = 34) => `<div class="grp">${rep(n, () => E(e, s)).join('')}</div>`;
const en = (t) => [t, 'en'];

function badge(el, txt, red = false) {
  const b = document.createElement('span'); b.className = 'bd' + (red ? ' r' : ''); b.textContent = txt; el.appendChild(b); return b;
}

// ---------- shapes ----------
const POLY = {
  segitiga: [[50, 8], [94, 88], [6, 88]],
  persegi: [[12, 12], [88, 12], [88, 88], [12, 88]],
  'persegi panjang': [[4, 24], [96, 24], [96, 76], [4, 76]],
  trapesium: [[28, 16], [72, 16], [96, 84], [4, 84]],
  'belah ketupat': [[50, 4], [92, 50], [50, 96], [8, 50]],
};
const FILL = { segitiga: '#FFD43B', persegi: '#4D96FF', 'persegi panjang': '#6BCB77', trapesium: '#FF9F45', 'belah ketupat': '#B983FF', lingkaran: '#FF6B6B' };
export function shapeSVG(kind, size = 120, fill) {
  fill = fill || FILL[kind] || '#ddd';
  if (kind === 'lingkaran') return `<svg width="${size}" height="${size}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="${fill}" stroke="#2B2340" stroke-width="4"/></svg>`;
  const p = POLY[kind];
  const sides = p.map((a, i) => { const b = p[(i + 1) % p.length]; return `<line class="side" data-i="${i}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#2B2340" stroke-width="5" stroke-linecap="round"/>`; }).join('');
  return `<svg width="${size}" height="${size}" viewBox="-6 -6 112 112" style="overflow:visible"><polygon points="${p.map(x => x.join(',')).join(' ')}" fill="${fill}"/>${sides}</svg>`;
}

// rumah dari bangun datar. data-k = jenis bangun
function houseSVG(w = 300) {
  return `<svg class="house" width="${w}" viewBox="0 0 300 210" style="max-width:100%">
  <circle data-k="lingkaran" cx="262" cy="34" r="22" fill="#FFD43B" stroke="#2B2340" stroke-width="3"/>
  <polygon data-k="segitiga" points="60,92 150,30 240,92" fill="#FF6B6B" stroke="#2B2340" stroke-width="3"/>
  <rect data-k="persegi" x="76" y="92" width="148" height="104" fill="#FFE8B0" stroke="#2B2340" stroke-width="3"/>
  <rect data-k="persegi panjang" x="133" y="132" width="34" height="64" fill="#A86B34" stroke="#2B2340" stroke-width="3"/>
  <rect data-k="persegi" x="88" y="110" width="32" height="32" fill="#9ED8FF" stroke="#2B2340" stroke-width="3"/>
  <rect data-k="persegi" x="180" y="110" width="32" height="32" fill="#9ED8FF" stroke="#2B2340" stroke-width="3"/>
  <rect x="28" y="160" width="8" height="36" fill="#8B5A2B"/>
  <polygon data-k="segitiga" points="8,164 32,112 56,164" fill="#43A047" stroke="#2B2340" stroke-width="3"/>
  <rect x="264" y="160" width="8" height="36" fill="#8B5A2B"/>
  <polygon data-k="segitiga" points="244,164 268,112 292,164" fill="#43A047" stroke="#2B2340" stroke-width="3"/>
  <line x1="0" y1="197" x2="300" y2="197" stroke="#2B2340" stroke-width="3"/>
  </svg>`;
}
function svgBadge(svg, el, txt) {
  const bb = el.getBBox(); const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', bb.x + bb.width / 2); c.setAttribute('cy', bb.y + bb.height / 2); c.setAttribute('r', 14); c.setAttribute('fill', '#2F80ED');
  const t = document.createElementNS(ns, 'text'); t.setAttribute('x', bb.x + bb.width / 2); t.setAttribute('y', bb.y + bb.height / 2 + 6); t.setAttribute('text-anchor', 'middle');
  t.setAttribute('font-family', 'Fredoka'); t.setAttribute('font-weight', '700'); t.setAttribute('font-size', '17'); t.setAttribute('fill', '#fff'); t.textContent = txt;
  g.appendChild(c); g.appendChild(t); svg.appendChild(g);
}

// ---------- dice ----------
const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
export function diceSVG(n, s = 84) {
  return `<svg class="dice" width="${s}" height="${s}" viewBox="0 0 100 100"><rect x="4" y="4" width="92" height="92" rx="18" fill="#fff" stroke="#2B2340" stroke-width="4"/>${PIPS[n].map(([x, y]) => `<circle class="pip" cx="${x}" cy="${y}" r="9" fill="#2B2340"/>`).join('')}</svg>`;
}

// pseudo-random tetap untuk posisi acak
function seeded(s) { return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
function scatterPos(n, seed) {
  // grid 4x3 cells, shuffled, jittered inside each cell -> never overlap
  const r = seeded(seed), cells = [];
  for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) cells.push([x, y]);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  return cells.slice(0, n).map(([x, y]) => [3 + x * 23 + r() * 9, 4 + y * 30 + r() * 12]);
}
const digits = (n) => String(n).split('').map(d => `<span>${d}</span>`).join('');

// ---------- abacus helper for videos ----------
async function abacusCount(ctx, ab, from, to, labelEl) {
  const show = () => { if (labelEl) labelEl.textContent = ab.value; };
  const step = to > from ? 1 : -1;
  for (let v = from; v !== to; v += step) {
    const nv = v + step, o = v % 10, no = nv % 10;
    let note = '';
    if (step > 0) {
      if (o === 4) note = 'Manik bawah penuh! <b>Turunkan manik merah (5)</b>, manik bawah turun semua.';
      else if (o === 9) note = 'Penuh! Jadi <b>10</b>: satuan kosong, <b>1 manik puluhan</b> naik.';
      else note = 'Naikkan 1 manik bawah.';
    } else {
      if (o === 5) note = '<b>Naikkan manik merah</b>, turunkan 4 manik bawah.';
      else if (o === 0) note = 'Ambil 1 puluhan, jadi 9 satuan.';
      else note = 'Turunkan 1 manik bawah.';
    }
    ab.set(nv); show();
    await ctx.talk(`<span class="vbig" style="font-size:28px">${nv}</span>&nbsp; ${note}`, String(nv));
  }
}
function abacusBox(ctx, cols, h = 270) {
  const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;width:100%';
  wrap.innerHTML = `<div class="abx" style="height:${h}px;aspect-ratio:auto"></div><div class="abval">0</div>`;
  ctx.stage.appendChild(wrap);
  const ab = ctx.track(new Abacus(wrap.querySelector('.abx'), { cols }));
  return { ab, label: wrap.querySelector('.abval') };
}

// =================== TYPES ===================
export const TYPES = {
  // ---------------- MATEMATIKA ----------------
  add_pic: {
    render: (q) => ({
      text: q.story || `Ada berapa ${q.name} semuanya?`,
      say: q.sayStory || `Ada berapa ${q.name} semuanya?`,
      vis: `<div class="row">${grp(q.e, q.a)}<span class="plus">+</span>${grp(q.e, q.b)}</div>`,
      opts: q.opts.map(v => ({ v, label: v })),
    }),
    async video(ctx, q) {
      const big = Math.max(q.a, q.b), small = Math.min(q.a, q.b), bigFirst = q.a >= q.b;
      ctx.set(`<div class="row" id="g">${grp(q.e, q.a, 38)}<span class="plus">+</span>${grp(q.e, q.b, 38)}</div><div id="ans"></div>`);
      const groups = ctx.$$('.grp');
      await ctx.talk(`Ada <b>${q.a}</b> ${q.name} dan <b>${q.b}</b> ${q.name}.`);
      await ctx.talk(`Cara cepat: <b>HITUNG LANJUT!</b> Jangan hitung dari 1 lagi.`, 'Cara cepat: hitung lanjut! Jangan hitung dari satu lagi.');
      const gb = groups[bigFirst ? 0 : 1], gs = groups[bigFirst ? 1 : 0];
      gb.style.background = '#DCEBFF'; badge(gb, big);
      await ctx.talk(`Simpan angka yang besar di kepala: <b>${big}</b> 🧠`, `Simpan angka yang besar di kepala: ${big}`);
      const its = gs.querySelectorAll('.it');
      for (let i = 0; i < small; i++) { its[i].style.transform = 'scale(1.25)'; badge(its[i], big + i + 1); await ctx.talk(`<span class="vbig">${big + i + 1}</span>`, String(big + i + 1), 500); }
      ctx.$('#ans').innerHTML = `<div class="answer">${q.a} + ${q.b} = ${q.ans}</div>`;
      await ctx.talk(`Jadi <b>${q.a} + ${q.b} = ${q.ans}</b>. Pilih <b>${q.ans}</b>!`, `Jadi ${q.a} tambah ${q.b} sama dengan ${q.ans}`);
      // sempoa
      ctx.set('<div class="vtitle">Sekarang pakai sempoa 🧮</div>');
      const { ab, label } = abacusBox(ctx, 2);
      await ctx.talk('Manik bawah nilainya <b>1</b>. Manik merah di atas nilainya <b>5</b>.', 'Manik bawah nilainya 1. Manik merah di atas nilainya 5.');
      ab.set(big); label.textContent = big;
      await ctx.talk(`Pasang angka <b>${big}</b> dulu.${big >= 5 ? ' Manik merah turun = 5' + (big > 5 ? `, tambah ${big - 5} manik bawah.` : '.') : ''}`, `Pasang angka ${big} dulu.`);
      await ctx.talk(`Lalu tambah <b>${small}</b>, satu-satu sambil hitung.`, `Lalu tambah ${small}, satu-satu sambil hitung.`);
      await abacusCount(ctx, ab, big, big + small, label);
      await ctx.talk(`Sempoa menunjukkan <b>${q.ans}</b>. Jawabannya <b>${q.ans}</b>! 🎉`, `Sempoa menunjukkan ${q.ans}. Jawabannya ${q.ans}!`);
    },
  },

  sub_pic: {
    render: (q) => ({
      text: `Ada <b>${q.n}</b> ${q.name}. <b>${q.m}</b> ${q.name} ${q.verb}. Sisa berapa ${q.name}?`,
      say: `Ada ${q.n} ${q.name}. ${q.m} ${q.name} ${q.verb}. Sisa berapa ${q.name}?`,
      vis: `<div class="row" style="max-width:300px">${rep(q.n, i => E(q.e, 34, i >= q.n - q.m ? 'x' : '')).join('')}</div>`,
      opts: q.opts.map(v => ({ v, label: v })),
    }),
    async video(ctx, q) {
      ctx.set(`<div class="row" style="max-width:320px">${rep(q.n, () => E(q.e, 40)).join('')}</div><div id="ans"></div>`);
      const its = ctx.$$('.it');
      await ctx.talk(`Ada <b>${q.n}</b> ${q.name}. <b>${q.m}</b> ${q.verb}.`);
      await ctx.talk('Cara cepat: <b>HITUNG MUNDUR!</b> Mulai dari angka besar.', 'Cara cepat: hitung mundur! Mulai dari angka besar.');
      await ctx.talk(`Mulai dari <b>${q.n}</b>…`, `Mulai dari ${q.n}`);
      for (let i = 0; i < q.m; i++) { const it = its[q.n - 1 - i]; it.classList.add('x', 'dim'); badge(it, q.n - i - 1, true); await ctx.talk(`<span class="vbig">${q.n - i - 1}</span>`, String(q.n - i - 1), 500); }
      ctx.$('#ans').innerHTML = `<div class="answer">${q.n} − ${q.m} = ${q.ans}</div>`;
      await ctx.talk(`Sisa <b>${q.ans}</b> ${q.name}. Jawabannya <b>${q.ans}</b>!`, `Sisa ${q.ans} ${q.name}.`);
      ctx.set('<div class="vtitle">Cek pakai sempoa 🧮</div>');
      const { ab, label } = abacusBox(ctx, 2);
      ab.set(q.n); label.textContent = q.n;
      await ctx.talk(`Pasang <b>${q.n}</b>. Lalu ambil <b>${q.m}</b>, satu-satu.`, `Pasang ${q.n}. Lalu ambil ${q.m}, satu-satu.`);
      await abacusCount(ctx, ab, q.n, q.n - q.m, label);
      await ctx.talk(`Tersisa <b>${q.ans}</b>! 🎉`, `Tersisa ${q.ans}!`);
    },
  },

  count: {
    render: (q) => {
      const pts = scatterPos(q.n, q.n * 7 + 3);
      return {
        text: `Ada berapa ${q.name} pada gambar?`, say: `Ada berapa ${q.name} pada gambar?`,
        vis: `<div class="scatter">${pts.map(([x, y]) => `<span class="it emo" style="left:${x}%;top:${y}%;font-size:36px">${q.e}</span>`).join('')}</div>`,
        opts: q.opts.map(v => ({ v, label: v })),
      };
    },
    async video(ctx, q) {
      const pts = scatterPos(q.n, q.n * 7 + 3);
      ctx.set(`<div class="scatter" style="height:200px">${pts.map(([x, y]) => `<span class="it emo" style="left:${x}%;top:${y}%;font-size:44px">${q.e}</span>`).join('')}</div><div id="ans"></div>`);
      await ctx.talk(`Gambarnya acak. Supaya tidak ada yang terlewat atau dihitung dua kali…`);
      await ctx.talk('Cara cepat: hitung dari <b>KIRI ke KANAN</b> dan <b>beri tanda</b> setiap yang sudah dihitung ✔️', 'Hitung dari kiri ke kanan, dan beri tanda setiap yang sudah dihitung.');
      const its = [...ctx.$$('.it')].map((el, i) => ({ el, x: pts[i][0] })).sort((a, b) => a.x - b.x);
      for (let i = 0; i < its.length; i++) { badge(its[i].el, i + 1); await ctx.talk(`<span class="vbig">${i + 1}</span>`, String(i + 1), 450); }
      ctx.$('#ans').innerHTML = `<div class="answer">${q.n} ${q.name}</div>`;
      await ctx.talk(`Ada <b>${q.n}</b> ${q.name}! Di kertas lomba, coret tipis pakai pensil ya.`, `Ada ${q.n} ${q.name}! Di kertas lomba, coret tipis pakai pensil ya.`);
    },
  },

  abacus_read: {
    render: (q) => ({
      text: 'Berapa angka yang ditunjukkan sempoa ini?', say: 'Berapa angka yang ditunjukkan sempoa ini?',
      vis: `<div class="abx" style="height:230px;max-width:240px;aspect-ratio:auto"></div><div class="idn">Manik yang menempel ke kayu tengah = dihitung</div>`,
      opts: q.opts.map(v => ({ v, label: v })),
      mount(el) { const ab = new Abacus(el.querySelector('.abx'), { cols: 1 }); ab.set(q.v, true); return () => ab.dispose(); },
    }),
    async video(ctx, q) {
      ctx.set('<div class="vtitle">Membaca sempoa 🧮</div>');
      const { ab, label } = abacusBox(ctx, 1, 300);
      label.textContent = '?';
      ab.set(0, true);
      await ctx.talk('Ingat aturannya: manik yang <b>menempel ke kayu tengah</b> saja yang dihitung.', 'Ingat aturannya: manik yang menempel ke kayu tengah saja yang dihitung.');
      ab.set(q.v);
      let s = 0;
      await ctx.wait(700);
      if (q.v >= 5) { ab.glowBead(0, 'h', 0); s = 5; label.textContent = 5; await ctx.talk('Manik <b>merah di atas</b> turun = <b>5</b>', 'Manik merah di atas turun, nilainya 5'); }
      for (let j = 0; j < q.v % 5; j++) { ab.glowBead(0, 'e', j); s++; label.textContent = s; await ctx.talk(`Manik bawah naik: <b>${s}</b>`, String(s), 400); }
      await ctx.talk(`${q.v >= 5 ? `5 + ${q.v - 5} = ` : ''}<b>${q.v}</b>. Jawabannya <b>${q.v}</b>! 🎉`, `Jawabannya ${q.v}!`);
      await ctx.talk('Tips cepat: lihat manik merah dulu. Turun? Langsung mulai dari 5!', 'Tips cepat: lihat manik merah dulu. Kalau turun, langsung mulai dari lima!');
    },
  },

  seq: {
    render: (q) => ({
      text: 'Lengkapi kereta bilangan ini!', say: 'Lengkapi kereta bilangan ini. Angka berapa yang hilang?',
      vis: `<div class="train">${q.seq.map(n => n == null ? '<div class="car q">?</div>' : `<div class="car">${n}</div>`).join('')}</div><div style="font-size:30px">🚂</div>`,
      opts: q.opts.map(v => ({ v, label: v })), small: true,
    }),
    async video(ctx, q) {
      const full = q.seq.map((n, i) => n ?? (q.seq.find(x => x != null) + i - q.seq.findIndex(x => x != null)));
      ctx.set(`<div class="train">${q.seq.map(n => n == null ? '<div class="car q">?</div>' : `<div class="car">${String(n).slice(0, -1)}<u>${String(n).slice(-1)}</u></div>`).join('')}</div><div id="ans"></div>`);
      await ctx.talk('Bilangannya besar (ratusan). Jangan takut!');
      const pre = String(full[0]).slice(0, -1);
      await ctx.talk(`Cara cepat: angka depannya sama semua: <b>${pre}</b>. Lihat <b>angka paling belakang</b> saja!`, `Cara cepat: angka depannya sama semua. Lihat angka paling belakang saja!`);
      const cars = ctx.$$('.car');
      for (let i = 0; i < full.length; i++) {
        cars[i].classList.add('hl');
        if (q.seq[i] == null) { cars[i].classList.remove('q'); cars[i].innerHTML = `${pre}<u>${String(full[i]).slice(-1)}</u>`; cars[i].style.background = '#C9F2DF'; }
        await ctx.talk(`<span class="vbig">${String(full[i]).slice(-1)}</span>${q.seq[i] == null ? ' ← yang hilang!' : ''}`, String(full[i]).slice(-1), 300);
      }
      ctx.$('#ans').innerHTML = `<div class="answer">${q.ans}</div>`;
      await ctx.talk(`Yang hilang: <b>${q.ans}</b>. Pilih jawaban itu!`, `Yang hilang: ${q.ans}`);
      await ctx.talk('Hati-hati: urutannya juga harus benar (kiri dulu, baru kanan).', 'Hati-hati: urutannya juga harus benar. Kiri dulu, baru kanan.');
    },
  },

  after: {
    render: (q) => ({
      text: `Bilangan <b>${q.dir === 'after' ? 'sesudah' : 'sebelum'} ${q.n}</b> adalah …`, say: `Bilangan ${q.dir === 'after' ? 'sesudah' : 'sebelum'} ${q.n} adalah`,
      vis: `<div class="train">${q.dir === 'after' ? `<div class="car">${q.n}</div><div class="car q">?</div>` : `<div class="car q">?</div><div class="car">${q.n}</div>`}</div>`,
      opts: q.opts.map(v => ({ v, label: v })),
    }),
    async video(ctx, q) {
      const d = q.dir === 'after' ? 1 : -1;
      ctx.set(`<div class="hop" id="frog">🐸</div><div class="nl">${[q.n - 1, q.n, q.n + 1].map(n => `<div class="car" data-n="${n}">${n === q.n + d ? '?' : n}</div>`).join('')}</div><div id="ans"></div>`);
      const cars = ctx.$$('.car'), frog = ctx.$('#frog');
      const pos = (k) => { const c = cars[k]; frog.style.transform = `translateX(${c.offsetLeft + c.offsetWidth / 2 - frog.offsetLeft - 15}px)`; };
      pos(1);
      await ctx.talk(d > 0 ? '<b>Sesudah</b> = maju <b>1</b> langkah (tambah 1).' : '<b>Sebelum</b> = mundur <b>1</b> langkah (kurang 1).', d > 0 ? 'Sesudah artinya maju satu langkah. Tambah satu.' : 'Sebelum artinya mundur satu langkah. Kurang satu.');
      const o = q.n % 10;
      if (d > 0 && o === 9) await ctx.talk(`Angka belakang <b>9</b> + 1 = 10. Jadi angka belakang jadi <b>0</b>, angka tengah naik 1.`, 'Angka belakang sembilan tambah satu jadi sepuluh. Angka belakang jadi nol, angka tengah naik satu.');
      else if (d < 0 && o === 0) await ctx.talk(`Angka belakang <b>0</b> − 1? Jadi <b>9</b>, angka tengah turun 1.`, 'Angka belakang nol kurang satu jadi sembilan, angka tengah turun satu.');
      else await ctx.talk(`Ubah angka belakang saja: <b>${o}</b> → <b>${o + d}</b>.`, `Ubah angka belakang saja: ${o} jadi ${o + d}.`);
      pos(d > 0 ? 2 : 0); const t = cars[d > 0 ? 2 : 0]; t.textContent = q.n + d; t.style.background = '#C9F2DF';
      ctx.$('#ans').innerHTML = `<div class="answer">${q.ans}</div>`;
      await ctx.talk(`Jawabannya <b>${q.ans}</b>! 🐸`, `Jawabannya ${q.ans}!`);
      await ctx.talk(`Jebakan: ${q.opts.filter(x => x !== q.ans).join(', ')} itu salah. Cek sekali lagi angka belakangnya.`, 'Hati-hati jebakan. Cek sekali lagi angka belakangnya.');
    },
  },

  dice: {
    render: (q) => ({
      text: 'Tanda yang tepat untuk kotak di tengah adalah …', say: 'Tanda yang tepat untuk kotak di tengah adalah',
      vis: `<div class="cmp">${diceSVG(q.a, 80)}<div class="slot"></div>${diceSVG(q.b, 80)}</div>`,
      opts: q.opts.map(v => ({ v, label: v })), cols3: true,
    }),
    async video(ctx, q) {
      ctx.set(`<div class="cmp"><div id="da">${diceSVG(q.a, 100)}</div><div class="slot" id="sl"></div><div id="db">${diceSVG(q.b, 100)}</div></div><div class="cmp" style="gap:40px"><div class="vbig" id="na">?</div><div class="vbig" id="nb">?</div></div><div id="ans"></div>`);
      await ctx.talk('Hitung titik di setiap dadu. Tips: hafalkan bentuk dadu, tidak perlu menghitung lagi!', 'Hitung titik di setiap dadu. Tips: hafalkan bentuk dadu, tidak perlu menghitung lagi!');
      for (const [id, n, out] of [['#da', q.a, '#na'], ['#db', q.b, '#nb']]) {
        const pips = ctx.$(id).querySelectorAll('.pip');
        for (let i = 0; i < n; i++) { pips[i].setAttribute('fill', '#2F80ED'); ctx.$(out).textContent = i + 1; await ctx.wait(260); }
        await ctx.talk(`<b>${n}</b> titik`, `${n} titik`);
      }
      const sym = q.a > q.b ? '>' : q.a < q.b ? '<' : '=';
      await ctx.talk('Ingat <b>si Buaya Lapar</b> 🐊: mulutnya selalu terbuka ke yang <b>lebih banyak</b>!', 'Ingat si buaya lapar. Mulutnya selalu terbuka ke yang lebih banyak!');
      ctx.$('#sl').innerHTML = sym;
      ctx.$('#ans').innerHTML = `<div class="answer">${q.a} ${sym} ${q.b}</div>`;
      await ctx.talk(sym === '=' ? `Sama banyak, jadi tandanya <b>=</b>` : `<b>${Math.max(q.a, q.b)}</b> lebih banyak, mulut buaya membuka ke ${q.a > q.b ? 'kiri' : 'kanan'}: <b>${sym}</b>`,
        sym === '=' ? 'Sama banyak, jadi tandanya sama dengan.' : `${Math.max(q.a, q.b)} lebih banyak. Tandanya ${sym === '>' ? 'lebih besar dari' : 'lebih kecil dari'}.`);
    },
  },

  cmp: {
    render: (q) => ({
      text: 'Tanda yang tepat untuk kotak di tengah adalah …', say: `Tanda yang tepat untuk ${q.a} dan ${q.b} adalah`,
      vis: `<div class="cmp"><div class="num">${q.a}</div><div class="slot"></div><div class="num">${q.b}</div></div>`,
      opts: q.opts.map(v => ({ v, label: v })), cols3: true,
    }),
    async video(ctx, q) {
      ctx.set(`<div class="cmp"><div class="num" id="a">${digits(q.a)}</div><div class="slot" id="sl"></div><div class="num" id="b">${digits(q.b)}</div></div>
      <div class="rule" style="max-width:320px"><div>Ratusan</div><div>Puluhan</div><div>Satuan</div></div><div id="ans"></div>`);
      await ctx.talk('Cara cepat: bandingkan <b>dari angka paling depan</b> (kiri).', 'Cara cepat: bandingkan dari angka paling depan, sebelah kiri.');
      const A = String(q.a), B = String(q.b), names = ['ratusan', 'puluhan', 'satuan'];
      const rule = ctx.$$('.rule div'); let sym = '=';
      for (let i = 0; i < A.length; i++) {
        const sa = ctx.$('#a').children[i], sb = ctx.$('#b').children[i];
        sa.classList.add('hl'); sb.classList.add('hl'); rule[i].classList.add('hl');
        if (A[i] === B[i]) { await ctx.talk(`${names[i]}: <b>${A[i]}</b> dan <b>${B[i]}</b> sama. Lanjut ke kanan →`, `${names[i]}: ${A[i]} dan ${B[i]} sama. Lanjut.`); rule[i].classList.remove('hl'); continue; }
        const win = A[i] > B[i] ? sa : sb; win.classList.add('win');
        sym = A[i] > B[i] ? '>' : '<';
        await ctx.talk(`${names[i]}: <b>${A[i]}</b> dan <b>${B[i]}</b>. <b>${Math.max(A[i], B[i])}</b> lebih besar! Selesai, tidak perlu lihat sisanya.`, `${names[i]}: ${A[i]} dan ${B[i]}. ${Math.max(A[i], B[i])} lebih besar! Selesai.`);
        break;
      }
      ctx.$('#sl').innerHTML = sym; ctx.$('#ans').innerHTML = `<div class="answer">${q.a} ${sym} ${q.b}</div>`;
      await ctx.talk(`Mulut buaya 🐊 membuka ke yang besar: <b>${q.a} ${sym} ${q.b}</b>`, `Jadi ${q.a} ${sym === '>' ? 'lebih besar dari' : sym === '<' ? 'lebih kecil dari' : 'sama dengan'} ${q.b}`);
    },
  },

  order: {
    render: (q) => ({
      text: 'Urutkan dari yang <b>terkecil</b>!', say: `Urutkan dari yang terkecil: ${q.nums.join(', ')}`,
      vis: `<div class="chips">${q.nums.map(n => `<span class="chip">${n}</span>`).join('')}</div>`,
      opts: q.opts.map(v => ({ v, label: v })), one: true,
    }),
    async video(ctx, q) {
      const sorted = [...q.nums].sort((a, b) => a - b);
      ctx.set(`<div class="chips" id="src">${q.nums.map(n => `<span class="chip" data-n="${n}">${digits(n)}</span>`).join('')}</div><div style="font-size:26px">⬇️</div><div class="chips" id="dst" style="min-height:52px"></div><div id="ans"></div>`);
      await ctx.talk('Cara cepat: lihat <b>angka paling depan</b> dulu (ratusan).', 'Cara cepat: lihat angka paling depan dulu.');
      for (const c of ctx.$$('#src .chip')) c.firstChild.classList.add('hl');
      await ctx.talk(`Angka depannya: ${q.nums.map(n => String(n)[0]).join(', ')}. Kalau sama, lihat angka tengahnya.`, 'Kalau angka depannya sama, lihat angka tengahnya.');
      for (const n of sorted) {
        const c = ctx.$(`#src .chip[data-n="${n}"]`); c.classList.add('hl');
        await ctx.wait(350); ctx.$('#dst').appendChild(c);
        await ctx.talk(`<b>${n}</b>`, String(n), 350);
      }
      ctx.$('#ans').innerHTML = `<div class="answer" style="font-size:22px">${q.ans}</div>`;
      await ctx.talk('Pilih jawaban yang urutannya <b>persis sama</b>. Cek angka pertama dan terakhir dulu, itu paling cepat!', 'Pilih jawaban yang urutannya persis sama. Cek angka pertama dan terakhir dulu, itu paling cepat!');
    },
  },

  shape_name: {
    render: (q) => ({
      text: 'Bangun datar ini bernama …', say: 'Bangun datar ini bernama',
      vis: shapeSVG(q.kind, 130), opts: q.opts.map(v => ({ v, label: v })), small: true,
    }),
    async video(ctx, q) {
      const FACTS = {
        trapesium: ['Sisi <b>atas</b> dan <b>bawah</b> sejajar, tapi <b>panjangnya beda</b>.', 'Bentuknya seperti <b>ember terbalik</b> atau atap rumah.'],
        segitiga: ['Punya <b>3 sisi</b> dan 3 sudut.', 'Seperti potongan pizza 🍕.'],
        persegi: ['Punya <b>4 sisi yang sama panjang</b>.', 'Seperti kotak kado 🎁.'],
        'persegi panjang': ['4 sisi: <b>2 panjang</b>, <b>2 pendek</b>.', 'Seperti pintu 🚪.'],
        'belah ketupat': ['4 sisi sama panjang, tapi <b>miring</b> seperti layang-layang berdiri.', 'Seperti ketupat lebaran.'],
      }[q.kind];
      ctx.set(`<div>${shapeSVG(q.kind, 190)}</div><div id="ans"></div>`);
      const sides = ctx.$$('.side');
      await ctx.talk('Hitung sisinya dulu!', 'Hitung sisinya dulu!');
      for (let i = 0; i < sides.length; i++) { sides[i].setAttribute('stroke', '#E53950'); sides[i].setAttribute('stroke-width', '9'); await ctx.talk(`<span class="vbig">${i + 1}</span>`, String(i + 1), 300); }
      for (const f of FACTS) await ctx.talk(f);
      ctx.$('#ans').innerHTML = `<div class="answer">${q.ans}</div>`;
      await ctx.talk(`Ini <b>${q.ans}</b>!`, `Ini ${q.ans}!`);
    },
  },

  shape_count: {
    render: (q) => ({
      text: `Ada berapa <b>${q.kind}</b> pada gambar rumah?`, say: `Ada berapa ${q.kind} pada gambar rumah?`,
      vis: houseSVG(280), opts: q.opts.map(v => ({ v, label: v })),
    }),
    async video(ctx, q) {
      ctx.set(`<div>${houseSVG(320)}</div><div id="ans"></div>`);
      await ctx.talk(`Cari <b>${q.kind}</b> ${shapeSVG(q.kind, 26)} satu per satu. Mulai dari <b>atas</b> ke <b>bawah</b>, kiri ke kanan.`, `Cari ${q.kind} satu per satu. Mulai dari atas ke bawah, kiri ke kanan.`);
      const svg = ctx.$('svg.house');
      const els = [...svg.querySelectorAll(`[data-k="${q.kind}"]`)].map(el => ({ el, b: el.getBBox() })).sort((a, b) => (a.b.y - b.b.y) || (a.b.x - b.b.x));
      for (let i = 0; i < els.length; i++) { els[i].el.setAttribute('stroke', '#2F80ED'); els[i].el.setAttribute('stroke-width', '7'); svgBadge(svg, els[i].el, i + 1); await ctx.talk(`<span class="vbig">${i + 1}</span>`, String(i + 1), 400); }
      await ctx.talk('Pohon cemara juga segitiga lho! Jangan lupa lihat <b>pinggir gambar</b>.', 'Pohon cemara juga segitiga lho! Jangan lupa lihat pinggir gambar.');
      ctx.$('#ans').innerHTML = `<div class="answer">${q.ans} ${q.kind}</div>`;
      await ctx.talk(`Jawabannya <b>${q.ans}</b>! 🎉`, `Jawabannya ${q.ans}!`);
    },
  },

  // ---------------- BAHASA INGGRIS ----------------
  pic_word: {
    render: (q) => ({
      text: `<span class="en">${q.q}</span><div class="idn">${q.qi}</div>`, say: [en(q.q)],
      vis: E(q.e, 96), opts: q.opts.map(v => ({ v, label: v, say: v })),
    }),
    async video(ctx, q) {
      ctx.set(`<div>${E(q.e, 120)}</div><div class="vopts">${q.opts.map(o => `<div data-o="${o}"><span class="first">${o[0]}</span>${o.slice(1)}<small>${q.mean[o]}</small></div>`).join('')}</div>`);
      await ctx.talk(`Ini <b>${q.idn}</b>. Bahasa Inggrisnya…`, `Ini ${q.idn}. Bahasa Inggrisnya`);
      await ctx.talk(`<b class="en">${q.ans}</b> 🔊`, [en(q.ans), en(q.ans)]);
      await ctx.talk(`Cara cepat: dengar <b>bunyi awalnya</b>: "${q.ans[0]}… ${q.ans[0]}…". Cari kata berawalan huruf <b>${q.ans[0].toUpperCase()}</b>.`, [[`Cara cepat: dengar bunyi awalnya. Cari kata yang berawalan huruf ${q.ans[0].toUpperCase()}.`, 'id']]);
      for (const d of ctx.$$('.vopts div')) {
        const o = d.dataset.o;
        if (o !== q.ans) { d.classList.add('out'); await ctx.talk(`<b>${o}</b> = ${q.mean[o]} ✗`, [en(o), [`artinya ${q.mean[o]}`, 'id']], 200); }
      }
      ctx.$(`.vopts div[data-o="${q.ans}"]`).classList.add('hl');
      await ctx.talk(`Jawabannya <b>${q.ans}</b>! 🎉`, [['Jawabannya', 'id'], en(q.ans)]);
    },
  },

  word_pic: {
    render: (q) => ({
      text: `<span class="en">Which one is a <b>${q.word}</b>?</span><div class="idn">Mana gambar ${q.word}?</div>`, say: [en(`Which one is a ${q.word}?`)],
      vis: '', opts: q.opts.map(v => ({ v, label: v, pic: true })),
    }),
    async video(ctx, q) {
      ctx.set(`<div class="vtitle en">${q.word}</div><div class="vopts">${q.opts.map(o => `<div data-o="${o}" style="font-size:52px">${o}<small>${q.mean[o]}</small></div>`).join('')}</div>`);
      await ctx.talk(`<b>${q.word}</b> artinya <b>${q.idn}</b>.`, [en(q.word), ['artinya ' + q.idn, 'id']]);
      await ctx.talk('Sebutkan nama setiap gambar dalam bahasa Inggris:', 'Sebutkan nama setiap gambar dalam bahasa Inggris.');
      for (const d of ctx.$$('.vopts div')) {
        const o = d.dataset.o; d.style.transform = 'scale(1.08)';
        await ctx.talk(`${o} = <b>${q.mean[o]}</b> ${o === q.ans ? '✔️' : ''}`, [en(q.mean[o])], 200);
        d.style.transform = ''; if (o !== q.ans) d.classList.add('out'); else d.classList.add('hl');
      }
      await ctx.talk(`Jawabannya ${q.ans} <b>${q.word}</b>! 🎉`, [en(`${q.word}!`)]);
    },
  },

  missing: {
    render: (q) => ({
      text: `<span class="en">Complete the word!</span><div class="idn">Huruf apa yang hilang? (${q.idn})</div>`, say: [en('Complete the word!'), ['Huruf apa yang hilang?', 'id']],
      vis: `${E(q.e, 80)}<div class="num">${q.word.split('').map((c, i) => i === q.idx ? '<span style="border-bottom:4px solid #2B2340;min-width:30px;display:inline-block">&nbsp;</span>' : c).join(' ')}</div>`,
      opts: q.opts.map(v => ({ v, label: v })),
    }),
    async video(ctx, q) {
      ctx.set(`${E(q.e, 110)}<div class="num" id="w">${q.word.split('').map((c, i) => `<span>${i === q.idx ? '_' : c}</span>`).join(' ')}</div><div id="ans"></div>`);
      await ctx.talk(`Ini <b>${q.idn}</b>. Bahasa Inggrisnya <b>${q.word}</b>.`, [[`Ini ${q.idn}. Bahasa Inggrisnya`, 'id'], en(q.word)]);
      await ctx.talk('Cara cepat: <b>ucapkan pelan-pelan</b>, dengarkan setiap bunyinya.', 'Cara cepat: ucapkan pelan-pelan, dengarkan setiap bunyinya.');
      const sp = ctx.$$('#w span');
      for (let i = 0; i < q.word.length; i++) {
        sp[i].classList.add('hl'); if (i === q.idx) { sp[i].textContent = q.word[i]; sp[i].classList.add('win'); }
        await ctx.talk(`<span class="vbig">${q.word[i]}</span>`, [en(q.word[i])], 250);
      }
      ctx.$('#ans').innerHTML = `<div class="answer">${q.word}</div>`;
      await ctx.talk(`Huruf yang hilang: <b>${q.ans}</b>. ${q.word}! 🎉`, [['Huruf yang hilang', 'id'], en(q.ans), en(q.word)]);
    },
  },

  sentence: {
    render: (q) => {
      let vis = '';
      if (q.e) vis = E(q.e, 90);
      if (q.shape) vis = shapeSVG(q.shape, 110);
      if (q.count) vis = `<div class="row" style="max-width:280px">${rep(q.count.n, () => E(q.count.e, 44)).join('')}</div>`;
      return {
        text: `<span class="en">${q.q}</span>${q.qi ? `<div class="idn">${q.qi}</div>` : ''}`,
        say: [en(q.q)],
        vis: vis + `<div class="sent">${q.sent.replace('___', '<span class="blank">&nbsp;</span>')}</div>`,
        opts: q.opts.map(v => ({ v, label: v, say: v })), one: q.opts.some(o => o.length > 11), cols3: q.opts.length === 3,
      };
    },
    async video(ctx, q) {
      let pic = q.e ? E(q.e, 100) : q.shape ? shapeSVG(q.shape, 150) : `<div class="row" style="max-width:320px">${rep(q.count.n, () => E(q.count.e, 50)).join('')}</div>`;
      ctx.set(`<div id="pic">${pic}</div><div class="sent" id="s">${q.sent.replace('___', '<span class="blank">&nbsp;?&nbsp;</span>')}</div><div id="ex" style="width:100%"></div>`);
      await ctx.talk(`<span class="en">${q.q}</span>${q.qi ? `<br><small>${q.qi}</small>` : ''}`, [en(q.q), ...(q.qi ? [[q.qi.replace(/_+|…/g, ' '), 'id']] : [])]);
      const ex = ctx.$('#ex');
      if (q.trick === 'hesheit') {
        ex.innerHTML = `<div class="rule"><div data-r="He"><b>He</b>👦👨👴<small>laki-laki</small></div><div data-r="She"><b>She</b>👧👩👵<small>perempuan</small></div><div data-r="It"><b>It</b>🐱⚽🚗<small>hewan / benda</small></div></div>`;
        await ctx.talk('Rumus cepat: <b>He</b> = laki-laki, <b>She</b> = perempuan, <b>It</b> = hewan atau benda.', [['Rumus cepat:', 'id'], en('He'), ['laki-laki.', 'id'], en('She'), ['perempuan.', 'id'], en('It'), ['hewan atau benda.', 'id']]);
        await ctx.talk('<b>Ani</b> + <b>sister</b> = perempuan 👧', 'Ani adalah perempuan.');
        ex.querySelector(`[data-r="${q.ans}"]`).classList.add('hl');
      } else if (q.trick === 'sides3') {
        const sides = ctx.$$('#pic .side');
        for (let i = 0; i < sides.length; i++) { sides[i].setAttribute('stroke', '#E53950'); sides[i].setAttribute('stroke-width', '9'); await ctx.talk(`<span class="vbig">${i + 1}</span> side`, [en(EN_NUM[i + 1])], 250); }
        await ctx.talk('3 sisi = <b>tri</b>angle. "Tri" artinya tiga!', [['Tiga sisi,', 'id'], en('triangle'), ['Tri artinya tiga!', 'id']]);
      } else if (q.count) {
        const its = ctx.$$('#pic .it');
        await ctx.talk('Hitung dalam bahasa Inggris:', 'Hitung dalam bahasa Inggris.');
        for (let i = 0; i < its.length; i++) { badge(its[i], i + 1); await ctx.talk(`<span class="vbig">${EN_NUM[i + 1]}</span>`, [en(EN_NUM[i + 1])], 250); }
      }
      ex.insertAdjacentHTML('beforeend', `<div class="vopts" style="margin-top:8px">${q.opts.map(o => `<div data-o="${o}" style="font-size:18px">${o}<small>${q.mean[o]}</small></div>`).join('')}</div>`);
      await ctx.talk('Arti setiap pilihan:', 'Arti setiap pilihan.');
      for (const d of ex.querySelectorAll('.vopts div')) {
        const o = d.dataset.o;
        await ctx.talk(`<b>${o}</b> = ${q.mean[o]} ${o === q.ans ? '✔️' : '✗'}`, [en(o), [q.mean[o].replace(/[^\p{L}\p{N}\s()-]/gu, ''), 'id']], 150);
        d.classList.add(o === q.ans ? 'hl' : 'out');
      }
      const b = ctx.$('#s .blank'); b.textContent = q.ans; b.style.background = '#C9F2DF';
      const full = q.sent.replace('___', q.ans).replace(/"/g, '');
      await ctx.talk(`<span class="en">${full}</span> 🎉`, [en(full)]);
    },
  },
};
