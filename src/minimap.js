// minimap.js — a top-down radar, and the single biggest navigation win.
//
// It doubles as a flood map: the terrain is sampled once into a coarse height
// grid at startup, and each frame every cell below the waterline is painted
// blue. So the map does not just tell you where things are, it tells you which
// ground is still dry — which is the actual question in the last two minutes.

const R = 96;          // world radius the map covers, in metres

export class Minimap {
  constructor(canvas, terrain, { grid = 56 } = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.terrain = terrain;
    this.grid = grid;

    // sample the valley once; heightAt is analytic but not free
    this.h = new Float32Array(grid * grid);
    for (let j = 0; j < grid; j++) {
      for (let i = 0; i < grid; i++) {
        const x = (i / (grid - 1) - 0.5) * 2 * R;
        const z = (j / (grid - 1) - 0.5) * 2 * R;
        this.h[j * grid + i] = terrain.heightAt(x, z);
      }
    }
    this._lastWater = NaN;
    this.resize();
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const css = this.cv.clientWidth || 150;
    this.cv.width = Math.round(css * dpr);
    this.cv.height = Math.round(css * dpr);
    this.size = this.cv.width;
    this._terrainDirty = true;
  }

  /** world x/z -> canvas px, with the map rotated so "up" is north (fixed). */
  _p(x, z) {
    const s = this.size;
    return [(x / R * 0.5 + 0.5) * s, (z / R * 0.5 + 0.5) * s];
  }

  draw({ noah, herd, crowd, ark, waterLevel, shofarRange }) {
    const ctx = this.ctx;
    const s = this.size;
    const g = this.grid;

    ctx.clearRect(0, 0, s, s);

    // clip everything to a disc so it reads as a radar, not a photo
    ctx.save();
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
    ctx.clip();

    // ── land / flood ──
    const cell = s / (g - 1);
    for (let j = 0; j < g; j++) {
      for (let i = 0; i < g; i++) {
        const h = this.h[j * g + i];
        if (h < waterLevel) {
          const d = Math.min(1, (waterLevel - h) / 9);
          ctx.fillStyle = `rgb(${34 - d * 16},${86 - d * 36},${118 - d * 34})`;
        } else {
          const hi = Math.min(1, Math.max(0, h / 14));
          ctx.fillStyle = `rgb(${62 + hi * 70},${116 + hi * 50},${48 + hi * 50})`;
        }
        ctx.fillRect(i * cell - cell * 0.5, j * cell - cell * 0.5, cell + 1, cell + 1);
      }
    }

    // ── shofar reach ──
    if (noah && shofarRange) {
      const [nx, nz] = this._p(noah.pos.x, noah.pos.z);
      ctx.beginPath();
      ctx.arc(nx, nz, shofarRange / R * 0.5 * s, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(246,196,69,.16)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(246,196,69,.5)';
      ctx.lineWidth = Math.max(1, s * 0.006);
      ctx.stroke();
    }

    // ── the ark ──
    if (ark) {
      const [ax, az] = this._p(ark.boardX, ark.boardZ - 8);
      ctx.fillStyle = '#b07a3e';
      ctx.strokeStyle = '#4a2f14';
      ctx.lineWidth = Math.max(1, s * 0.008);
      const w = s * 0.085, hgt = s * 0.042;
      ctx.beginPath();
      ctx.ellipse(ax, az, w, hgt, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }

    const dot = (x, z, r, fill, stroke) => {
      const [px, pz] = this._p(x, z);
      ctx.beginPath();
      ctx.arc(px, pz, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, s * 0.005); ctx.stroke(); }
    };

    // ── villagers ──
    if (crowd) for (const v of crowd.list) {
      dot(v.pos.x, v.pos.z, s * 0.011, v.convinced ? '#9fe6a0' : 'rgba(240,235,225,.62)');
    }

    // ── animals still owed ──
    if (herd) {
      for (const c of herd.critters) {
        if (c.boarded || c.extra) continue;
        const m = herd.manifest.get(c.key);
        const following = herd.line.includes(c);
        if (c.isSecret) {
          if (!following) dot(c.pos.x, c.pos.z, s * 0.016, '#ffffff', '#b58ce8');
          else dot(c.pos.x, c.pos.z, s * 0.016, '#ffffff', '#4a2f14');
          continue;
        }
        if (m && m[c.sex] && !following) continue;      // already have this one
        const col = following ? '#8ef08e' : (c.sex === 'f' ? '#ff8fc0' : '#6fd0ff');
        dot(c.pos.x, c.pos.z, s * 0.017, col, 'rgba(30,20,10,.65)');
      }
    }

    // ── Noah ──
    if (noah) {
      const [nx, nz] = this._p(noah.pos.x, noah.pos.z);
      const a = noah.heading;
      const r = s * 0.032;
      ctx.save();
      ctx.translate(nx, nz);
      ctx.rotate(-a);                        // world heading is atan2(x,z)
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.68, r * 0.72);
      ctx.lineTo(0, r * 0.34);
      ctx.lineTo(-r * 0.68, r * 0.72);
      ctx.closePath();
      ctx.fillStyle = '#fff6e4';
      ctx.strokeStyle = '#4a2f14';
      ctx.lineWidth = Math.max(1, s * 0.008);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // rim
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = Math.max(2, s * 0.018);
    ctx.stroke();
  }
}
