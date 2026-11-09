// 3D Sempoa (soroban): 1 manik atas = 5, 4 manik bawah = 1 each.
import * as THREE from './vendor/three.module.min.js';

const COLORS = ['#FF8A00', '#2F80ED', '#22B07D', '#E0457B']; // satuan, puluhan, ratusan, ribuan
const NAMES = ['Satuan', 'Puluhan', 'Ratusan', 'Ribuan'];
const BEAM = 0.95, GAP = 0.62, BH = 0.42, SP = 1.35;

function beadGeo() {
  const pts = [];
  const r = 0.56, h = BH / 2;
  pts.push(new THREE.Vector2(0.07, -h));
  pts.push(new THREE.Vector2(r * 0.55, -h * 0.85));
  pts.push(new THREE.Vector2(r, -h * 0.18));
  pts.push(new THREE.Vector2(r, h * 0.18));
  pts.push(new THREE.Vector2(r * 0.55, h * 0.85));
  pts.push(new THREE.Vector2(0.07, h));
  return new THREE.LatheGeometry(pts, 40);
}

export class Abacus {
  constructor(el, { cols = 2, interactive = false, onChange = null } = {}) {
    this.el = el; this.cols = cols; this.interactive = interactive; this.onChange = onChange;
    this.digits = new Array(cols).fill(0); // index 0 = satuan (rightmost)
    this.beads = []; // per col: {heaven, earth:[4]}
    this.alive = true;
    const w = el.clientWidth || 320, h = el.clientHeight || 330;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(w, h);
    el.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    const fw = cols * SP + 0.9;
    this.camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 100);
    const dist = Math.max(fw * 1.55, 9.6);
    this.camera.position.set(0, 1.4, dist);
    this.camera.lookAt(0, 0.15, 0);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xbba98a, 1.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(3, 6, 8); this.scene.add(dl);
    this.build();
    this.ray = new THREE.Raycaster(); this.ptr = new THREE.Vector2();
    if (interactive) {
      this._down = (e) => this.tap(e);
      this.renderer.domElement.addEventListener('pointerdown', this._down);
    }
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(el);
    const loop = () => { if (!this.alive) return; this.tick(); this.renderer.render(this.scene, this.camera); this.raf = requestAnimationFrame(loop); };
    loop();
  }
  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  colX(i) { return ((this.cols - 1) / 2 - i) * SP; } // i=0 rightmost
  build() {
    const g = new THREE.Group(); this.group = g; this.scene.add(g);
    g.rotation.x = -0.12;
    const wood = new THREE.MeshStandardMaterial({ color: '#8B5A2B', roughness: 0.6 });
    const woodL = new THREE.MeshStandardMaterial({ color: '#A86B34', roughness: 0.6 });
    const fw = this.cols * SP + 0.6, top = BEAM + BH + GAP + 0.55, bot = BEAM - 4 * BH - GAP - 0.55;
    const fh = top - bot;
    const bar = (w, h, x, y, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), m); b.position.set(x, y, 0); g.add(b); return b; };
    bar(fw + 0.5, 0.32, 0, top + 0.16, wood); bar(fw + 0.5, 0.32, 0, bot - 0.16, wood);
    bar(0.3, fh + 0.64, -fw / 2 - 0.1, (top + bot) / 2, wood); bar(0.3, fh + 0.64, fw / 2 + 0.1, (top + bot) / 2, wood);
    bar(fw, 0.18, 0, BEAM, woodL);
    // back board
    const back = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshStandardMaterial({ color: '#FFF3DC' }));
    back.position.set(0, (top + bot) / 2, -0.3); g.add(back);
    const rodM = new THREE.MeshStandardMaterial({ color: '#C9C2B6', metalness: 0.5, roughness: 0.35 });
    const geo = beadGeo();
    this.markers = [];
    for (let i = 0; i < this.cols; i++) {
      const x = this.colX(i);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, fh, 12), rodM); rod.position.set(x, (top + bot) / 2, 0); g.add(rod);
      const col = COLORS[i % COLORS.length];
      const mk = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.05, emissive: '#000000' });
      const heaven = new THREE.Mesh(geo, mk('#E53950')); heaven.position.set(x, this.hy(i, false), 0);
      heaven.userData = { col: i, kind: 'h' }; g.add(heaven);
      const earth = [];
      for (let j = 0; j < 4; j++) { const b = new THREE.Mesh(geo, mk(col)); b.userData = { col: i, kind: 'e', j }; b.position.set(x, this.ey(i, j, false), 0); g.add(b); earth.push(b); }
      // dot marker on beam for unit rod
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), new THREE.MeshStandardMaterial({ color: '#fff' }));
      dot.position.set(x, BEAM, 0.27); g.add(dot);
      this.beads.push({ heaven, earth });
    }
    this.targets = new Map();
  }
  hy(i, on) { return on ? BEAM + 0.09 + BH / 2 : BEAM + 0.09 + BH / 2 + GAP; }
  ey(i, j, on) { const base = BEAM - 0.09 - BH / 2 - j * BH; return on ? base : base - GAP; }
  layout(i, d) {
    const b = this.beads[i]; const h = d >= 5, e = d % 5;
    this.targets.set(b.heaven, this.hy(i, h));
    for (let j = 0; j < 4; j++) this.targets.set(b.earth[j], this.ey(i, j, j < e));
  }
  tick() {
    for (const [m, y] of this.targets) {
      const dy = y - m.position.y;
      if (Math.abs(dy) < 0.002) { m.position.y = y; this.targets.delete(m); continue; }
      m.position.y += dy * 0.22;
    }
  }
  setCol(i, d, instant = false) {
    this.digits[i] = d; this.layout(i, d);
    if (instant) { for (const [m, y] of this.targets) m.position.y = y; this.targets.clear(); }
    this.onChange && this.onChange(this.value, this.digits.slice());
  }
  set(v, instant = false) { for (let i = 0; i < this.cols; i++) { this.setCol(i, Math.floor(v / 10 ** i) % 10, instant); } }
  get value() { return this.digits.reduce((s, d, i) => s + d * 10 ** i, 0); }
  glow(i, on = true) {
    const b = this.beads[i]; if (!b) return;
    [b.heaven, ...b.earth].forEach(m => m.material.emissive.set(on ? '#553300' : '#000000'));
  }
  glowBead(i, kind, j, on = true) {
    const b = this.beads[i]; const m = kind === 'h' ? b.heaven : b.earth[j]; m.material.emissive.set(on ? '#665500' : '#000000');
  }
  tap(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1; this.ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    this.ray.setFromCamera(this.ptr, this.camera);
    const objs = this.beads.flatMap(b => [b.heaven, ...b.earth]);
    const hit = this.ray.intersectObjects(objs)[0]; if (!hit) return;
    const { col, kind, j } = hit.object.userData; let d = this.digits[col];
    if (kind === 'h') d = d >= 5 ? d - 5 : d + 5;
    else { const e5 = d % 5, hv = d - e5; d = hv + (j < e5 ? j : j + 1); }
    this.setCol(col, d);
    if (navigator.vibrate) navigator.vibrate(8);
  }
  dispose() {
    this.alive = false; cancelAnimationFrame(this.raf); this._ro.disconnect();
    if (this._down) this.renderer.domElement.removeEventListener('pointerdown', this._down);
    this.scene.traverse(o => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); });
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}
export { NAMES as COL_NAMES, COLORS as COL_COLORS };
